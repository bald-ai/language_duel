import type { Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";
import { SEED_XOR_MASK } from "../constants";
import { createShuffledItemOrder } from "./shuffle";
import {
  buildDuelQuestionSet,
  buildRelayQuestionSet,
  type DuelQuestionSnapshot,
} from "../../lib/answerShuffle";
import {
  buildInitialRelayState,
  type RelayInitialState,
} from "../../lib/duel/relayEngine";
import {
  buildInitialTbtState,
  type TbtInitialState,
} from "../../lib/duel/tbtEngine";
import {
  getUniqueThemeIds,
  isSessionSentenceItem,
  type SessionItem,
} from "../../lib/sessionItems";
import type { BossType } from "../../lib/limitedLives";
import type { DuelDifficultyPreset } from "../../lib/difficultyUtils";
import { DUEL_MODE_LABELS, type DuelMode } from "../../lib/duelMode";
import type { HintType } from "../../lib/hintPool/types";
import type { SentenceHintType } from "../../lib/sentenceGameplay/hints";

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

export interface DuelSessionFields
  extends Partial<RelayInitialState>,
    Partial<TbtInitialState> {
  challengeId?: Id<"challenges">;
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  sessionItems: SessionItem[];
  sourceType: DuelSourceType;
  weeklyGoalId?: Id<"weeklyGoals">;
  bossType?: BossType;
  spacedRepetitionStep?: number;
  livesTotal?: number;
  livesRemaining?: number;
  status: "active";
  createdAt: number;
  currentWordIndex: number;
  itemOrder: number[];
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
  sentenceHintPoolUsed: SentenceHintType[];
  currentQuestionHintFired: boolean;
  seed: number;
}

export interface SoloPracticeSessionFields {
  userId: Id<"users">;
  themeIds: Id<"themes">[];
  sessionItems: SessionItem[];
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

/**
 * Narrow a challenge's loosely-typed source columns (independent optionals on
 * the `challenges` doc) into a typed discriminated `DuelSourceFields` once, so
 * `buildDuelSession` callers don't each re-check the per-source invariants.
 */
export function challengeToDuelSourceFields(source: {
  sourceType: DuelSourceType;
  weeklyGoalId?: Id<"weeklyGoals">;
  bossType?: BossType;
  spacedRepetitionStep?: number;
}): DuelSourceFields {
  if (source.sourceType === "boss") {
    if (!source.weeklyGoalId || !source.bossType) {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Boss challenge is missing source fields" });
    }
    return {
      sourceType: "boss",
      weeklyGoalId: source.weeklyGoalId,
      bossType: source.bossType,
    };
  }

  if (source.sourceType === "spaced_repetition") {
    if (!source.weeklyGoalId || typeof source.spacedRepetitionStep !== "number") {
      throw new ConvexError({ code: "INVALID_INPUT", message: "Spaced-repetition challenge is missing source fields" });
    }
    return {
      sourceType: "spaced_repetition",
      weeklyGoalId: source.weeklyGoalId,
      spacedRepetitionStep: source.spacedRepetitionStep,
    };
  }

  return { sourceType: "normal" };
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
  sessionItems: SessionItem[];
  livesTotal?: number;
  livesRemaining?: number;
  duelDifficultyPreset?: DuelDifficultyPreset;
  duelMode: DuelMode;
  createdAt: number;
} & DuelSourceFields): DuelSessionFields {
  const sessionItems = [...args.sessionItems];
  if (sessionItems.length === 0) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Duel requires at least one session word" });
  }
  validateDuelSourceFields(args);

  const duelDifficultyPreset = resolveDuelDifficultyPreset(args.duelDifficultyPreset);
  const itemOrder = createShuffledItemOrder(sessionItems.length);

  // Relay serves a flat-point medium snapshot per position (decision #11) and
  // carries its own turn/budget state; other modes use the progressive set.
  const isRelay = args.duelMode === "relay";
  const isTbt = args.duelMode === "tbt";

  // TbT shares one sentence board, so the whole deck must be sentence items.
  // Reject a mixed/word deck at creation rather than failing mid-duel.
  if (isTbt && sessionItems.some((item) => !isSessionSentenceItem(item))) {
    throw new ConvexError({
      code: "TBT_REQUIRES_SENTENCES",
      message: `${DUEL_MODE_LABELS.tbt} duels require an all-sentence deck`,
    });
  }

  const duelQuestions = isRelay
    ? buildRelayQuestionSet(sessionItems, itemOrder, "medium")
    : buildDuelQuestionSet(sessionItems, itemOrder, duelDifficultyPreset);
  const relayState = isRelay ? buildInitialRelayState(sessionItems, itemOrder) : {};
  // TbT tracks whose turn it is on the shared board; the opener of sentence 0
  // goes first. Empty for every other mode.
  const tbtState = isTbt ? buildInitialTbtState() : {};

  return {
    ...relayState,
    ...tbtState,
    challengeId: args.challengeId,
    challengerId: args.challengerId,
    opponentId: args.opponentId,
    themeIds: getUniqueThemeIds(sessionItems),
    sessionItems,
    sourceType: args.sourceType,
    weeklyGoalId: args.weeklyGoalId,
    bossType: args.bossType,
    spacedRepetitionStep: args.spacedRepetitionStep,
    livesTotal: args.livesTotal,
    livesRemaining: args.livesRemaining,
    status: "active",
    createdAt: args.createdAt,
    currentWordIndex: 0,
    itemOrder,
    duelQuestions,
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
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: args.createdAt ^ SEED_XOR_MASK,
  };
}

export function buildSoloPracticeSession(args: {
  userId: Id<"users">;
  sessionItems: SessionItem[];
  startsInLearning: boolean;
  createdAt: number;
} & SoloPracticeSourceFields): SoloPracticeSessionFields {
  const sessionItems = [...args.sessionItems];
  if (sessionItems.length === 0) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Solo practice requires at least one session word" });
  }
  // Solo practice is word-only in v1 (plan decision: modes — only duel-style
  // modes support sentence rounds). Sentence themes must be played via duel /
  // self-duel paths instead. Catch this here so the gameplay code below can
  // safely treat session items as word entries.
  if (sessionItems.some(isSessionSentenceItem)) {
    throw new ConvexError({
      code: "INVALID_INPUT",
      message: "Solo practice does not support sentence themes yet. Use a duel instead.",
    });
  }
  validateSoloPracticeSourceFields(args);

  return {
    userId: args.userId,
    themeIds: getUniqueThemeIds(sessionItems),
    sessionItems,
    sourceType: args.sourceType,
    weeklyGoalId: args.weeklyGoalId,
    bossType: args.bossType,
    spacedRepetitionStep: args.spacedRepetitionStep,
    status: args.startsInLearning ? "learning" : "practicing",
    createdAt: args.createdAt,
  };
}
