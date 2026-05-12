import {
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
} from "@/lib/themes/constants";
import {
  DEFAULT_THEME_WORD_COUNT,
  MAX_RANDOM_GENERATED_WORD_COUNT,
  MAX_THEME_GENERATION_WORD_COUNT,
  MIN_THEME_GENERATION_WORD_COUNT,
} from "@/lib/generate/constants";
export {
  DEFAULT_WORD_TYPE,
  WORD_TYPE_CONFIG,
  WORD_TYPE_OPTIONS,
  WORD_TYPES,
  getDefaultWordType,
  getWordTypeConfig,
  getWordTypeLabel,
  isWordType,
  wordTypeAllowsCorrectAnswerMarker,
  type WordType,
} from "@/lib/themes/wordTypes";

export const VIEW_MODES = {
  LIST: "list",
  DETAIL: "detail",
  EDIT_WORD: "edit-word",
  PICK_AND_PRUNE_REVIEW: "pick-and-prune-review",
} as const;

export type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];

export const EDIT_MODES = {
  CHOICE: "choice",
  GENERATE: "generate",
  MANUAL: "manual",
} as const;

export type EditMode = (typeof EDIT_MODES)[keyof typeof EDIT_MODES];

export const FIELD_TYPES = {
  WORD: "word",
  ANSWER: "answer",
  WRONG: "wrong",
} as const;

export type FieldType = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];

// Magic number constants
export const DEFAULT_RANDOM_WORD_COUNT = 5;
export const MAX_RANDOM_WORD_COUNT = MAX_RANDOM_GENERATED_WORD_COUNT;
export const DEFAULT_GENERATED_WORDS_COUNT = DEFAULT_THEME_WORD_COUNT;
export const MIN_GENERATED_WORDS_COUNT = MIN_THEME_GENERATION_WORD_COUNT;
export const MAX_GENERATED_WORDS_COUNT = MAX_THEME_GENERATION_WORD_COUNT;
export const PICK_AND_PRUNE_WORD_COUNT = 20;
export const GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT = MAX_RANDOM_WORD_COUNT;

export {
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
};
