import type { Doc } from "../_generated/dataModel";
import { HINT_PROVIDER_BONUS } from "../constants";

export function getHintClearFields(): Partial<Doc<"duels">> {
  return {
    hintRequestedBy: undefined,
    hintAccepted: undefined,
    eliminatedOptions: undefined,
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

export function hasBossLivesLeft(duel: Doc<"duels">): boolean {
  if (typeof duel.bossLivesRemaining === "number") {
    return duel.bossLivesRemaining > 0;
  }

  return duel.challengerPerfectRun === true && duel.opponentPerfectRun === true;
}

export function getBossMissPatch(
  duel: Doc<"duels">,
  playerRole: "challenger" | "opponent"
): Partial<Doc<"duels">> {
  if (!isLivesAttempt(duel)) {
    return {};
  }

  const nextLives = typeof duel.bossLivesRemaining === "number"
    ? Math.max(0, duel.bossLivesRemaining - 1)
    : undefined;

  const patch: Partial<Doc<"duels">> = playerRole === "challenger"
    ? { challengerPerfectRun: false }
    : { opponentPerfectRun: false };

  if (nextLives === undefined) {
    return patch;
  }

  return {
    ...patch,
    bossLivesRemaining: nextLives,
    ...(nextLives === 0 ? getBossAttemptEndFields() : {}),
  };
}

export function getDuelQuestionOrThrow(
  duel: Doc<"duels">,
  questionIndex = duel.currentWordIndex
) {
  const question = duel.duelQuestions?.[questionIndex];
  if (!question) {
    throw new Error("Duel question data is missing");
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

  const currentQuestion = getDuelQuestionOrThrow(duel);
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
