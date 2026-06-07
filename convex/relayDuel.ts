/**
 * Relay-duel mutations. Turn-based: the picker hands a round to the rival, who
 * answers it (or times out), then becomes the next picker. Scoring and turn
 * state live entirely in the relay-specific fields; this never routes through
 * the both-answered advance used by PvP/PvE.
 */

import { mutation, internalMutation, type MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getDuelParticipant, type PlayerRole } from "./helpers/auth";
import { assertDuelMode } from "./rules/duelModeGuards";
import { RELAY_QUESTION_POINTS } from "../lib/duelConstants";
import {
  buildRelayAdvancePatch,
  buildRelayAnswerPatch,
  buildRelayPickPatch,
  buildRelayTimeoutPatch,
  isRelayFinished,
  relayAnswerer,
  relayAnswerWindowMs,
  relayRemainingPositions,
  relayServedQuestion,
} from "../lib/duel/relayEngine";
import {
  appendSentenceTile,
  removeLastSentenceTile,
  clearSentenceBoard,
  confirmSentenceRound,
} from "./rules/sentenceGameplayRules";

function assertActive(duel: Doc<"duels">) {
  if (duel.status !== "active") {
    throw new ConvexError({ code: "DUEL_NOT_ACTIVE", message: "Duel is not active" });
  }
}

/**
 * Apply a hand-off patch (advance or timeout), completing the duel inline when
 * it was the final round. Completion is relay-local: no lifecycle scheduler is
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
    // Sentence positions get the longer 60s window; words keep 21s.
    if (Date.now() - startedAt < relayAnswerWindowMs(duel)) return;
  }

  if (opts.cancelScheduled && duel.relayTimeoutScheduledFunctionId) {
    await ctx.scheduler.cancel(duel.relayTimeoutScheduledFunctionId);
  }

  await applyRelayHandoff(ctx, duelId, duel, buildRelayTimeoutPatch(duel));
}

export const relayPick = mutation({
  args: {
    duelId: v.id("duels"),
    position: v.number(),
    hardUpgrade: v.boolean(),
  },
  handler: async (ctx, { duelId, position, hardUpgrade }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    assertDuelMode(duel, "relay", "relayPick");
    assertActive(duel);

    if (duel.relayPhase !== "pick") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Relay is not in the pick phase" });
    }
    if (playerRole !== duel.relayPicker) {
      throw new ConvexError({
        code: "NOT_AUTHORIZED",
        message: "Only the picker can hand over a round",
      });
    }
    if (!relayRemainingPositions(duel).includes(position)) {
      throw new ConvexError({ code: "INVALID_STATE", message: "That round is no longer available" });
    }

    // 🔥 hard-upgrade is disabled on sentence positions in v1 (decision #3):
    // keeping sentences at a fixed pool is what makes the served board equal the
    // validated board (plan R1). The toggle is also hidden client-side.
    const pickedItem = duel.sessionItems[duel.itemOrder[position]];
    const isSentence = pickedItem?.kind === "sentence";
    if (hardUpgrade && isSentence) {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Sentence rounds can't be hard-upgraded",
      });
    }
    if (hardUpgrade) {
      if ((duel.relayHardBudget?.[playerRole] ?? 0) <= 0) {
        throw new ConvexError({ code: "INVALID_STATE", message: "No hard-upgrade budget left" });
      }
    }

    const now = Date.now();
    const pickPatch = buildRelayPickPatch({ duel, position, hardUpgrade, now });

    // Server-side backstop: a both-client disconnect can't stall the answer
    // phase forever (no stale-duel cron exists). Cancelled on a timely answer.
    // The window depends on the picked kind — sentences get the longer 60s.
    const windowMs = relayAnswerWindowMs({ ...duel, ...pickPatch });
    const scheduledId = await ctx.scheduler.runAfter(
      windowMs,
      internal.relayDuel.relayTimeoutInternal,
      { duelId, expectedAssignedIndex: position }
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
    // `relayAnswer` is the word-only MC path. Sentence positions route through
    // `relaySentenceConfirm` instead, so a sentence served question here means a
    // stale/buggy client hit the wrong mutation — reject it.
    if (served.kind !== "word") {
      throw new ConvexError({
        code: "WRONG_QUESTION_KIND",
        message: "Sentence relay positions are answered via relaySentenceConfirm",
      });
    }

    if (duel.relayTimeoutScheduledFunctionId) {
      await ctx.scheduler.cancel(duel.relayTimeoutScheduledFunctionId);
    }

    await ctx.db.patch(duelId, buildRelayAnswerPatch({ duel, value }));
  },
});

/**
 * Shared guard for the relay sentence build mutations: relay mode, active duel,
 * answer phase, caller is the assigned answerer, and the served position is a
 * sentence. Returns the `questionIndex` (= `relayAssignedIndex`) the pure
 * sentence functions expect. The picker (or a stale client) is rejected here so
 * only the answerer can drive the board (plan R3).
 */
function assertRelaySentenceTurn(
  duel: Doc<"duels">,
  playerRole: PlayerRole,
  action: string
): number {
  assertDuelMode(duel, "relay", action);
  assertActive(duel);
  if (duel.relayPhase !== "answer") {
    throw new ConvexError({ code: "INVALID_STATE", message: "Relay is not in the answer phase" });
  }
  if (playerRole !== relayAnswerer(duel)) {
    throw new ConvexError({
      code: "NOT_AUTHORIZED",
      message: "Only the assigned answerer can build the sentence",
    });
  }
  const served = relayServedQuestion(duel);
  if (served?.kind !== "sentence") {
    throw new ConvexError({
      code: "WRONG_QUESTION_KIND",
      message: "The served relay position is not a sentence round",
    });
  }
  if (duel.relayAssignedIndex === undefined) {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Relay question data is missing" });
  }
  return duel.relayAssignedIndex;
}

// Relay sentence board: tap / peel / reset reuse the build-and-confirm pure
// functions with `questionIndex = relayAssignedIndex` and `role = answerer`. A
// sentence is always served from the base set (`duelQuestions[idx]`, 🔥 is
// disabled on sentences), exactly what those functions read.
export const relaySentenceTap = mutation({
  args: { duelId: v.id("duels"), tileIndex: v.number() },
  handler: async (ctx, { duelId, tileIndex }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const questionIndex = assertRelaySentenceTurn(duel, playerRole, "relaySentenceTap");
    const { patch } = appendSentenceTile({ duel, questionIndex, role: playerRole, tileIndex });
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(duelId, patch);
    }
  },
});

export const relaySentenceRemoveLast = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const questionIndex = assertRelaySentenceTurn(duel, playerRole, "relaySentenceRemoveLast");
    const { patch } = removeLastSentenceTile({ duel, questionIndex, role: playerRole });
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(duelId, patch);
    }
  },
});

export const relaySentenceReset = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const questionIndex = assertRelaySentenceTurn(duel, playerRole, "relaySentenceReset");
    const { patch } = clearSentenceBoard({ duel, questionIndex, role: playerRole });
    if (Object.keys(patch).length > 0) {
      await ctx.db.patch(duelId, patch);
    }
  },
});

/**
 * The relay sentence scoring point. Forgiving completion: building the sentence
 * correctly within the timer awards the flat relay point, no matter how many
 * Confirms it took (`failedConfirms` is tracked by the reused pure fn but does
 * not affect the relay score). Like PvP, a Confirm returns the per-tile
 * `correctnessMask` so the answerer sees which words are right/wrong; a wrong
 * Confirm stays in the answer phase to retry.
 */
export const relaySentenceConfirm = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const { duel, playerRole } = await getDuelParticipant(ctx, duelId);
    const questionIndex = assertRelaySentenceTurn(duel, playerRole, "relaySentenceConfirm");

    const { patch: progressPatch, result } = confirmSentenceRound({
      duel,
      questionIndex,
      role: playerRole,
    });

    if (!result.completed) {
      // Wrong Confirm: record the attempt and stay in the answer phase to retry.
      if (Object.keys(progressPatch).length > 0) {
        await ctx.db.patch(duelId, progressPatch);
      }
      return { completed: false, correctnessMask: result.correctnessMask };
    }

    // Correct build (within the timer): award the flat relay point and advance
    // to feedback. Cancel the scheduled-timeout backstop first.
    if (duel.relayTimeoutScheduledFunctionId) {
      await ctx.scheduler.cancel(duel.relayTimeoutScheduledFunctionId);
    }
    await ctx.db.patch(duelId, {
      ...progressPatch,
      relayPhase: "feedback" as const,
      relayAnswerStartedAt: undefined,
      relayTimeoutScheduledFunctionId: undefined,
      relayLastResult: {
        position: questionIndex,
        chosen: "",
        correct: true,
        scorer: playerRole,
      },
      ...(playerRole === "challenger"
        ? { challengerScore: duel.challengerScore + RELAY_QUESTION_POINTS }
        : { opponentScore: duel.opponentScore + RELAY_QUESTION_POINTS }),
    });
    return { completed: true, correctnessMask: result.correctnessMask };
  },
});

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
// resolves when the assigned round is still unanswered and the window elapsed.
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
// resolves only if the same round is still pending an answer.
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
