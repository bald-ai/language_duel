import { WRONG_ANSWER_COUNT } from "./constants";
import { applyOperator, evaluateLeftToRight } from "./evaluate";
import { shuffleWithRandom } from "./random";
import type {
  MathGateDistractor,
  MathGateDistractorKind,
  MathGateProblem,
  MathOperator,
  RandomFn,
} from "./types";

const DISTRACTOR_KIND_ORDER: MathGateDistractorKind[] = [
  "off_by_one",
  "off_by_two",
  "nearby_ten",
  "operand_first",
  "operand_second",
  "operand_third",
  "partial_two_terms",
  "missed_last_term",
  "wrong_op_add",
  "wrong_op_subtract",
  "wrong_op_multiply",
  "wrong_op_divide",
  "swap_operands",
];

function isUsableWrong(value: number, correct: number, used: Set<number>): boolean {
  if (!Number.isInteger(value)) return false;
  if (value < 0) return false;
  if (value === correct) return false;
  if (used.has(value)) return false;
  return true;
}

function tryAddCandidate(
  pool: MathGateDistractor[],
  used: Set<number>,
  correct: number,
  value: number,
  kind: MathGateDistractorKind
): void {
  if (!isUsableWrong(value, correct, used)) return;
  used.add(value);
  pool.push({ value, kind });
}

function applyDistractorKind(
  random: RandomFn,
  kind: MathGateDistractorKind,
  operands: number[],
  operators: MathOperator[],
  correct: number
): number | null {
  switch (kind) {
    case "off_by_one":
      return correct + (random() < 0.5 ? -1 : 1);
    case "off_by_two":
      return correct + (random() < 0.5 ? -2 : 2);
    case "nearby_ten":
      return correct + (random() < 0.5 ? -10 : 10);
    case "operand_first":
      return operands.length > 0 ? operands[0] : null;
    case "operand_second":
      return operands.length > 1 ? operands[1] : null;
    case "operand_third":
      return operands.length > 2 ? operands[2] : null;
    case "partial_two_terms":
      if (operands.length === 3 && operators[0] === "+" && operators[1] === "+") {
        return operands[0] + operands[1];
      }
      if (operands.length === 3 && operators[0] === "*" && operators[1] === "+") {
        return operands[0] * operands[1];
      }
      if (operands.length === 3 && operators[0] === "/" && operators[1] === "+") {
        if (operands[0] % operands[1] !== 0) return null;
        return operands[0] / operands[1];
      }
      return null;
    case "missed_last_term":
      if (operands.length === 3 && operators.every((op) => op === "+")) {
        return operands[0] + operands[1];
      }
      if (operands.length === 3 && operators[0] === "*" && operators[1] === "+") {
        return operands[0] * operands[1];
      }
      return null;
    case "wrong_op_add":
      if (operators.length !== 1) return null;
      return applyOperator(operands[0], "+", operands[1]);
    case "wrong_op_subtract":
      if (operators.length !== 1) return null;
      return applyOperator(operands[0], "-", operands[1]);
    case "wrong_op_multiply":
      if (operators.length !== 1) return null;
      return applyOperator(operands[0], "*", operands[1]);
    case "wrong_op_divide":
      if (operators.length !== 1) return null;
      if (operands[1] === 0 || operands[0] % operands[1] !== 0) return null;
      return applyOperator(operands[0], "/", operands[1]);
    case "swap_operands":
      if (operators.length !== 1 || operators[0] !== "*") return null;
      return operands[1] * operands[0];
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

function padDistractors(
  pool: MathGateDistractor[],
  used: Set<number>,
  correct: number,
  random: RandomFn
): void {
  const offsets = [-3, -2, -1, 1, 2, 3, 10, -10];
  const shuffledOffsets = shuffleWithRandom(random, offsets);
  for (const offset of shuffledOffsets) {
    if (pool.length >= WRONG_ANSWER_COUNT) break;
    const kind: MathGateDistractorKind = Math.abs(offset) === 1 ? "off_by_one" : Math.abs(offset) === 2 ? "off_by_two" : "nearby_ten";
    tryAddCandidate(pool, used, correct, correct + offset, kind);
  }
}

export function buildWrongAnswers(
  random: RandomFn,
  operands: number[],
  operators: MathOperator[],
  correctAnswer: number
): { wrongAnswers: MathGateDistractor[]; distractorKindsAttempted: MathGateDistractorKind[] } {
  const pool: MathGateDistractor[] = [];
  const used = new Set<number>();
  const shuffledKinds = shuffleWithRandom(random, DISTRACTOR_KIND_ORDER);
  const distractorKindsAttempted: MathGateDistractorKind[] = [];

  for (const kind of shuffledKinds) {
    distractorKindsAttempted.push(kind);
    if (pool.length >= WRONG_ANSWER_COUNT) break;

    const value = applyDistractorKind(random, kind, operands, operators, correctAnswer);
    if (value === null) continue;
    tryAddCandidate(pool, used, correctAnswer, value, kind);
  }

  padDistractors(pool, used, correctAnswer, random);

  return {
    wrongAnswers: pool.slice(0, WRONG_ANSWER_COUNT),
    distractorKindsAttempted,
  };
}

export function attachChoices(
  random: RandomFn,
  correctAnswer: number,
  wrongAnswers: MathGateDistractor[]
): number[] {
  const values = [correctAnswer, ...wrongAnswers.map((entry) => entry.value)];
  return shuffleWithRandom(random, values);
}

export function assertProblemDistractors(problem: Pick<MathGateProblem, "correctAnswer" | "wrongAnswers" | "choices">): void {
  const wrongValues = problem.wrongAnswers.map((entry) => entry.value);
  if (wrongValues.length !== WRONG_ANSWER_COUNT) {
    throw new Error(`Expected ${WRONG_ANSWER_COUNT} wrong answers`);
  }
  if (new Set(wrongValues).size !== wrongValues.length) {
    throw new Error("Wrong answers must be unique");
  }
  if (wrongValues.includes(problem.correctAnswer)) {
    throw new Error("Wrong answer cannot equal correct answer");
  }
  if (problem.choices.length !== WRONG_ANSWER_COUNT + 1) {
    throw new Error("Choices must include correct and three wrong answers");
  }
  if (!problem.choices.includes(problem.correctAnswer)) {
    throw new Error("Choices must include the correct answer");
  }
}

/** Re-evaluate to guard against generator bugs. */
export function assertExpressionIntegrity(
  operands: number[],
  operators: MathOperator[],
  correctAnswer: number
): void {
  const evaluated = evaluateLeftToRight(operands, operators);
  if (evaluated !== correctAnswer) {
    throw new Error(`Expression ${operands.join(",")} does not evaluate to ${correctAnswer}`);
  }
}
