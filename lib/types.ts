/**
 * Shared types for the Language Duel application.
 */
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Represents a vocabulary word with its correct answer and wrong options for quizzes.
 */
export interface WordEntry {
  word: string;
  answer: string;
  wrongAnswers: string[];
  ttsStorageId?: Id<"_storage">;
}

/**
 * Difficulty levels for questions.
 */
export type DifficultyLevel = "easy" | "medium" | "hard";

/**
 * Minimal difficulty info needed for answer shuffling.
 */
export interface ShuffleDifficultyInfo {
  level: DifficultyLevel;
  wrongCount: number;
}

/**
 * Full difficulty information for a question (includes scoring data).
 * Extends ShuffleDifficultyInfo so it can be used anywhere the minimal type is accepted.
 */
export interface DifficultyInfo extends ShuffleDifficultyInfo {
  points: number;
  optionCount: number;
}
