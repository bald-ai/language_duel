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
type SessionWord = Doc<"duels">["sessionWords"][number];

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

function hideQuestionAnswer(question: DuelQuestion): Omit<DuelQuestion, "correctOption"> & {
  answerRevealedToViewer: false;
} {
  const { correctOption: _correctOption, ...safeQuestion } = question;
  return { ...safeQuestion, answerRevealedToViewer: false };
}

/**
 * Relay-safe DTO. The answer key (`duelQuestions`, `relayHardQuestions`) is
 * never shipped; the client only ever sees the phase-masked served question.
 * Per change (B), `sessionWords[i].answer`/`ttsStorageId` are also blanked while
 * the duel is active, since the client otherwise reads the answer from there.
 */
function buildRelaySafeDuel(duel: Doc<"duels">) {
  const isActive = duel.status === "active";

  const safeSessionWords = duel.sessionWords.map((word): SessionWord =>
    isActive ? { ...word, answer: "", ttsStorageId: undefined } : word
  );

  const served = relayServedQuestion(duel);
  let relayServed:
    | (DuelQuestion & { answerRevealedToViewer: true })
    | (Omit<DuelQuestion, "correctOption"> & { answerRevealedToViewer: false })
    | null = null;
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
  duel.wordOrder.forEach((sessionWordIndex, questionIndex) => {
    wordIndexBySessionIndex.set(sessionWordIndex, questionIndex);
  });

  const safeQuestions = duel.duelQuestions?.map((question, questionIndex) => {
    const canReveal = canRevealQuestionAnswer({ duel, questionIndex, viewerRole });
    return canReveal
      ? { ...question, answerRevealedToViewer: true }
      : hideQuestionAnswer(question);
  });
  const safeSessionWords = duel.sessionWords.map((word, sessionWordIndex): SessionWord => {
    const questionIndex = wordIndexBySessionIndex.get(sessionWordIndex);
    if (questionIndex === undefined) {
      throw new Error(
        `duel ${duel._id} sessionWord index ${sessionWordIndex} missing from wordOrder`
      );
    }
    if (canRevealQuestionAnswer({ duel, questionIndex, viewerRole })) {
      return word;
    }

    return {
      ...word,
      answer: "",
      ttsStorageId: undefined,
    };
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
