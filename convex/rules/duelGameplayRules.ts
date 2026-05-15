import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { TIMEOUT_ANSWER } from "../constants";
import { forRole } from "../../lib/duelRole";
import {
  getBossMissPatch,
  getDuelQuestionOrThrow,
  getHintClearFields,
  getHintProviderBonusPatch,
  hasBossLivesLeft,
  isBossAttempt,
} from "./duelScoringRules";

type PlayerRole = "challenger" | "opponent";

export function validateActiveQuestion(
  duel: Doc<"duels">,
  questionIndex: number,
  staleCode: "STALE_ANSWER" | "STALE_TIMEOUT",
  staleMessage: string
) {
  if (duel.status !== "active") {
    throw new ConvexError({
      code: "DUEL_NOT_ACTIVE",
      message: "Duel is not active",
    });
  }

  if (duel.currentWordIndex !== questionIndex) {
    throw new ConvexError({
      code: staleCode,
      message: staleMessage,
    });
  }
}

export function buildAnswerPatch(params: {
  duel: Doc<"duels">;
  playerRole: PlayerRole;
  isChallenger: boolean;
  selectedAnswer: string;
  questionIndex: number;
}): Partial<Doc<"duels">> {
  const { duel, playerRole, isChallenger, selectedAnswer, questionIndex } = params;
  const currentQuestion = getDuelQuestionOrThrow(duel, questionIndex);
  const isCorrect = selectedAnswer === currentQuestion.correctOption;
  const roleView = forRole(duel, playerRole);

  if (roleView.myAnswered) {
    return {};
  }

  const nextScore = isCorrect
    ? roleView.myScore + currentQuestion.points
    : roleView.myScore;

  return isChallenger
    ? {
        challengerAnswered: true,
        challengerScore: nextScore,
        challengerLastAnswer: selectedAnswer,
        ...(!isCorrect ? getBossMissPatch(duel, "challenger") : {}),
      }
    : {
        opponentAnswered: true,
        opponentScore: nextScore,
        opponentLastAnswer: selectedAnswer,
        ...(!isCorrect ? getBossMissPatch(duel, "opponent") : {}),
      };
}

export function buildTimeoutPatch(params: {
  duel: Doc<"duels">;
  playerRole: PlayerRole;
  isChallenger: boolean;
}): Partial<Doc<"duels">> {
  const { duel, playerRole, isChallenger } = params;
  const roleView = forRole(duel, playerRole);

  if (roleView.myAnswered) {
    return {};
  }

  return isChallenger
    ? {
        challengerAnswered: true,
        challengerLastAnswer: TIMEOUT_ANSWER,
        ...getBossMissPatch(duel, "challenger"),
      }
    : {
        opponentAnswered: true,
        opponentLastAnswer: TIMEOUT_ANSWER,
        ...getBossMissPatch(duel, "opponent"),
      };
}

export function haveBothPlayersAnswered(duel: Doc<"duels">): boolean {
  return duel.challengerAnswered && duel.opponentAnswered;
}

export function buildNextRoundPatch(
  duel: Doc<"duels">,
  nextWordIndex: number,
  now: number
): Partial<Doc<"duels">> {
  return {
    ...getHintProviderBonusPatch(duel),
    currentWordIndex: nextWordIndex,
    challengerAnswered: false,
    opponentAnswered: false,
    questionStartTime: now,
    ...getHintClearFields(),
  };
}

export function buildFinalCompletionPatch(
  duel: Doc<"duels">,
  nextWordIndex: number
): Partial<Doc<"duels">> {
  return {
    ...getHintProviderBonusPatch(duel),
    status: "completed",
    currentWordIndex: nextWordIndex,
    challengerAnswered: false,
    opponentAnswered: false,
    questionStartTime: undefined,
    ...getHintClearFields(),
  };
}

export function shouldCompleteWeeklyGoalBoss(duel: Doc<"duels">): boolean {
  return Boolean(duel.weeklyGoalId && duel.bossType && isBossAttempt(duel) && hasBossLivesLeft(duel));
}

export function shouldCompleteSpacedRepetitionDuel(duel: Doc<"duels">): boolean {
  return duel.sourceType === "spaced_repetition";
}
