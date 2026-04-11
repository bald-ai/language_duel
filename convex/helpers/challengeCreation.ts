import type { Id } from "../_generated/dataModel";
import { SEED_XOR_MASK } from "../constants";
import { buildSoloInitState, type SoloInitState } from "./duelInitialization";
import { createShuffledWordOrder, type ClassicDifficultyPreset } from "./gameLogic";
import {
  buildSessionWords,
  getUniqueThemeIds,
  type SessionThemeInput,
  type SessionWordEntry,
} from "../../lib/sessionWords";

export type ChallengeMode = "solo" | "classic";

export interface BuildChallengeBaseArgs {
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  themes: SessionThemeInput[];
  createdAt: number;
  mode?: ChallengeMode;
  classicDifficultyPreset?: ClassicDifficultyPreset;
}

export interface ChallengeBaseFields {
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  sessionWords: SessionWordEntry[];
  currentWordIndex: number;
  wordOrder: number[];
  challengerAnswered: boolean;
  opponentAnswered: boolean;
  challengerScore: number;
  opponentScore: number;
  mode: ChallengeMode;
  classicDifficultyPreset?: ClassicDifficultyPreset;
  createdAt: number;
}

export type ChallengeStartState =
  | {
    status: "accepted";
    questionStartTime: number;
    seed: number;
  }
  | ({
    status: "challenging";
    questionStartTime: number;
  } & SoloInitState);

export function resolveChallengeMode(mode?: ChallengeMode): ChallengeMode {
  return mode ?? "solo";
}

export function resolveClassicDifficultyPreset(
  mode: ChallengeMode,
  classicDifficultyPreset?: ClassicDifficultyPreset
): ClassicDifficultyPreset | undefined {
  return mode === "classic" ? classicDifficultyPreset ?? "easy" : undefined;
}

export function buildChallengeBase(args: BuildChallengeBaseArgs): ChallengeBaseFields {
  const mode = resolveChallengeMode(args.mode);
  const sessionWords = buildSessionWords(args.themes);

  return {
    challengerId: args.challengerId,
    opponentId: args.opponentId,
    themeIds: getUniqueThemeIds(sessionWords),
    sessionWords,
    currentWordIndex: 0,
    wordOrder: createShuffledWordOrder(sessionWords.length),
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    mode,
    classicDifficultyPreset: resolveClassicDifficultyPreset(mode, args.classicDifficultyPreset),
    createdAt: args.createdAt,
  };
}

export interface BuildChallengeStartStateArgs {
  mode: ChallengeMode;
  wordCount: number;
  now: number;
  seed?: number;
}

export function buildChallengeStartState(args: BuildChallengeStartStateArgs): ChallengeStartState {
  const seed = args.seed ?? (args.now ^ SEED_XOR_MASK);

  if (args.mode === "classic") {
    return {
      status: "accepted",
      questionStartTime: args.now,
      seed,
    };
  }

  return {
    status: "challenging",
    questionStartTime: args.now,
    ...buildSoloInitState(args.wordCount, seed),
  };
}
