// [NOT ACTIVE] Solo-style duel mode is not currently used in the app. Kept for future revisit.
import {
  initializeWordPoolsSeeded,
  createInitialWordStates,
  determineInitialLevelSeeded,
  determineLevel2ModeSeeded,
  type Level2Mode,
} from "./gameLogic";
import { LCG_MULTIPLIER, LCG_INCREMENT, LCG_MODULUS, SEED_XOR_MASK } from "../constants";

function nextSeed(seed: number): number {
  return (seed * LCG_MULTIPLIER + LCG_INCREMENT) & LCG_MODULUS;
}

function pickFromPool(pool: number[], seed: number): { index: number; newSeed: number } {
  const s = nextSeed(seed);
  const index = pool[s % pool.length];
  return { index, newSeed: s };
}

export interface SoloInitState {
  seed: number;
  challengerWordStates: ReturnType<typeof createInitialWordStates>;
  challengerActivePool: number[];
  challengerRemainingPool: number[];
  challengerCurrentWordIndex: number;
  challengerCurrentLevel: number;
  challengerLevel2Mode: Level2Mode;
  challengerCompleted: boolean;
  challengerStats: { questionsAnswered: number; correctAnswers: number };
  opponentWordStates: ReturnType<typeof createInitialWordStates>;
  opponentActivePool: number[];
  opponentRemainingPool: number[];
  opponentCurrentWordIndex: number;
  opponentCurrentLevel: number;
  opponentLevel2Mode: Level2Mode;
  opponentCompleted: boolean;
  opponentStats: { questionsAnswered: number; correctAnswers: number };
}

export function buildSoloInitState(wordCount: number, inputSeed?: number): SoloInitState {
  let seed = inputSeed ?? (Date.now() ^ SEED_XOR_MASK);

  const challengerPoolsResult = initializeWordPoolsSeeded(wordCount, seed);
  seed = challengerPoolsResult.newSeed;

  const opponentPoolsResult = initializeWordPoolsSeeded(wordCount, seed);
  seed = opponentPoolsResult.newSeed;

  const wordStates = createInitialWordStates(wordCount);

  const challengerPick = pickFromPool(challengerPoolsResult.activePool, seed);
  seed = challengerPick.newSeed;

  const opponentPick = pickFromPool(opponentPoolsResult.activePool, seed);
  seed = opponentPick.newSeed;

  const challengerLevel = determineInitialLevelSeeded(seed);
  seed = challengerLevel.newSeed;

  const challengerL2Mode = determineLevel2ModeSeeded(seed);
  seed = challengerL2Mode.newSeed;

  const opponentLevel = determineInitialLevelSeeded(seed);
  seed = opponentLevel.newSeed;

  const opponentL2Mode = determineLevel2ModeSeeded(seed);
  seed = opponentL2Mode.newSeed;

  return {
    seed,
    challengerWordStates: wordStates,
    challengerActivePool: challengerPoolsResult.activePool,
    challengerRemainingPool: challengerPoolsResult.remainingPool,
    challengerCurrentWordIndex: challengerPick.index,
    challengerCurrentLevel: challengerLevel.level,
    challengerLevel2Mode: challengerL2Mode.mode,
    challengerCompleted: false,
    challengerStats: { questionsAnswered: 0, correctAnswers: 0 },
    opponentWordStates: [...wordStates],
    opponentActivePool: opponentPoolsResult.activePool,
    opponentRemainingPool: opponentPoolsResult.remainingPool,
    opponentCurrentWordIndex: opponentPick.index,
    opponentCurrentLevel: opponentLevel.level,
    opponentLevel2Mode: opponentL2Mode.mode,
    opponentCompleted: false,
    opponentStats: { questionsAnswered: 0, correctAnswers: 0 },
  };
}
