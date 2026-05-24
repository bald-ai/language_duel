/**
 * Answer shuffling utilities for duel questions.
 * Uses seeded PRNG so the server can prepare a stable duel-question snapshot.
 */

import { hashSeed, seededShuffle, mulberry32 } from "./prng";
import { HARD_MODE_NONE_CHANCE } from "./constants";
import { RELAY_QUESTION_POINTS } from "./duelConstants";
import {
  DIFFICULTY_POINTS,
  DIFFICULTY_WRONG_COUNT,
  calculateDuelDifficultyDistribution,
  getDifficultyForIndex,
  type DuelDifficultyPreset,
} from "./difficultyUtils";
import type { DifficultyInfo, DifficultyLevel, WordEntry, ShuffleDifficultyInfo } from "./types";

export const NONE_OF_ABOVE = "None of the above" as const;

export interface DuelQuestionSnapshot {
  options: string[];
  correctOption: string;
  difficulty: DifficultyLevel;
  points: number;
}

function getPointsForDifficulty(difficulty: ShuffleDifficultyInfo | DifficultyInfo): number {
  return "points" in difficulty ? difficulty.points : DIFFICULTY_POINTS[difficulty.level];
}

/**
 * Builds the authoritative answer snapshot for a duel question.
 */
export function buildDuelQuestionSnapshot(
  word: WordEntry,
  questionIndex: number,
  difficulty: ShuffleDifficultyInfo
): DuelQuestionSnapshot {
  if (!word.wrongAnswers?.length) {
    return {
      options: [],
      correctOption: word.answer,
      difficulty: difficulty.level,
      points: getPointsForDifficulty(difficulty),
    };
  }

  // Create seed from word content + question index for deterministic shuffle
  const seedString = `${word.word}::${questionIndex}`;
  const baseSeed = hashSeed(seedString);
  const random = mulberry32(baseSeed);

  // Shuffle all wrong answers first, then pick the required count
  const shuffledWrong = seededShuffle(word.wrongAnswers, baseSeed);
  const selectedWrong = shuffledWrong.slice(0, difficulty.wrongCount);

  let answers: string[];
  let correctOption = word.answer;

  if (difficulty.level === "hard") {
    // For hard: configurable chance "None of the above" is the correct answer
    const noneIsCorrect = random() < HARD_MODE_NONE_CHANCE;
    if (noneIsCorrect) {
      // All options are wrong + "None of the above" (which is correct)
      answers = [...selectedWrong, NONE_OF_ABOVE];
      correctOption = NONE_OF_ABOVE;
    } else {
      // Correct answer + wrong decoys + "None of the above" (which is wrong).
      // Drop one wrong answer so "None" takes its slot and the total still
      // matches the hard-mode option count.
      const fewerWrong = selectedWrong.slice(0, Math.max(0, difficulty.wrongCount - 1));
      answers = [word.answer, ...fewerWrong, NONE_OF_ABOVE];
    }
  } else {
    // Easy/medium: correct answer + wrong answers
    answers = [word.answer, ...selectedWrong];
  }

  // Final shuffle of all options using a new seed offset
  const shuffleSeed = hashSeed(`${seedString}::final`);
  return {
    options: seededShuffle(answers, shuffleSeed),
    correctOption,
    difficulty: difficulty.level,
    points: getPointsForDifficulty(difficulty),
  };
}

export function buildDuelQuestionSet(
  words: WordEntry[],
  wordOrder: number[],
  preset: DuelDifficultyPreset = "easy"
): DuelQuestionSnapshot[] {
  const distribution = calculateDuelDifficultyDistribution(wordOrder.length, preset);

  return wordOrder.map((wordIndex, questionIndex) => {
    const difficulty = getDifficultyForIndex(questionIndex, distribution);
    return buildDuelQuestionSnapshot(words[wordIndex], questionIndex, difficulty);
  });
}

// Relay served questions are a single fixed difficulty worth a flat point
// (decisions #10/#11). "medium" is the base snapshot; "hard" is the upgrade
// variant. Both emit 6 options, so the grid stays visually stable.
export type RelayQuestionLevel = "medium" | "hard";

export function buildRelayQuestionSet(
  words: WordEntry[],
  wordOrder: number[],
  level: RelayQuestionLevel
): DuelQuestionSnapshot[] {
  return wordOrder.map((wordIndex, questionIndex) => ({
    ...buildDuelQuestionSnapshot(words[wordIndex], questionIndex, {
      level,
      wrongCount: DIFFICULTY_WRONG_COUNT[level],
    }),
    points: RELAY_QUESTION_POINTS,
  }));
}
