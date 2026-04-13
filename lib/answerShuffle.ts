/**
 * Answer shuffling utilities for duel questions.
 * Uses seeded PRNG so the server can prepare a stable classic-question snapshot.
 */

import { hashSeed, seededShuffle, mulberry32 } from "./prng";
import { HARD_MODE_NONE_CHANCE } from "./constants";
import {
  DIFFICULTY_POINTS,
  calculateClassicDifficultyDistribution,
  getDifficultyForIndex,
  type ClassicDifficultyPreset,
} from "./difficultyUtils";
import type { DifficultyInfo, DifficultyLevel, WordEntry, ShuffleDifficultyInfo } from "./types";

export const NONE_OF_ABOVE = "None of the above" as const;

export interface ClassicQuestionSnapshot {
  options: string[];
  correctOption: string;
  difficulty: DifficultyLevel;
  points: number;
}

export interface ShuffledAnswers {
  answers: string[];
  hasNoneOption: boolean;
}

function getPointsForDifficulty(difficulty: ShuffleDifficultyInfo | DifficultyInfo): number {
  return "points" in difficulty ? difficulty.points : DIFFICULTY_POINTS[difficulty.level];
}

/**
 * Builds the authoritative answer snapshot for a classic duel question.
 */
export function buildClassicQuestionSnapshot(
  word: WordEntry,
  questionIndex: number,
  difficulty: ShuffleDifficultyInfo
): ClassicQuestionSnapshot {
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
      // Correct answer + 3 wrong + "None of the above" (which is wrong)
      const fewerWrong = selectedWrong.slice(0, 3);
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

export function buildClassicQuestionSet(
  words: WordEntry[],
  wordOrder: number[],
  preset: ClassicDifficultyPreset = "easy"
): ClassicQuestionSnapshot[] {
  const distribution = calculateClassicDifficultyDistribution(wordOrder.length, preset);

  return wordOrder.map((wordIndex, questionIndex) => {
    const difficulty = getDifficultyForIndex(questionIndex, distribution);
    return buildClassicQuestionSnapshot(words[wordIndex], questionIndex, difficulty);
  });
}
