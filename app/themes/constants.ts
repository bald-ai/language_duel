import {
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
} from "@/lib/themes/constants";
export {
  DEFAULT_WORD_TYPE,
  WORD_TYPE_OPTIONS,
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
export const PICK_AND_PRUNE_WORD_COUNT = 20;
export const GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT = 10;

export {
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
};
