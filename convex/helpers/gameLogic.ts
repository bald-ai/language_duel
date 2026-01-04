/**
 * Pure game logic functions.
 * These functions contain no database access and are easily testable.
 */

import {
  DIFFICULTY_RATIO_EASY,
  DIFFICULTY_RATIO_MEDIUM,
  DIFFICULTY_RATIO_HARD,
  POINTS_EASY,
  POINTS_MEDIUM,
  POINTS_HARD,
  LCG_MULTIPLIER,
  LCG_INCREMENT,
  LCG_MODULUS,
  QUESTION_INDEX_PRIME,
  INITIAL_POOL_RATIO,
  POOL_EXPANSION_THRESHOLD,
  POOL_EXPANSION_SIZE,
  LEVEL_1_START_PROBABILITY,
  LEVEL_2_TYPING_PROBABILITY,
  L1_TO_L2_PROBABILITY,
  L2_STAY_PROBABILITY,
} from "../constants";

// ===========================================
// Types
// ===========================================

export interface DifficultyDistribution {
  easy: number;
  medium: number;
  hard: number;
  easyEnd: number;
  mediumEnd: number;
  total: number;
}

export type ClassicDifficultyPreset = "easy" | "medium" | "hard";

export interface WordState {
  wordIndex: number;
  currentLevel: number;
  completedLevel3: boolean;
  answeredLevel2Plus: boolean;
}

export interface PlayerStats {
  questionsAnswered: number;
  correctAnswers: number;
}

export interface NextQuestionResult {
  wordIndex: number;
  level: number;
  level2Mode: string;
  isComplete: boolean;
}

// ===========================================
// Difficulty Distribution (Classic Mode)
// ===========================================

/**
 * Calculate easy difficulty distribution (40% Easy, 30% Medium, 30% Hard).
 */
export function calculateProgressiveClassicDistribution(
  wordCount: number
): DifficultyDistribution {
  if (wordCount <= 0) {
    return { easy: 0, medium: 0, hard: 0, easyEnd: 0, mediumEnd: 0, total: 0 };
  }

  const baseEasy = Math.floor(wordCount * DIFFICULTY_RATIO_EASY);
  const baseMedium = Math.floor(wordCount * DIFFICULTY_RATIO_MEDIUM);
  const baseHard = Math.floor(wordCount * DIFFICULTY_RATIO_HARD);

  const assigned = baseEasy + baseMedium + baseHard;
  const remainder = wordCount - assigned;

  let easy = baseEasy;
  let medium = baseMedium;
  let hard = baseHard;

  // Distribute remainder evenly
  if (remainder >= 1) easy++;
  if (remainder >= 2) medium++;
  if (remainder >= 3) hard++;
  if (remainder >= 4) easy++;
  if (remainder >= 5) medium++;
  if (remainder >= 6) hard++;

  return {
    easy,
    medium,
    hard,
    easyEnd: easy,
    mediumEnd: easy + medium,
    total: wordCount,
  };
}

/**
 * Calculate difficulty distribution based on preset.
 */
export function calculateClassicDifficultyDistribution(
  wordCount: number,
  preset: ClassicDifficultyPreset = "easy"
): DifficultyDistribution {
  if (wordCount <= 0) {
    return { easy: 0, medium: 0, hard: 0, easyEnd: 0, mediumEnd: 0, total: 0 };
  }

  switch (preset) {
    case "medium": {
      const medium = Math.ceil(wordCount / 2);
      const hard = wordCount - medium;
      return {
        easy: 0,
        medium,
        hard,
        easyEnd: 0,
        mediumEnd: medium,
        total: wordCount,
      };
    }
    case "hard": {
      return {
        easy: 0,
        medium: 0,
        hard: wordCount,
        easyEnd: 0,
        mediumEnd: 0,
        total: wordCount,
      };
    }
    case "easy":
    default:
      return calculateProgressiveClassicDistribution(wordCount);
  }
}

/**
 * Get points for a question at a given index.
 */
export function getPointsForIndex(
  index: number,
  distribution: DifficultyDistribution
): number {
  if (index < distribution.easyEnd) return POINTS_EASY;
  if (index < distribution.mediumEnd) return POINTS_MEDIUM;
  return POINTS_HARD;
}

/**
 * Check if a question index is in hard mode.
 */
export function isHardModeIndex(
  index: number,
  distribution: DifficultyDistribution
): boolean {
  return index >= distribution.mediumEnd;
}

// ===========================================
// PRNG (Deterministic Random)
// ===========================================

/**
 * Advance LCG seed one step.
 */
export function advanceSeed(seed: number): number {
  return (seed * LCG_MULTIPLIER + LCG_INCREMENT) & LCG_MODULUS;
}

/**
 * Determine if "None of the above" is the correct answer for hard mode.
 * Uses deterministic PRNG based on word content and question index.
 */
export function isNoneOfTheAboveCorrect(
  word: string,
  questionIndex: number
): boolean {
  // Seed based on word content + question index for deterministic results
  let seed = word
    .split("")
    .reduce(
      (acc: number, char: string, idx: number) =>
        acc + char.charCodeAt(0) * (idx + 1),
      0
    );
  seed = seed + questionIndex * QUESTION_INDEX_PRIME;

  // Advance seed past wrong answer shuffling (6 wrong answers = 5 swaps)
  for (let i = 5; i > 0; i--) {
    seed = advanceSeed(seed);
  }

  // Final seed advance to determine if "None of the above" is correct
  seed = advanceSeed(seed);
  return seed / LCG_MODULUS < 0.5;
}

// ===========================================
// Shuffling
// ===========================================

/**
 * Fisher-Yates shuffle for an array (non-deterministic).
 */
export function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Fisher-Yates shuffle using seeded PRNG (for mutations).
 */
export function shuffleArraySeeded<T>(array: T[], seed: number): { result: T[]; newSeed: number } {
  const result = [...array];
  let currentSeed = seed;
  for (let i = result.length - 1; i > 0; i--) {
    currentSeed = advanceSeed(currentSeed);
    const j = Math.floor((currentSeed / LCG_MODULUS) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { result, newSeed: currentSeed };
}

/**
 * Create shuffled word order for a duel.
 */
export function createShuffledWordOrder(wordCount: number): number[] {
  const indices = Array.from({ length: wordCount }, (_, i) => i);
  return shuffleArray(indices);
}

// ===========================================
// Word Pool Management (Solo Mode)
// ===========================================

/**
 * Initialize word pools for a player (non-deterministic).
 */
export function initializeWordPools(wordCount: number): {
  activePool: number[];
  remainingPool: number[];
} {
  const initialPoolSize = Math.max(1, Math.floor(wordCount * INITIAL_POOL_RATIO));
  const allIndices = Array.from({ length: wordCount }, (_, i) => i);
  const shuffled = shuffleArray(allIndices);

  return {
    activePool: shuffled.slice(0, initialPoolSize),
    remainingPool: shuffled.slice(initialPoolSize),
  };
}

/**
 * Initialize word pools using seeded PRNG (for mutations).
 */
export function initializeWordPoolsSeeded(wordCount: number, seed: number): {
  activePool: number[];
  remainingPool: number[];
  newSeed: number;
} {
  const initialPoolSize = Math.max(1, Math.floor(wordCount * INITIAL_POOL_RATIO));
  const allIndices = Array.from({ length: wordCount }, (_, i) => i);
  const { result: shuffled, newSeed } = shuffleArraySeeded(allIndices, seed);

  return {
    activePool: shuffled.slice(0, initialPoolSize),
    remainingPool: shuffled.slice(initialPoolSize),
    newSeed,
  };
}

/**
 * Initialize word states for all words.
 */
export function createInitialWordStates(wordCount: number): WordState[] {
  return Array.from({ length: wordCount }, (_, idx) => ({
    wordIndex: idx,
    currentLevel: 1,
    completedLevel3: false,
    answeredLevel2Plus: false,
  }));
}

/**
 * Determine if pool should be expanded.
 */
export function shouldExpandPool(
  activePool: number[],
  wordStates: WordState[],
  remainingPool: number[]
): boolean {
  if (remainingPool.length === 0) return false;

  const level2PlusCount = activePool.filter((idx) =>
    wordStates.find((ws) => ws.wordIndex === idx)?.answeredLevel2Plus
  ).length;

  return (
    level2PlusCount >= Math.ceil(activePool.length * POOL_EXPANSION_THRESHOLD)
  );
}

/**
 * Expand pool by adding words from remaining pool (non-deterministic).
 */
export function expandPool(
  activePool: number[],
  remainingPool: number[]
): { newActivePool: number[]; newRemainingPool: number[] } {
  const toAdd = Math.min(POOL_EXPANSION_SIZE, remainingPool.length);
  const shuffledRemaining = shuffleArray(remainingPool);
  const wordsToAdd = shuffledRemaining.slice(0, toAdd);

  return {
    newActivePool: [...activePool, ...wordsToAdd],
    newRemainingPool: shuffledRemaining.slice(toAdd),
  };
}

/**
 * Expand pool using seeded PRNG (for mutations).
 */
export function expandPoolSeeded(
  activePool: number[],
  remainingPool: number[],
  seed: number
): { newActivePool: number[]; newRemainingPool: number[]; newSeed: number } {
  const toAdd = Math.min(POOL_EXPANSION_SIZE, remainingPool.length);
  const { result: shuffledRemaining, newSeed } = shuffleArraySeeded(remainingPool, seed);
  const wordsToAdd = shuffledRemaining.slice(0, toAdd);

  return {
    newActivePool: [...activePool, ...wordsToAdd],
    newRemainingPool: shuffledRemaining.slice(toAdd),
    newSeed,
  };
}

// ===========================================
// Level Progression (Solo Mode)
// ===========================================

/**
 * Determine initial level for a question (non-deterministic, for client-side).
 */
export function determineInitialLevel(): number {
  return Math.random() < LEVEL_1_START_PROBABILITY ? 1 : 2;
}

/**
 * Determine initial level using seeded PRNG (for mutations).
 */
export function determineInitialLevelSeeded(seed: number): { level: number; newSeed: number } {
  const newSeed = advanceSeed(seed);
  const level = (newSeed / LCG_MODULUS) < LEVEL_1_START_PROBABILITY ? 1 : 2;
  return { level, newSeed };
}

/**
 * Determine Level 2 mode (typing vs multiple choice) - non-deterministic.
 */
export function determineLevel2Mode(): string {
  return Math.random() < LEVEL_2_TYPING_PROBABILITY
    ? "typing"
    : "multiple_choice";
}

/**
 * Determine Level 2 mode using seeded PRNG (for mutations).
 */
export function determineLevel2ModeSeeded(seed: number): { mode: string; newSeed: number } {
  const newSeed = advanceSeed(seed);
  const mode = (newSeed / LCG_MODULUS) < LEVEL_2_TYPING_PROBABILITY ? "typing" : "multiple_choice";
  return { mode, newSeed };
}

/**
 * Calculate next level after a correct answer (non-deterministic).
 */
export function calculateNextLevelOnCorrect(currentLevel: number): number {
  if (currentLevel === 1) {
    return Math.random() < L1_TO_L2_PROBABILITY ? 2 : 3;
  }
  return 3; // L2 or L3 correct -> L3
}

/**
 * Calculate next level after correct answer using seeded PRNG (for mutations).
 */
export function calculateNextLevelOnCorrectSeeded(
  currentLevel: number,
  seed: number
): { level: number; newSeed: number } {
  if (currentLevel === 1) {
    const newSeed = advanceSeed(seed);
    const level = (newSeed / LCG_MODULUS) < L1_TO_L2_PROBABILITY ? 2 : 3;
    return { level, newSeed };
  }
  return { level: 3, newSeed: seed }; // L2 or L3 correct -> L3
}

/**
 * Calculate next level after an incorrect answer.
 */
export function calculateNextLevelOnIncorrect(currentLevel: number): number {
  return Math.max(1, currentLevel - 1);
}

/**
 * Update word state after answering (non-deterministic).
 */
export function updateWordStateAfterAnswer(
  wordState: WordState,
  currentLevel: number,
  isCorrect: boolean
): WordState {
  const updated = { ...wordState };

  if (isCorrect) {
    if (currentLevel === 1) {
      updated.currentLevel = calculateNextLevelOnCorrect(1);
    } else if (currentLevel === 2) {
      updated.currentLevel = 3;
      updated.answeredLevel2Plus = true;
    } else if (currentLevel === 3) {
      updated.completedLevel3 = true;
      updated.answeredLevel2Plus = true;
    }
  } else {
    if (updated.currentLevel > 1) {
      updated.currentLevel = updated.currentLevel - 1;
    }
  }

  return updated;
}

/**
 * Update word state after answering using seeded PRNG (for mutations).
 */
export function updateWordStateAfterAnswerSeeded(
  wordState: WordState,
  currentLevel: number,
  isCorrect: boolean,
  seed: number
): { wordState: WordState; newSeed: number } {
  const updated = { ...wordState };
  let currentSeed = seed;

  if (isCorrect) {
    if (currentLevel === 1) {
      const { level, newSeed } = calculateNextLevelOnCorrectSeeded(1, currentSeed);
      updated.currentLevel = level;
      currentSeed = newSeed;
    } else if (currentLevel === 2) {
      updated.currentLevel = 3;
      updated.answeredLevel2Plus = true;
    } else if (currentLevel === 3) {
      updated.completedLevel3 = true;
      updated.answeredLevel2Plus = true;
    }
  } else {
    if (updated.currentLevel > 1) {
      updated.currentLevel = updated.currentLevel - 1;
    }
  }

  return { wordState: updated, newSeed: currentSeed };
}

/**
 * Pick next question from incomplete words (non-deterministic).
 */
export function pickNextQuestion(
  activePool: number[],
  wordStates: WordState[],
  currentWordIndex: number
): NextQuestionResult {
  // Find incomplete words
  const incompleteWords = activePool.filter(
    (idx) => !wordStates.find((ws) => ws.wordIndex === idx)?.completedLevel3
  );

  // Check if all complete
  if (incompleteWords.length === 0) {
    return {
      wordIndex: currentWordIndex,
      level: 3,
      level2Mode: "typing",
      isComplete: true,
    };
  }

  // Pick next word, avoiding current if possible
  let candidates = incompleteWords.filter((idx) => idx !== currentWordIndex);
  if (candidates.length === 0) candidates = incompleteWords;
  const nextWordIndex =
    candidates[Math.floor(Math.random() * candidates.length)];

  // Determine next level based on word state
  const nextWordState = wordStates.find((ws) => ws.wordIndex === nextWordIndex);
  let nextLevel = 1;

  if (nextWordState) {
    if (nextWordState.currentLevel === 1) {
      nextLevel = Math.random() < LEVEL_1_START_PROBABILITY ? 1 : 2;
    } else if (nextWordState.currentLevel === 2) {
      nextLevel = Math.random() < L2_STAY_PROBABILITY ? 2 : 3;
    } else {
      nextLevel = 3;
    }
  }

  return {
    wordIndex: nextWordIndex,
    level: nextLevel,
    level2Mode: determineLevel2Mode(),
    isComplete: false,
  };
}

/**
 * Pick next question using seeded PRNG (for mutations).
 */
export function pickNextQuestionSeeded(
  activePool: number[],
  wordStates: WordState[],
  currentWordIndex: number,
  seed: number
): { result: NextQuestionResult; newSeed: number } {
  // Find incomplete words
  const incompleteWords = activePool.filter(
    (idx) => !wordStates.find((ws) => ws.wordIndex === idx)?.completedLevel3
  );

  // Check if all complete
  if (incompleteWords.length === 0) {
    return {
      result: {
        wordIndex: currentWordIndex,
        level: 3,
        level2Mode: "typing",
        isComplete: true,
      },
      newSeed: seed,
    };
  }

  let currentSeed = seed;

  // Pick next word, avoiding current if possible
  let candidates = incompleteWords.filter((idx) => idx !== currentWordIndex);
  if (candidates.length === 0) candidates = incompleteWords;
  
  currentSeed = advanceSeed(currentSeed);
  const candidateIndex = Math.floor((currentSeed / LCG_MODULUS) * candidates.length);
  const nextWordIndex = candidates[candidateIndex];

  // Determine next level based on word state
  const nextWordState = wordStates.find((ws) => ws.wordIndex === nextWordIndex);
  let nextLevel = 1;

  if (nextWordState) {
    currentSeed = advanceSeed(currentSeed);
    const rand = currentSeed / LCG_MODULUS;
    
    if (nextWordState.currentLevel === 1) {
      nextLevel = rand < LEVEL_1_START_PROBABILITY ? 1 : 2;
    } else if (nextWordState.currentLevel === 2) {
      nextLevel = rand < L2_STAY_PROBABILITY ? 2 : 3;
    } else {
      nextLevel = 3;
    }
  }

  // Determine level 2 mode
  const { mode: level2Mode, newSeed: finalSeed } = determineLevel2ModeSeeded(currentSeed);

  return {
    result: {
      wordIndex: nextWordIndex,
      level: nextLevel,
      level2Mode,
      isComplete: false,
    },
    newSeed: finalSeed,
  };
}

/**
 * Update player stats after answering.
 */
export function updatePlayerStats(
  stats: PlayerStats,
  isCorrect: boolean
): PlayerStats {
  return {
    questionsAnswered: stats.questionsAnswered + 1,
    correctAnswers: isCorrect ? stats.correctAnswers + 1 : stats.correctAnswers,
  };
}

