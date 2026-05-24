/**
 * Shared types for the Language Duel application.
 */

// `Id` and `WordEntry` below are a deliberate hand-rolled mirror of Convex's
// generated `Id`/`Doc` types. They let the pure logic in `lib/` stay free of
// `convex/_generated` imports (keeping the layer boundary clean and the codegen
// out of unit tests). The brand here (`__tableName`) is intentionally distinct
// from Convex's generated brand, so don't "simplify" this to re-export the
// generated types — values are bridged at the convex/UI boundary on purpose.
export type Id<TableName extends string> = string & {
  __tableName: TableName;
};

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
