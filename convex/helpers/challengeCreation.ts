import type { Id } from "../_generated/dataModel";
import { SEED_XOR_MASK } from "../constants";
import { buildSoloInitState, type SoloInitState } from "./duelInitialization";
import { createShuffledWordOrder, type ClassicDifficultyPreset } from "./gameLogic";
import { buildClassicQuestionSet, type ClassicQuestionSnapshot } from "../../lib/answerShuffle";
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
  themes?: SessionThemeInput[];
  sessionWords?: SessionWordEntry[];
  createdAt: number;
  mode: ChallengeMode;
  classicDifficultyPreset?: ClassicDifficultyPreset;
}

export interface ChallengeBaseFields {
  challengerId: Id<"users">;
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  sessionWords: SessionWordEntry[];
  currentWordIndex: number;
  wordOrder: number[];
  seed: number;
  classicQuestions?: ClassicQuestionSnapshot[];
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

export function resolveClassicDifficultyPreset(
  mode: ChallengeMode,
  classicDifficultyPreset?: ClassicDifficultyPreset
): ClassicDifficultyPreset | undefined {
  return mode === "classic" ? classicDifficultyPreset ?? "easy" : undefined;
}

export function buildChallengeBase(args: BuildChallengeBaseArgs): ChallengeBaseFields {
  if (args.mode !== "solo" && args.mode !== "classic") {
    throw new Error("Challenge is missing mode");
  }

  const classicDifficultyPreset = resolveClassicDifficultyPreset(args.mode, args.classicDifficultyPreset);
  const sessionWords = args.sessionWords
    ? [...args.sessionWords]
    : buildSessionWords(args.themes ?? []);

  if (sessionWords.length === 0) {
    throw new Error("Challenge requires at least one session word");
  }

  const wordOrder = createShuffledWordOrder(sessionWords.length);

  return {
    challengerId: args.challengerId,
    opponentId: args.opponentId,
    themeIds: getUniqueThemeIds(sessionWords),
    sessionWords,
    currentWordIndex: 0,
    wordOrder,
    seed: args.createdAt ^ SEED_XOR_MASK,
    classicQuestions:
      args.mode === "classic"
        ? buildClassicQuestionSet(sessionWords, wordOrder, classicDifficultyPreset)
        : undefined,
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    mode: args.mode,
    classicDifficultyPreset,
    createdAt: args.createdAt,
  };
}

export interface BuildChallengeStartStateArgs {
  mode: ChallengeMode;
  wordCount: number;
  now: number;
  seed: number;
}

export function buildChallengeStartState(args: BuildChallengeStartStateArgs): ChallengeStartState {
  if (args.mode !== "solo" && args.mode !== "classic") {
    throw new Error("Challenge is missing mode");
  }
  if (!Number.isFinite(args.seed)) {
    throw new Error("Challenge is missing seed");
  }

  if (args.mode === "classic") {
    return {
      status: "accepted",
      questionStartTime: args.now,
      seed: args.seed,
    };
  }

  return {
    status: "challenging",
    questionStartTime: args.now,
    ...buildSoloInitState(args.wordCount, args.seed),
  };
}
