/**
 * Answer shuffling utilities for duel questions.
 * Uses seeded PRNG to ensure both players see identical answer order.
 */

import { hashSeed, seededShuffle, mulberry32 } from "./prng";
import { HARD_MODE_NONE_CHANCE } from "./constants";
import type { WordEntry, ShuffleDifficultyInfo } from "./types";

export const NONE_OF_ABOVE = "None of the above" as const;

export interface ShuffledAnswers {
  answers: string[];
  hasNoneOption: boolean;
}

/**
 * Shuffles answers for a question deterministically based on word and index.
 * Both players will see the same order.
 */
export function shuffleAnswersForQuestion(
  word: WordEntry,
  questionIndex: number,
  difficulty: ShuffleDifficultyInfo
): ShuffledAnswers {
  if (!word.wrongAnswers?.length) {
    return { answers: [], hasNoneOption: false };
  }

  // Create seed from word content + question index for deterministic shuffle
  const seedString = `${word.word}::${questionIndex}`;
  const baseSeed = hashSeed(seedString);
  const random = mulberry32(baseSeed);

  // Shuffle all wrong answers first, then pick the required count
  const shuffledWrong = seededShuffle(word.wrongAnswers, baseSeed);
  const selectedWrong = shuffledWrong.slice(0, difficulty.wrongCount);

  let answers: string[];
  let hasNone = false;

  if (difficulty.level === "hard") {
    // For hard: configurable chance "None of the above" is the correct answer
    const noneIsCorrect = random() < HARD_MODE_NONE_CHANCE;
    if (noneIsCorrect) {
      // All options are wrong + "None of the above" (which is correct)
      answers = [...selectedWrong, NONE_OF_ABOVE];
      hasNone = true;
    } else {
      // Correct answer + 3 wrong + "None of the above" (which is wrong)
      const fewerWrong = selectedWrong.slice(0, 3);
      answers = [word.answer, ...fewerWrong, NONE_OF_ABOVE];
      hasNone = false;
    }
  } else {
    // Easy/medium: correct answer + wrong answers
    answers = [word.answer, ...selectedWrong];
  }

  // Final shuffle of all options using a new seed offset
  const shuffleSeed = hashSeed(`${seedString}::final`);
  const finalAnswers = seededShuffle(answers, shuffleSeed);

  return { answers: finalAnswers, hasNoneOption: hasNone };
}
