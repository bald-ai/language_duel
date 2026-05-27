/**
 * Duel session queries and lifecycle mutations.
 */

import { query, mutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v } from "convex/values";
import {
  getAuthenticatedUserOrNull,
  getDuelParticipant,
} from "./helpers/auth";
import {
  loadThemesByIds,
  summarizeSessionWords,
} from "./helpers/sessionWords";
import {
  relayRemainingPositions,
  relayServedQuestion,
} from "../lib/duel/relayEngine";

type DuelQuestion = NonNullable<Doc<"duels">["duelQuestions"]>[number];
type SessionItem = Doc<"duels">["sessionWords"][number];

function canRevealQuestionAnswer(args: {
  duel: Doc<"duels">;
  questionIndex: number;
  viewerRole: "challenger" | "opponent";
}): boolean {
  if (args.duel.status === "completed" || args.duel.status === "stopped") {
    return true;
  }

  if (args.questionIndex < args.duel.currentWordIndex) {
    return true;
  }

  if (args.questionIndex !== args.duel.currentWordIndex) {
    return false;
  }

  return args.viewerRole === "challenger"
    ? args.duel.challengerAnswered
    : args.duel.opponentAnswered;
}

/**
 * Mask the answer key on a question snapshot before shipping to the client.
 * Word questions hide `correctOption` (the per-position answer key). Sentence
 * questions ship `spanishSentence` even during active play in v1 — the client
 * uses it to validate tile taps locally so the player can build the sentence
 * without a per-tap server round-trip. The tile pool is pre-shuffled and the
 * server still re-scores from the final submission, so this is a leak of the
 * round answer text, not a leak of the play position. See HANDOFF for the
 * follow-up plan to move to per-tap server validation.
 */
type MaskedWordQuestion = Omit<Extract<DuelQuestion, { kind: "word" }>, "correctOption"> & {
  answerRevealedToViewer: false;
};
type MaskedDuelQuestion =
  | MaskedWordQuestion
  | (Extract<DuelQuestion, { kind: "sentence" }> & { answerRevealedToViewer: false });

type RevealedDuelQuestion = DuelQuestion & { answerRevealedToViewer: true };

function hideQuestionAnswer(question: DuelQuestion): MaskedDuelQuestion {
  if (question.kind === "sentence") {
    // v1 loosening: ship the spanish sentence so the client can validate taps.
    return { ...question, answerRevealedToViewer: false };
  }
  const { correctOption: _correctOption, ...safe } = question;
  return { ...safe, answerRevealedToViewer: false };
}

/**
 * Blank the answer/TTS on the session item snapshot the client sees. Word
 * items lose `answer` + `ttsStorageId`. Sentence items are passed through —
 * the client needs the prompt and theme name to render the round, and the
 * tap-time answer key lives on the question snapshot above.
 */
function maskSessionItemForActivePlay(item: SessionItem): SessionItem {
  if (item.kind === "sentence") return item;
  return { ...item, answer: "", ttsStorageId: undefined };
}

/**
 * Relay-safe DTO. The answer key (`duelQuestions`, `relayHardQuestions`) is
 * never shipped; the client only ever sees the phase-masked served question.
 * Per change (B), `sessionWords[i].answer`/`ttsStorageId` are also blanked while
 * the duel is active, since the client otherwise reads the answer from there.
 */
function buildRelaySafeDuel(duel: Doc<"duels">) {
  const isActive = duel.status === "active";

  const safeSessionWords = duel.sessionWords.map((item): SessionItem =>
    isActive ? maskSessionItemForActivePlay(item) : item
  );

  const served = relayServedQuestion(duel);
  let relayServed: RevealedDuelQuestion | MaskedDuelQuestion | null = null;
  if (served && duel.relayPhase && duel.relayPhase !== "pick") {
    // Reveal in feedback (or once the duel is over); mask during the answer
    // phase so neither the answerer nor the watching picker sees the key.
    const revealed = duel.relayPhase === "feedback" || !isActive;
    relayServed = revealed
      ? { ...served, answerRevealedToViewer: true }
      : hideQuestionAnswer(served);
  }

  const { duelQuestions: _duelQuestions, relayHardQuestions: _relayHardQuestions, ...rest } = duel;

  return {
    ...rest,
    sessionWords: safeSessionWords,
    relayServedQuestion: relayServed,
    relayRemainingPositions: relayRemainingPositions(duel),
  };
}

function buildViewerSafeDuel(duel: Doc<"duels">, viewerRole: "challenger" | "opponent") {
  if (duel.duelMode === "relay") {
    return buildRelaySafeDuel(duel);
  }

  const wordIndexBySessionIndex = new Map<number, number>();
  duel.wordOrder.forEach((sessionItemIndex, questionIndex) => {
    wordIndexBySessionIndex.set(sessionItemIndex, questionIndex);
  });

  const safeQuestions = duel.duelQuestions?.map((question, questionIndex) => {
    const canReveal = canRevealQuestionAnswer({ duel, questionIndex, viewerRole });
    return canReveal
      ? { ...question, answerRevealedToViewer: true as const }
      : hideQuestionAnswer(question);
  });
  const safeSessionWords = duel.sessionWords.map((item, sessionItemIndex): SessionItem => {
    const questionIndex = wordIndexBySessionIndex.get(sessionItemIndex);
    if (questionIndex === undefined) {
      throw new Error(
        `duel ${duel._id} sessionItem index ${sessionItemIndex} missing from wordOrder`
      );
    }
    if (canRevealQuestionAnswer({ duel, questionIndex, viewerRole })) {
      return item;
    }
    return maskSessionItemForActivePlay(item);
  });

  return {
    ...duel,
    sessionWords: safeSessionWords,
    duelQuestions: safeQuestions,
  };
}

export const getDuel = query({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const duel = await ctx.db.get(duelId);
    if (!duel) return null;

    const isChallenger = auth.user._id === duel.challengerId;
    const isOpponent = auth.user._id === duel.opponentId;
    if (!isChallenger && !isOpponent) return null;

    const [challenger, opponent] = await Promise.all([
      ctx.db.get(duel.challengerId),
      ctx.db.get(duel.opponentId),
    ]);
    const viewerRole = isChallenger ? "challenger" : "opponent";

    const themes = await loadThemesByIds(ctx, duel.themeIds);
    return {
      duel: buildViewerSafeDuel(duel, viewerRole),
      themes: themes.map((sessionTheme) => ({ _id: sessionTheme._id, name: sessionTheme.name })),
      themeSummary: summarizeSessionWords(duel.sessionWords),
      viewerRole,
      viewer: {
        _id: auth.user._id,
        name: auth.user.name,
        nickname: auth.user.nickname,
        discriminator: auth.user.discriminator,
        imageUrl: auth.user.imageUrl,
      },
      challenger: challenger
        ? {
          _id: challenger._id,
          name: challenger.name,
          nickname: challenger.nickname,
          discriminator: challenger.discriminator,
          imageUrl: challenger.imageUrl,
        }
        : null,
      opponent: opponent
        ? {
          _id: opponent._id,
          name: opponent.name,
          nickname: opponent.nickname,
          discriminator: opponent.discriminator,
          imageUrl: opponent.imageUrl,
        }
        : null,
    };
  },
});

export const stopDuel = mutation({
  args: { duelId: v.id("duels") },
  handler: async (ctx, { duelId }: { duelId: Id<"duels"> }) => {
    const { duel } = await getDuelParticipant(ctx, duelId);
    if (duel.status !== "active") return;
    await ctx.db.patch(duelId, { status: "stopped" });
  },
});
