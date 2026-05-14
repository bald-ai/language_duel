import type { Id } from "../_generated/dataModel";
import { SEED_XOR_MASK } from "../constants";
import { createShuffledWordOrder, type DuelDifficultyPreset } from "./gameLogic";
import { buildDuelQuestionSet, type DuelQuestionSnapshot } from "../../lib/answerShuffle";
import {
  getUniqueThemeIds,
  type SessionWordEntry,
} from "../../lib/sessionWords";

export type DuelSourceType = "normal" | "boss" | "spaced_repetition";
export type SoloPracticeSourceType = "weekly_goal" | "boss" | "spaced_repetition";

export interface ChallengeInviteFields {
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  sourceType: DuelSourceType;
  weeklyGoalId?: Id<"weeklyGoals">;
  bossType?: "mini" | "big";
  spacedRepetitionStep?: number;
  status: "pending";
  duelDifficultyPreset?: DuelDifficultyPreset;
  createdAt: number;
}

export interface DuelSessionFields {
  challengeId?: Id<"challenges">;
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  sessionWords: SessionWordEntry[];
  sourceType: DuelSourceType;
  weeklyGoalId?: Id<"weeklyGoals">;
  bossType?: "mini" | "big";
  spacedRepetitionStep?: number;
  bossLivesTotal?: number;
  bossLivesRemaining?: number;
  status: "active";
  createdAt: number;
  currentWordIndex: number;
  wordOrder: number[];
  duelQuestions: DuelQuestionSnapshot[];
  challengerAnswered: boolean;
  opponentAnswered: boolean;
  challengerScore: number;
  opponentScore: number;
  challengerPerfectRun?: boolean;
  opponentPerfectRun?: boolean;
  duelDifficultyPreset: DuelDifficultyPreset;
  questionStartTime: number;
  seed: number;
}

export interface SoloPracticeSessionFields {
  userId: Id<"users">;
  themeIds: Id<"themes">[];
  sessionWords: SessionWordEntry[];
  sourceType: SoloPracticeSourceType;
  weeklyGoalId: Id<"weeklyGoals">;
  bossType?: "mini" | "big";
  spacedRepetitionStep?: number;
  status: "learning" | "practicing";
  createdAt: number;
}

function resolveDuelDifficultyPreset(preset?: DuelDifficultyPreset): DuelDifficultyPreset {
  return preset ?? "easy";
}

export function buildChallengeInvite(args: {
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  sourceType?: DuelSourceType;
  weeklyGoalId?: Id<"weeklyGoals">;
  bossType?: "mini" | "big";
  spacedRepetitionStep?: number;
  duelDifficultyPreset?: DuelDifficultyPreset;
  createdAt: number;
}): ChallengeInviteFields {
  if (args.challengerId === args.opponentId) {
    throw new Error("Cannot challenge yourself");
  }

  const themeIds = Array.from(new Set(args.themeIds));
  if (themeIds.length === 0) {
    throw new Error("Challenge requires at least one theme");
  }

  return {
    challengerId: args.challengerId,
    opponentId: args.opponentId,
    themeIds,
    sourceType: args.sourceType ?? "normal",
    weeklyGoalId: args.weeklyGoalId,
    bossType: args.bossType,
    spacedRepetitionStep: args.spacedRepetitionStep,
    status: "pending",
    duelDifficultyPreset: resolveDuelDifficultyPreset(args.duelDifficultyPreset),
    createdAt: args.createdAt,
  };
}

export function buildDuelSession(args: {
  challengeId?: Id<"challenges">;
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  sessionWords: SessionWordEntry[];
  sourceType: DuelSourceType;
  weeklyGoalId?: Id<"weeklyGoals">;
  bossType?: "mini" | "big";
  spacedRepetitionStep?: number;
  bossLivesTotal?: number;
  bossLivesRemaining?: number;
  duelDifficultyPreset?: DuelDifficultyPreset;
  createdAt: number;
}): DuelSessionFields {
  const sessionWords = [...args.sessionWords];
  if (sessionWords.length === 0) {
    throw new Error("Duel requires at least one session word");
  }

  const duelDifficultyPreset = resolveDuelDifficultyPreset(args.duelDifficultyPreset);
  const wordOrder = createShuffledWordOrder(sessionWords.length);

  return {
    challengeId: args.challengeId,
    challengerId: args.challengerId,
    opponentId: args.opponentId,
    themeIds: getUniqueThemeIds(sessionWords),
    sessionWords,
    sourceType: args.sourceType,
    weeklyGoalId: args.weeklyGoalId,
    bossType: args.bossType,
    spacedRepetitionStep: args.spacedRepetitionStep,
    bossLivesTotal: args.bossLivesTotal,
    bossLivesRemaining: args.bossLivesRemaining,
    status: "active",
    createdAt: args.createdAt,
    currentWordIndex: 0,
    wordOrder,
    duelQuestions: buildDuelQuestionSet(sessionWords, wordOrder, duelDifficultyPreset),
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    challengerPerfectRun: args.sourceType === "normal" ? undefined : true,
    opponentPerfectRun: args.sourceType === "normal" ? undefined : true,
    duelDifficultyPreset,
    questionStartTime: args.createdAt,
    seed: args.createdAt ^ SEED_XOR_MASK,
  };
}

export function buildSoloPracticeSession(args: {
  userId: Id<"users">;
  sessionWords: SessionWordEntry[];
  sourceType: SoloPracticeSourceType;
  weeklyGoalId: Id<"weeklyGoals">;
  bossType?: "mini" | "big";
  spacedRepetitionStep?: number;
  startsInLearning: boolean;
  createdAt: number;
}): SoloPracticeSessionFields {
  const sessionWords = [...args.sessionWords];
  if (sessionWords.length === 0) {
    throw new Error("Solo practice requires at least one session word");
  }

  return {
    userId: args.userId,
    themeIds: getUniqueThemeIds(sessionWords),
    sessionWords,
    sourceType: args.sourceType,
    weeklyGoalId: args.weeklyGoalId,
    bossType: args.bossType,
    spacedRepetitionStep: args.spacedRepetitionStep,
    status: args.startsInLearning ? "learning" : "practicing",
    createdAt: args.createdAt,
  };
}
