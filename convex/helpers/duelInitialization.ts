import {
  initializeWordPoolsSeeded,
  createInitialWordStates,
  determineInitialLevelSeeded,
  determineLevel2ModeSeeded,
  advanceSeed,
  type Level2Mode,
} from "./gameLogic";

function pickFromPool(pool: number[], seed: number): { index: number; newSeed: number } {
  const s = advanceSeed(seed);
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

// We thread a single seed through all random operations so the entire
// init is deterministic from one input seed.
export function buildSoloInitState(wordCount: number, seed: number): SoloInitState {
  const challengerPoolsResult = initializeWordPoolsSeeded(wordCount, seed);
  let newSeed = challengerPoolsResult.newSeed;

  const opponentPoolsResult = initializeWordPoolsSeeded(wordCount, newSeed);
  newSeed = opponentPoolsResult.newSeed;

  const wordStates = createInitialWordStates(wordCount);

  const challengerPick = pickFromPool(challengerPoolsResult.activePool, newSeed);
  newSeed = challengerPick.newSeed;

  const opponentPick = pickFromPool(opponentPoolsResult.activePool, newSeed);
  newSeed = opponentPick.newSeed;

  const challengerLevel = determineInitialLevelSeeded(newSeed);
  newSeed = challengerLevel.newSeed;

  const challengerL2Mode = determineLevel2ModeSeeded(newSeed);
  newSeed = challengerL2Mode.newSeed;

  const opponentLevel = determineInitialLevelSeeded(newSeed);
  newSeed = opponentLevel.newSeed;

  const opponentL2Mode = determineLevel2ModeSeeded(newSeed);
  newSeed = opponentL2Mode.newSeed;

  return {
    seed: newSeed,
    challengerWordStates: wordStates,
    challengerActivePool: challengerPoolsResult.activePool,
    challengerRemainingPool: challengerPoolsResult.remainingPool,
    challengerCurrentWordIndex: challengerPick.index,
    challengerCurrentLevel: challengerLevel.level,
    challengerLevel2Mode: challengerL2Mode.mode,
    challengerCompleted: false,
    challengerStats: { questionsAnswered: 0, correctAnswers: 0 },
    opponentWordStates: wordStates.map(ws => ({ ...ws })),
    opponentActivePool: opponentPoolsResult.activePool,
    opponentRemainingPool: opponentPoolsResult.remainingPool,
    opponentCurrentWordIndex: opponentPick.index,
    opponentCurrentLevel: opponentLevel.level,
    opponentLevel2Mode: opponentL2Mode.mode,
    opponentCompleted: false,
    opponentStats: { questionsAnswered: 0, correctAnswers: 0 },
  };
}
