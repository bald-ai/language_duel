import type { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { SEED_XOR_MASK } from "../constants";
import { createShuffledWordOrder } from "./gameLogic";
import { buildDuelQuestionSet, type DuelQuestionSnapshot } from "../../lib/answerShuffle";
import {
  getUniqueThemeIds,
  type SessionWordEntry,
} from "../../lib/sessionWords";
import type { BossType } from "../../lib/limitedLives";
import type { DuelDifficultyPreset } from "../../lib/difficultyUtils";
import type { DuelMode } from "../../lib/duelMode";
import type { HintType } from "../../lib/hintPool/types";

export type DuelSourceType = "normal" | "boss" | "spaced_repetition";
export type SoloPracticeSourceType = "weekly_goal" | "boss" | "spaced_repetition";

export type NormalDuelSourceFields = {
  sourceType: "normal";
  weeklyGoalId?: never;
  bossType?: never;
  spacedRepetitionStep?: never;
};

export type BossDuelSourceFields = {
  sourceType: "boss";
  weeklyGoalId: Id<"weeklyGoals">;
  bossType: BossType;
  spacedRepetitionStep?: never;
};

export type SpacedRepetitionDuelSourceFields = {
  sourceType: "spaced_repetition";
  weeklyGoalId: Id<"weeklyGoals">;
  bossType?: never;
  spacedRepetitionStep: number;
};

export type DuelSourceFields =
  | NormalDuelSourceFields
  | BossDuelSourceFields
  | SpacedRepetitionDuelSourceFields;

export type WeeklyGoalSoloSourceFields = {
  sourceType: "weekly_goal";
  weeklyGoalId: Id<"weeklyGoals">;
  bossType?: never;
  spacedRepetitionStep?: never;
};

export type BossSoloSourceFields = {
  sourceType: "boss";
  weeklyGoalId: Id<"weeklyGoals">;
  bossType: BossType;
  spacedRepetitionStep?: never;
};

export type SpacedRepetitionSoloSourceFields = {
  sourceType: "spaced_repetition";
  weeklyGoalId: Id<"weeklyGoals">;
  bossType?: never;
  spacedRepetitionStep: number;
};

export type SoloPracticeSourceFields =
  | WeeklyGoalSoloSourceFields
  | BossSoloSourceFields
  | SpacedRepetitionSoloSourceFields;

export interface ChallengeInviteFields {
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  sourceType: DuelSourceType;
  weeklyGoalId?: Id<"weeklyGoals">;
  bossType?: BossType;
  spacedRepetitionStep?: number;
  status: "pending";
  duelDifficultyPreset?: DuelDifficultyPreset;
  duelMode: DuelMode;
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
  bossType?: BossType;
  spacedRepetitionStep?: number;
  livesTotal?: number;
  livesRemaining?: number;
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
  duelMode: DuelMode;
  questionStartTime: number;
  hintPoolUsed: HintType[];
  currentQuestionHintFired: boolean;
  seed: number;
}

export interface SoloPracticeSessionFields {
  userId: Id<"users">;
  themeIds: Id<"themes">[];
  sessionWords: SessionWordEntry[];
  sourceType: SoloPracticeSourceType;
  weeklyGoalId: Id<"weeklyGoals">;
  bossType?: BossType;
  spacedRepetitionStep?: number;
  status: "learning" | "practicing";
  createdAt: number;
}

function resolveDuelDifficultyPreset(preset?: DuelDifficultyPreset): DuelDifficultyPreset {
  return preset ?? "easy";
}

function validateDuelMode(mode: DuelMode) {
  if (mode !== "pvp" && mode !== "pve") {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Invalid duel mode" });
  }
}

function validateDuelSourceFields(args: DuelSourceFields) {
  if (args.sourceType === "normal") {
    if (args.weeklyGoalId || args.bossType || args.spacedRepetitionStep !== undefined) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Normal duel sessions cannot include weekly-goal source fields" });
    }
    return;
  }

  if (!args.weeklyGoalId) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Weekly-goal duel sessions require weeklyGoalId" });
  }

  if (args.sourceType === "boss") {
    if (!args.bossType || args.spacedRepetitionStep !== undefined) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Boss duel sessions require bossType and cannot include spacedRepetitionStep" });
    }
    return;
  }

  if (args.bossType || typeof args.spacedRepetitionStep !== "number") {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Spaced-repetition duel sessions require spacedRepetitionStep and cannot include bossType" });
  }
}

function validateSoloPracticeSourceFields(args: SoloPracticeSourceFields) {
  if (args.sourceType === "weekly_goal") {
    if (args.bossType || args.spacedRepetitionStep !== undefined) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Weekly-goal solo practice cannot include boss or repetition fields" });
    }
    return;
  }

  if (args.sourceType === "boss") {
    if (!args.bossType || args.spacedRepetitionStep !== undefined) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Boss solo practice requires bossType and cannot include spacedRepetitionStep" });
    }
    return;
  }

  if (args.bossType || typeof args.spacedRepetitionStep !== "number") {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Spaced-repetition solo practice requires spacedRepetitionStep and cannot include bossType" });
  }
}

export function buildChallengeInvite(args: {
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  duelDifficultyPreset?: DuelDifficultyPreset;
  duelMode: DuelMode;
  createdAt: number;
} & DuelSourceFields): ChallengeInviteFields {
  if (args.challengerId === args.opponentId) {
    throw new ConvexError({ code: "CANNOT_SELF_TARGET", message: "Cannot challenge yourself" });
  }

  const themeIds = Array.from(new Set(args.themeIds));
  if (themeIds.length === 0) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Challenge requires at least one theme" });
  }
  validateDuelSourceFields(args);
  validateDuelMode(args.duelMode);

  return {
    challengerId: args.challengerId,
    opponentId: args.opponentId,
    themeIds,
    sourceType: args.sourceType,
    weeklyGoalId: args.weeklyGoalId,
    bossType: args.bossType,
    spacedRepetitionStep: args.spacedRepetitionStep,
    status: "pending",
    duelDifficultyPreset: resolveDuelDifficultyPreset(args.duelDifficultyPreset),
    duelMode: args.duelMode,
    createdAt: args.createdAt,
  };
}

export function buildDuelSession(args: {
  challengeId?: Id<"challenges">;
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  sessionWords: SessionWordEntry[];
  livesTotal?: number;
  livesRemaining?: number;
  duelDifficultyPreset?: DuelDifficultyPreset;
  duelMode: DuelMode;
  createdAt: number;
} & DuelSourceFields): DuelSessionFields {
  const sessionWords = [...args.sessionWords];
  if (sessionWords.length === 0) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Duel requires at least one session word" });
  }
  validateDuelSourceFields(args);
  validateDuelMode(args.duelMode);

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
    livesTotal: args.livesTotal,
    livesRemaining: args.livesRemaining,
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
    duelMode: args.duelMode,
    questionStartTime: args.createdAt,
    hintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: args.createdAt ^ SEED_XOR_MASK,
  };
}

export function buildSoloPracticeSession(args: {
  userId: Id<"users">;
  sessionWords: SessionWordEntry[];
  startsInLearning: boolean;
  createdAt: number;
} & SoloPracticeSourceFields): SoloPracticeSessionFields {
  const sessionWords = [...args.sessionWords];
  if (sessionWords.length === 0) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Solo practice requires at least one session word" });
  }
  validateSoloPracticeSourceFields(args);

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
