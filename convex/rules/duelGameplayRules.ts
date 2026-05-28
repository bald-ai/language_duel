import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { TIMEOUT_ANSWER } from "../constants";
import { forRole } from "../../lib/duelRole";
import {
  getLimitedLivesMissPatch,
  getHintClearFields,
  getHintProviderBonusPatch,
  hasLivesLeft,
  isBossAttempt,
  requireWordDuelQuestion,
} from "./duelScoringRules";
import { mirrorPatchForSelfDuel } from "./selfDuelMirror";
import type { PlayerRole } from "../helpers/auth";

export function validateActiveQuestion(
  duel: Doc<"duels">,
  questionIndex: number,
  staleCode: "STALE_ANSWER" | "STALE_TIMEOUT" | "STALE_TAP",
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
  const currentQuestion = requireWordDuelQuestion(duel, questionIndex);
  const isCorrect = selectedAnswer === currentQuestion.correctOption;
  const roleView = forRole(duel, playerRole);

  if (roleView.myAnswered) {
    return {};
  }

  const nextScore = isCorrect
    ? roleView.myScore + currentQuestion.points
    : roleView.myScore;

  return mirrorPatchForSelfDuel(
    isChallenger
      ? {
          challengerAnswered: true,
          challengerScore: nextScore,
          challengerLastAnswer: selectedAnswer,
          ...(!isCorrect ? getLimitedLivesMissPatch(duel, "challenger") : {}),
        }
      : {
          opponentAnswered: true,
          opponentScore: nextScore,
          opponentLastAnswer: selectedAnswer,
          ...(!isCorrect ? getLimitedLivesMissPatch(duel, "opponent") : {}),
        },
    duel
  );
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

  return mirrorPatchForSelfDuel(
    isChallenger
      ? {
          challengerAnswered: true,
          challengerLastAnswer: TIMEOUT_ANSWER,
          ...getLimitedLivesMissPatch(duel, "challenger"),
        }
      : {
          opponentAnswered: true,
          opponentLastAnswer: TIMEOUT_ANSWER,
          ...getLimitedLivesMissPatch(duel, "opponent"),
        },
    duel
  );
}

export function haveBothPlayersAnswered(duel: Doc<"duels">): boolean {
  return duel.challengerAnswered && duel.opponentAnswered;
}

export function buildNextRoundPatch(
  duel: Doc<"duels">,
  nextWordIndex: number,
  now: number
): Partial<Doc<"duels">> {
  return mirrorPatchForSelfDuel(
    {
      ...getHintProviderBonusPatch(duel),
      currentWordIndex: nextWordIndex,
      challengerAnswered: false,
      opponentAnswered: false,
      questionStartTime: now,
      ...getHintClearFields(),
    },
    duel
  );
}

export function buildFinalCompletionPatch(
  duel: Doc<"duels">,
  nextWordIndex: number
): Partial<Doc<"duels">> {
  // Clamp the post-completion index to the last real position. Callers pass
  // `nextWordIndex` one past the end (the would-be next round); leaving it that
  // way puts `currentWordIndex` out of `duelQuestions`/`wordOrder` and the
  // client narrowing on the completed-state final-results screen then crashes
  // when the last position is a sentence (no word question to narrow to).
  const lastRealIndex = Math.max(0, nextWordIndex - 1);
  return mirrorPatchForSelfDuel(
    {
      ...getHintProviderBonusPatch(duel),
      status: "completed",
      currentWordIndex: lastRealIndex,
      challengerAnswered: false,
      opponentAnswered: false,
      questionStartTime: undefined,
      ...getHintClearFields(),
    },
    duel
  );
}

export function shouldCompleteWeeklyGoalBoss(duel: Doc<"duels">): boolean {
  return Boolean(duel.weeklyGoalId && duel.bossType && isBossAttempt(duel) && hasLivesLeft(duel));
}

export function shouldCompleteSpacedRepetitionDuel(duel: Doc<"duels">): boolean {
  return duel.sourceType === "spaced_repetition";
}
