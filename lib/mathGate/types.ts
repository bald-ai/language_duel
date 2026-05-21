export type MathOperator = "+" | "-" | "*" | "/";

export type MathTermCount = 2 | 3;

export type RandomFn = () => number;

/** How a wrong option was derived (shown in the prototype for debugging). */
export type MathGateDistractorKind =
  | "off_by_one"
  | "off_by_two"
  | "nearby_ten"
  | "operand_first"
  | "operand_second"
  | "operand_third"
  | "partial_two_terms"
  | "missed_last_term"
  | "wrong_op_add"
  | "wrong_op_subtract"
  | "wrong_op_multiply"
  | "wrong_op_divide"
  | "swap_operands";

export interface MathGateDistractor {
  value: number;
  kind: MathGateDistractorKind;
}

export interface MathGateProblem {
  operands: number[];
  operators: MathOperator[];
  termCount: MathTermCount;
  prompt: string;
  correctAnswer: number;
  wrongAnswers: MathGateDistractor[];
  choices: number[];
  /** Which distractor kinds were attempted before picking the final three. */
  distractorKindsAttempted: MathGateDistractorKind[];
}

export interface GenerateMathGateProblemOptions {
  /** Optional seed for reproducible generation (tests). */
  seed?: number;
  random?: RandomFn;
  termCount?: MathTermCount | "random";
  /** Restrict which operators may appear. Defaults to all four. */
  operators?: MathOperator[];
  /** Cap operand magnitude for two-term add/subtract problems. Defaults to 99. */
  operandMax?: number;
}
