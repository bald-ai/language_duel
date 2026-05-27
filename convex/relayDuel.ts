/**
 * Relay-duel mutations. Turn-based: the picker hands a word to the rival, who
 * answers it (or times out), then becomes the next picker. Scoring and turn
 * state live entirely in the relay-specific fields; this never routes through
 * the both-answered advance used by PvP/PvE.
 */

import { mutation, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getDuelParticipant } from "./helpers/auth";
import { assertDuelMode } from "./rules/duelModeGuards";
import { RELAY_ANSWER_TIMEOUT_MS } from "../lib/duelConstants";
import {
  buildRelayAdvancePatch,
  buildRelayAnswerPatch,
  buildRelayPickPatch,
  buildRelaySentenceAnswerPatch,
  buildRelayTimeoutPatch,
  isRelayFinished,
  relayAnswerer,
  relayRemainingPositions,
  relayServedQuestion,
} from "../lib/duel/relayEngine";
import {
  scoreSentenceSubmission,
  validateSentenceSubmission,
} from "./rules/sentenceGameplayRules";
import { isLivesAttempt } from "./rules/duelScoringRules";

function assertActive(duel: Doc<"duels">) {
  if (duel.status !== "active") {
    throw new ConvexError({ code: "DUEL_NOT_ACTIVE", message: "Duel is not active" });
  }
}

/**
 * Apply a hand-off patch (advance or timeout), completing the duel inline when
 * it was the final word. Completion is relay-local: no lifecycle scheduler is
 * involved because relay is normal-source-only (Slice 6).
 */
async function applyRelayHandoff(
  ctx: MutationCtx,
  duelId: Id<"duels">,
  duel: Doc<"duels">,
  patch: Partial<Doc<"duels">>
) {
  const finished = isRelayFinished({ ...duel, ...patch });
  await ctx.db.patch(
    duelId,
    finished ? { ...patch, status: "completed" as const } : patch
  );
}

async function resolveRelayTimeoutIfStale(
  ctx: MutationCtx,
  duelId: Id<"duels">,
  duel: Doc<"duels">,
  opts: {
    expectedAssignedIndex: number | undefined;
    requireWindowElapsed: boolean;
    cancelScheduled: boolean;
  }
) {
  if (duel.duelMode !== "relay") return;
  if (duel.status !== "active") return;
  if (duel.relayPhase !== "answer") return;
  if (duel.relayAssignedIndex === undefined) return;
  if (
    opts.expectedAssignedIndex !== undefined &&
    duel.relayAssignedIndex !== opts.expectedAssignedIndex
  ) {
    return;
  }
  if (opts.requireWindowElapsed) {
    const startedAt = duel.relayAnswerStartedAt ?? 0;
    if (Date.now() - startedAt < RELAY_ANSWER_TIMEOUT_MS) return;
  }

  if (opts.cancelScheduled && duel.relayTimeoutScheduledFunctionId) {
    await ctx.scheduler.cancel(duel.relayTimeoutScheduledFunctionId);
  }

  await applyRelayHandoff(ctx, duelId, duel, buildRelayTimeoutPatch(duel));
}

export const relayPick = mutation({
  args: {
    duelId: v.id("duels"),
    wordIndex: v.number(),
    hardUpgrade: v.boolean(),
  },
  handler: async (ctx, { duelId, wordIndex, hardUpgrade }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "relay", "relayPick");
    assertActive(duel);

    if (duel.relayPhase !== "pick") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Relay is not in the pick phase" });
    }
    if (playerRole !== duel.relayPicker) {
      throw new ConvexError({
        code: "NOT_AUTHORIZED",
        message: "Only the picker can hand over a word",
      });
    }
    if (!relayRemainingPositions(duel).includes(wordIndex)) {
      throw new ConvexError({ code: "INVALID_STATE", message: "That word is no longer available" });
    }
    if (hardUpgrade && (duel.relayHardBudget?.[playerRole] ?? 0) <= 0) {
      throw new ConvexError({ code: "INVALID_STATE", message: "No hard-upgrade budget left" });
    }

    const now = Date.now();
    const pickPatch = buildRelayPickPatch({ duel, wordIndex, hardUpgrade, now });

    // Server-side backstop: a both-client disconnect can't stall the answer
    // phase forever (no stale-duel cron exists). Cancelled on a timely answer.
    const scheduledId = await ctx.scheduler.runAfter(
      RELAY_ANSWER_TIMEOUT_MS,
      internal.relayDuel.relayTimeoutInternal,
      { duelId, expectedAssignedIndex: wordIndex }
    );

    await ctx.db.patch(duelId, {
      ...pickPatch,
      relayTimeoutScheduledFunctionId: scheduledId,
    });
  },
});

export const relayAnswer = mutation({
  args: {
    duelId: v.id("duels"),
    value: v.string(),
  },
  handler: async (ctx, { duelId, value }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "relay", "relayAnswer");
    assertActive(duel);

    if (duel.relayPhase !== "answer") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Relay is not in the answer phase" });
    }
    if (playerRole !== relayAnswerer(duel)) {
      throw new ConvexError({
        code: "NOT_AUTHORIZED",
        message: "Only the assigned answerer can answer",
      });
    }
    const served = relayServedQuestion(duel);
    if (served === undefined) {
      throw new ConvexError({ code: "INTERNAL_ERROR", message: "Relay question data is missing" });
    }
    if (served.kind !== "word") {
      throw new ConvexError({
        code: "WRONG_QUESTION_KIND",
        message: "Use relayAnswerSentence for sentence positions",
      });
    }

    if (duel.relayTimeoutScheduledFunctionId) {
      await ctx.scheduler.cancel(duel.relayTimeoutScheduledFunctionId);
    }

    await ctx.db.patch(duelId, buildRelayAnswerPatch({ duel, value }));
  },
});

export const relayAnswerSentence = mutation({
  args: {
    duelId: v.id("duels"),
    completed: v.boolean(),
    mistakes: v.number(),
  },
  handler: async (ctx, { duelId, completed, mistakes }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "relay", "relayAnswerSentence");
    assertActive(duel);

    if (duel.relayPhase !== "answer") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Relay is not in the answer phase" });
    }
    if (playerRole !== relayAnswerer(duel)) {
      throw new ConvexError({
        code: "NOT_AUTHORIZED",
        message: "Only the assigned answerer can answer",
      });
    }
    const served = relayServedQuestion(duel);
    if (served === undefined) {
      throw new ConvexError({ code: "INTERNAL_ERROR", message: "Relay question data is missing" });
    }
    if (served.kind !== "sentence") {
      throw new ConvexError({
        code: "WRONG_QUESTION_KIND",
        message: "Use relayAnswer for word positions",
      });
    }
    validateSentenceSubmission({ completed, mistakes });

    if (duel.relayTimeoutScheduledFunctionId) {
      await ctx.scheduler.cancel(duel.relayTimeoutScheduledFunctionId);
    }

    const points = scoreSentenceSubmission({ completed, mistakes });
    const livesPatch = computeRelaySentenceLivesPatch(duel, { completed, mistakes });
    await ctx.db.patch(
      duelId,
      buildRelaySentenceAnswerPatch({ duel, completed, mistakes, points, livesPatch })
    );
  },
});

function computeRelaySentenceLivesPatch(
  duel: Doc<"duels">,
  submission: { completed: boolean; mistakes: number }
): Partial<Doc<"duels">> {
  if (!isLivesAttempt(duel)) return {};
  // Relay is normal-source-only today (see relayDuel.ts comment), so this path
  // is effectively dormant. Still implemented for parity with non-relay sentence
  // scoring so future SR/boss relay support doesn't silently skip HP.
  const livesLost = Math.max(0, submission.mistakes) + (submission.completed ? 0 : 1);
  if (livesLost === 0) return {};
  const startingLives = typeof duel.livesRemaining === "number"
    ? duel.livesRemaining
    : undefined;
  if (startingLives === undefined) return {};
  return { livesRemaining: Math.max(0, startingLives - livesLost) };
}

export const relayAdvance = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "relay", "relayAdvance");
    assertActive(duel);

    if (duel.relayPhase !== "feedback") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Relay is not in the feedback phase",
      });
    }
    if (playerRole !== relayAnswerer(duel)) {
      throw new ConvexError({
        code: "NOT_AUTHORIZED",
        message: "Only the answerer can continue",
      });
    }

    await applyRelayHandoff(ctx, duelId, duel, buildRelayAdvancePatch(duel));
  },
});

// Fast path: either client may call when its local answer timer expires. Only
// resolves when the assigned word is still unanswered and the window elapsed.
export const relayTimeout = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "relay", "relayTimeout");

    await resolveRelayTimeoutIfStale(ctx, duelId, duel, {
      expectedAssignedIndex: undefined,
      requireWindowElapsed: true,
      cancelScheduled: true,
    });
  },
});

// Scheduler backstop, set on entering the answer phase. Re-reads and force
// resolves only if the same word is still pending an answer.
export const relayTimeoutInternal = internalMutation({
  args: { duelId: v.id("duels"), expectedAssignedIndex: v.number() },
  handler: async (ctx, { duelId, expectedAssignedIndex }) => {
    const duel = await ctx.db.get(duelId);
    if (!duel) return;

    await resolveRelayTimeoutIfStale(ctx, duelId, duel, {
      expectedAssignedIndex,
      requireWindowElapsed: false,
      cancelScheduled: false,
    });
  },
});
