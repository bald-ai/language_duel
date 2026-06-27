/**
 * Credit system constants (testing values).
 */

export const LLM_MONTHLY_CREDITS = 400;
export const TTS_MONTHLY_GENERATIONS = 500;

export const LLM_WORD_THEME_CREDITS = 10;
export const LLM_SENTENCE_THEME_CREDITS = 20;
export const LLM_GENERATE_MORE_WORDS_CREDITS = 6;
export const LLM_GENERATE_MORE_SENTENCES_CREDITS = 12;
export const LLM_FIELD_REGEN_CREDITS = 1;
export const LLM_SINGLE_WORD_REGEN_CREDITS = 3;
export const LLM_ADD_WORD_CREDITS = 3;

/** Flat LLM cost charged once per save that schedules sentence word-meaning hints. */
export const SENTENCE_HINT_REFRESH_CREDITS = 4;

export const VALID_LLM_CREDIT_COSTS = [
  LLM_WORD_THEME_CREDITS,
  LLM_SENTENCE_THEME_CREDITS,
  LLM_GENERATE_MORE_WORDS_CREDITS,
  LLM_GENERATE_MORE_SENTENCES_CREDITS,
  LLM_FIELD_REGEN_CREDITS,
  LLM_SINGLE_WORD_REGEN_CREDITS,
  LLM_ADD_WORD_CREDITS,
  SENTENCE_HINT_REFRESH_CREDITS,
] as const;

export function isValidLlmCreditCost(cost: number): boolean {
  return VALID_LLM_CREDIT_COSTS.some((validCost) => validCost === cost);
}

export const TTS_GENERATION_COST = 1;
