import {
  ANSWER_MAX,
  ANSWER_MIN,
  GENERATION_MAX_ATTEMPTS,
} from "./constants";
import {
  assertExpressionIntegrity,
  assertProblemDistractors,
  attachChoices,
  buildWrongAnswers,
} from "./distractors";
import { evaluateLeftToRight, formatPrompt } from "./evaluate";
import {
  countTwoDigitOperands,
  pickOperandForSlot,
  pickTwoTermOperands,
  planThreeTermDigitSlots,
} from "./operands";
import { pickOne, resolveRandom } from "./random";
import type {
  GenerateMathGateProblemOptions,
  MathGateProblem,
  MathOperator,
  MathTermCount,
  RandomFn,
} from "./types";

const TWO_TERM_OPERATORS: MathOperator[] = ["+", "-", "*", "/"];

type ThreeTermTemplate = {
  operators: [MathOperator, MathOperator];
  label: string;
};

const THREE_TERM_TEMPLATES: ThreeTermTemplate[] = [
  { operators: ["+", "+"], label: "add_chain" },
  { operators: ["-", "-"], label: "sub_chain" },
  { operators: ["+", "-"], label: "add_sub" },
  { operators: ["-", "+"], label: "sub_add" },
  { operators: ["*", "+"], label: "mul_add" },
  { operators: ["/", "+"], label: "div_add" },
];

function isAnswerInRange(answer: number): boolean {
  return Number.isInteger(answer) && answer >= ANSWER_MIN && answer <= ANSWER_MAX;
}

function tryBuildTwoTerm(random: RandomFn): { operands: number[]; operators: MathOperator[] } | null {
  const operator = pickOne(random, TWO_TERM_OPERATORS);
  const pair = pickTwoTermOperands(random, operator);
  if (!pair) return null;
  const operands = pair;
  const operators = [operator];
  try {
    const answer = evaluateLeftToRight(operands, operators);
    if (!isAnswerInRange(answer)) return null;
    return { operands, operators };
  } catch {
    return null;
  }
}

function tryBuildThreeTerm(random: RandomFn): { operands: number[]; operators: MathOperator[] } | null {
  const template = pickOne(random, THREE_TERM_TEMPLATES);
  const digitSlots = planThreeTermDigitSlots(random);
  const operands: number[] = [
    pickOperandForSlot(random, digitSlots[0]),
    pickOperandForSlot(random, digitSlots[1]),
    pickOperandForSlot(random, digitSlots[2]),
  ];

  if (countTwoDigitOperands(operands) > 1) {
    return null;
  }

  const operators: MathOperator[] = [...template.operators];

  if (operators[0] === "/" && (operands[0] % operands[1] !== 0 || operands[1] === 0)) {
    return null;
  }

  try {
    const answer = evaluateLeftToRight(operands, operators);
    if (!isAnswerInRange(answer)) return null;
    return { operands, operators };
  } catch {
    return null;
  }
}

function pickTermCount(random: RandomFn, termCount: MathTermCount | "random"): MathTermCount {
  if (termCount !== "random") return termCount;
  return random() < 0.5 ? 2 : 3;
}

function buildExpression(
  random: RandomFn,
  termCount: MathTermCount
): { operands: number[]; operators: MathOperator[] } | null {
  if (termCount === 2) {
    return tryBuildTwoTerm(random);
  }
  return tryBuildThreeTerm(random);
}

export function generateMathGateProblem(
  options: GenerateMathGateProblemOptions = {}
): MathGateProblem {
  const random = resolveRandom(options);
  const termCount = pickTermCount(random, options.termCount ?? "random");

  for (let attempt = 0; attempt < GENERATION_MAX_ATTEMPTS; attempt += 1) {
    const expression = buildExpression(random, termCount);
    if (!expression) continue;

    const { operands, operators } = expression;
    const correctAnswer = evaluateLeftToRight(operands, operators);
    if (!isAnswerInRange(correctAnswer)) continue;

    const { wrongAnswers, distractorKindsAttempted } = buildWrongAnswers(
      random,
      operands,
      operators,
      correctAnswer
    );

    if (wrongAnswers.length < 3) continue;

    const problem: MathGateProblem = {
      operands,
      operators,
      termCount,
      prompt: formatPrompt(operands, operators),
      correctAnswer,
      wrongAnswers,
      choices: attachChoices(random, correctAnswer, wrongAnswers),
      distractorKindsAttempted,
    };

    try {
      assertExpressionIntegrity(operands, operators, correctAnswer);
      assertProblemDistractors(problem);
      return problem;
    } catch {
      continue;
    }
  }

  throw new Error("Failed to generate math gate problem");
}

export function generateMathGateProblems(
  count: number,
  options: GenerateMathGateProblemOptions = {}
): MathGateProblem[] {
  const baseRandom = resolveRandom(options);
  const problems: MathGateProblem[] = [];
  for (let i = 0; i < count; i += 1) {
    problems.push(
      generateMathGateProblem({
        ...options,
        random: () => baseRandom(),
      })
    );
  }
  return problems;
}

/** Weighted term count for sabotage-style bursts (2 easy items). */
export function generateMathGateBurst(
  size: number,
  options: GenerateMathGateProblemOptions = {}
): MathGateProblem[] {
  const baseRandom = resolveRandom(options);
  const burst: MathGateProblem[] = [];
  for (let i = 0; i < size; i += 1) {
    const termCount: MathTermCount | "random" =
      i === 0 ? 2 : pickOne(baseRandom, [2, 3] as const);
    burst.push(
      generateMathGateProblem({
        ...options,
        termCount,
        random: () => baseRandom(),
      })
    );
  }
  return burst;
}
