/**
 * Shared types for the Language Duel application.
 */

/**
 * Represents a vocabulary word with its correct answer and wrong options for quizzes.
 */
export interface WordEntry {
  word: string;
  answer: string;
  wrongAnswers: string[];
}
