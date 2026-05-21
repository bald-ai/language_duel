import { describe, expect, it } from "vitest";
import { mulberry32 } from "@/lib/prng";
import {
  evaluateLeftToRight,
  generateMathGateBurst,
  generateMathGateProblem,
  generateMathGateProblems,
  WRONG_ANSWER_COUNT,
} from "@/lib/mathGate";
import { countTwoDigitOperands } from "@/lib/mathGate/operands";

function isTwoDigit(value: number): boolean {
  return value >= 10 && value <= 99;
}

describe("mathGate generator", () => {
  it("generates deterministic problems when seeded", () => {
    const a = generateMathGateProblem({ seed: 42, termCount: 2 });
    const b = generateMathGateProblem({ seed: 42, termCount: 2 });
    expect(a.prompt).toBe(b.prompt);
    expect(a.correctAnswer).toBe(b.correctAnswer);
    expect(a.choices).toEqual(b.choices);
  });

  it("always produces integer correct answers in range with three unique wrong options", () => {
    const random = mulberry32(99);
    for (let i = 0; i < 120; i += 1) {
      const problem = generateMathGateProblem({ random, termCount: i % 2 === 0 ? 2 : 3 });
      expect(Number.isInteger(problem.correctAnswer)).toBe(true);
      expect(problem.correctAnswer).toBeGreaterThanOrEqual(0);
      expect(problem.correctAnswer).toBeLessThanOrEqual(150);
      expect(problem.wrongAnswers).toHaveLength(WRONG_ANSWER_COUNT);
      expect(problem.choices).toHaveLength(WRONG_ANSWER_COUNT + 1);
      expect(new Set(problem.choices).size).toBe(WRONG_ANSWER_COUNT + 1);
      expect(problem.choices).toContain(problem.correctAnswer);
      for (const wrong of problem.wrongAnswers) {
        expect(wrong.value).not.toBe(problem.correctAnswer);
        expect(Number.isInteger(wrong.value)).toBe(true);
      }
      const evaluated = evaluateLeftToRight(problem.operands, problem.operators);
      expect(evaluated).toBe(problem.correctAnswer);
    }
  });

  it("allows at most one two-digit operand in three-term problems", () => {
    const random = mulberry32(7);
    for (let i = 0; i < 80; i += 1) {
      const problem = generateMathGateProblem({ random, termCount: 3 });
      expect(problem.termCount).toBe(3);
      expect(countTwoDigitOperands(problem.operands)).toBeLessThanOrEqual(1);
    }
  });

  it("uses only clean division (dividend divisible by divisor)", () => {
    const random = mulberry32(123);
    for (let i = 0; i < 80; i += 1) {
      const problem = generateMathGateProblem({ random });
      for (let opIndex = 0; opIndex < problem.operators.length; opIndex += 1) {
        if (problem.operators[opIndex] !== "/") continue;
        const left = evaluateLeftToRight(
          problem.operands.slice(0, opIndex + 1),
          problem.operators.slice(0, opIndex)
        );
        const divisor = problem.operands[opIndex + 1];
        expect(left % divisor).toBe(0);
      }
    }
  });

  it("shuffles distractor kinds across seeds", () => {
    const kindsA = generateMathGateProblem({ seed: 1 }).wrongAnswers.map((w) => w.kind);
    const kindsB = generateMathGateProblem({ seed: 2 }).wrongAnswers.map((w) => w.kind);
    expect(kindsA.join(",")).not.toBe(kindsB.join(","));
  });

  it("generateMathGateProblems returns the requested count", () => {
    const burst = generateMathGateProblems(5, { seed: 5 });
    expect(burst).toHaveLength(5);
  });

  it("two-term problems may include two two-digit operands", () => {
    const random = mulberry32(2024);
    let sawTwoDigitPair = false;
    for (let i = 0; i < 100 && !sawTwoDigitPair; i += 1) {
      const problem = generateMathGateProblem({ random, termCount: 2 });
      const twoDigitCount = problem.operands.filter(isTwoDigit).length;
      if (twoDigitCount >= 2) sawTwoDigitPair = true;
    }
    expect(sawTwoDigitPair).toBe(true);
  });

  it("generateMathGateBurst keeps problems easy: two numbers, add/subtract, small operands", () => {
    const burst = generateMathGateBurst(12, { seed: 7 });
    expect(burst).toHaveLength(12);
    for (const problem of burst) {
      expect(problem.termCount).toBe(2);
      expect(problem.operators).toHaveLength(1);
      expect(["+", "-"]).toContain(problem.operators[0]);
      for (const operand of problem.operands) {
        expect(operand).toBeGreaterThanOrEqual(1);
        expect(operand).toBeLessThanOrEqual(20);
      }
    }
  });
});
