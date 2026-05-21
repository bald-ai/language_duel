import type { ContextCluesVariant } from "./types";

/** One correct answer plus two plausible distractors (research: 3 is enough). */
export const OPTIONS_PER_ITEM = 3;

/** Tab order and the mode shown first. */
export const VARIANT_ORDER: ContextCluesVariant[] = [
  "infer_word",
  "story_detective",
  "spot_pattern",
];

export const DEFAULT_VARIANT: ContextCluesVariant = "infer_word";

/** Marks where the deducible word's meaning sits in an English gloss. */
export const GLOSS_BLANK = "___";
