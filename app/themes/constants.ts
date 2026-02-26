import {
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
} from "@/lib/themes/constants";

export const VIEW_MODES = {
  LIST: "list",
  DETAIL: "detail",
  EDIT_WORD: "edit-word",
} as const;

export type ViewMode = (typeof VIEW_MODES)[keyof typeof VIEW_MODES];

export const EDIT_MODES = {
  CHOICE: "choice",
  GENERATE: "generate",
  MANUAL: "manual",
} as const;

export type EditMode = (typeof EDIT_MODES)[keyof typeof EDIT_MODES];

export const WORD_TYPES = {
  NOUNS: "nouns",
  VERBS: "verbs",
} as const;

export type WordType = (typeof WORD_TYPES)[keyof typeof WORD_TYPES];

export const FIELD_TYPES = {
  WORD: "word",
  ANSWER: "answer",
  WRONG: "wrong",
} as const;

export type FieldType = (typeof FIELD_TYPES)[keyof typeof FIELD_TYPES];

// Magic number constants
export const DEFAULT_RANDOM_WORD_COUNT = 5;
export const MAX_RANDOM_WORD_COUNT = 10;
export const GENERATED_WORDS_COUNT = 10;

export {
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
};
