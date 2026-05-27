import type { Doc } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { HINT_PROVIDER_BONUS } from "../constants";

export function getHintClearFields(): Partial<Doc<"duels">> {
  return {
    hintRequestedBy: undefined,
    hintAccepted: undefined,
    eliminatedOptions: undefined,
    currentQuestionHintFired: false,
    currentQuestionHintReveal: undefined,
    questionTimerPausedAt: undefined,
    questionTimerPausedBy: undefined,
    countdownPausedBy: undefined,
    countdownUnpauseRequestedBy: undefined,
    countdownPausedAt: undefined,
    countdownSkipRequestedBy: undefined,
  };
}

export function getBossAttemptEndFields(): Partial<Doc<"duels">> {
  return {
    status: "completed",
    questionStartTime: undefined,
    questionTimerPausedAt: undefined,
    ...getHintClearFields(),
  };
}

export function isBossAttempt(duel: Doc<"duels">): boolean {
  return Boolean(duel.weeklyGoalId && duel.bossType);
}

export function isLivesAttempt(duel: Doc<"duels">): boolean {
  return isBossAttempt(duel) || duel.sourceType === "spaced_repetition";
}

export function hasLivesLeft(duel: Doc<"duels">): boolean {
  if (typeof duel.livesRemaining === "number") {
    return duel.livesRemaining > 0;
  }

  return duel.challengerPerfectRun === true && duel.opponentPerfectRun === true;
}

export function getLimitedLivesMissPatch(
  duel: Doc<"duels">,
  playerRole: "challenger" | "opponent"
): Partial<Doc<"duels">> {
  if (!isLivesAttempt(duel)) {
    return {};
  }

  const nextLives = typeof duel.livesRemaining === "number"
    ? Math.max(0, duel.livesRemaining - 1)
    : undefined;

  const patch: Partial<Doc<"duels">> = playerRole === "challenger"
    ? { challengerPerfectRun: false }
    : { opponentPerfectRun: false };

  if (nextLives === undefined) {
    return patch;
  }

  return {
    ...patch,
    livesRemaining: nextLives,
    ...(nextLives === 0 ? getBossAttemptEndFields() : {}),
  };
}

export function getDuelQuestionOrThrow(
  duel: Doc<"duels">,
  questionIndex = duel.currentWordIndex
) {
  const question = duel.duelQuestions?.[questionIndex];
  if (!question) {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "Duel question data is missing" });
  }
  return question;
}

/**
 * Narrow a duel question to its word variant or reject. Use in word-only
 * gameplay paths (answerDuel, hint-provider bonus, etc.) so a sentence position
 * surfaces as an explicit "wrong mutation" error rather than crashing on
 * `correctOption` being undefined.
 */
export function requireWordDuelQuestion(
  duel: Doc<"duels">,
  questionIndex = duel.currentWordIndex
) {
  const question = getDuelQuestionOrThrow(duel, questionIndex);
  if (question.kind !== "word") {
    throw new ConvexError({
      code: "WRONG_QUESTION_KIND",
      message: "This duel position is a sentence round. Use answerSentenceRound instead.",
    });
  }
  return question;
}

export function getHintProviderBonusPatch(
  duel: Doc<"duels">
): Partial<Doc<"duels">> {
  if (
    duel.hintAccepted !== true ||
    !duel.hintRequestedBy ||
    (duel.eliminatedOptions?.length || 0) === 0
  ) {
    return {};
  }

  // Hint provider bonus is a word-only mechanic; the hint pool itself doesn't
  // mount on sentence rounds (plan decision: mixed session behavior). If we
  // somehow get called on a sentence position, no bonus.
  const currentQuestion = getDuelQuestionOrThrow(duel);
  if (currentQuestion.kind !== "word") {
    return {};
  }
  const requesterLastAnswer = duel.hintRequestedBy === "challenger"
    ? duel.challengerLastAnswer
    : duel.opponentLastAnswer;

  if (requesterLastAnswer !== currentQuestion.correctOption) {
    return {};
  }

  if (duel.hintRequestedBy === "challenger") {
    return {
      opponentScore: (duel.opponentScore || 0) + HINT_PROVIDER_BONUS,
    };
  }

  return {
    challengerScore: (duel.challengerScore || 0) + HINT_PROVIDER_BONUS,
  };
}
