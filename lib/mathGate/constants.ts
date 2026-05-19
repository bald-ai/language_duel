/** Single-digit operand range (inclusive). */
export const ONE_DIGIT_MIN = 1;
export const ONE_DIGIT_MAX = 9;

/** Two-digit operand range (inclusive). */
export const TWO_DIGIT_MIN = 10;
export const TWO_DIGIT_MAX = 99;

/** Generated correct answers must land in this inclusive range. */
export const ANSWER_MIN = 0;
export const ANSWER_MAX = 150;

/** Wrong-answer options per problem. */
export const WRONG_ANSWER_COUNT = 3;

/** Total multiple-choice options (correct + wrong). */
export const CHOICE_COUNT = WRONG_ANSWER_COUNT + 1;

/** Max generation attempts before failing. */
export const GENERATION_MAX_ATTEMPTS = 80;

/** Division: divisor range for clean integer division. */
export const DIVISION_DIVISOR_MIN = 2;
export const DIVISION_DIVISOR_MAX = 12;

/** Division: quotient range (dividend = divisor × quotient). */
export const DIVISION_QUOTIENT_MIN = 2;
export const DIVISION_QUOTIENT_MAX = 12;
