import type { MathOperator } from "./types";

export function applyOperator(left: number, operator: MathOperator, right: number): number {
  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      if (right === 0) {
        throw new Error("Division by zero");
      }
      if (left % right !== 0) {
        throw new Error("Non-integer division");
      }
      return left / right;
    default: {
      const _exhaustive: never = operator;
      return _exhaustive;
    }
  }
}

/** Evaluates left-to-right (no operator precedence). */
export function evaluateLeftToRight(operands: readonly number[], operators: readonly MathOperator[]): number {
  if (operands.length === 0) {
    throw new Error("Expression must have at least one operand");
  }
  if (operands.length !== operators.length + 1) {
    throw new Error("Operand count must be one more than operator count");
  }

  let acc = operands[0];
  for (let i = 0; i < operators.length; i += 1) {
    acc = applyOperator(acc, operators[i], operands[i + 1]);
  }
  return acc;
}

export function formatOperator(operator: MathOperator): string {
  switch (operator) {
    case "+":
      return "+";
    case "-":
      return "−";
    case "*":
      return "×";
    case "/":
      return "÷";
    default: {
      const _exhaustive: never = operator;
      return _exhaustive;
    }
  }
}

export function formatPrompt(operands: readonly number[], operators: readonly MathOperator[]): string {
  const parts: string[] = [String(operands[0])];
  for (let i = 0; i < operators.length; i += 1) {
    parts.push(formatOperator(operators[i]));
    parts.push(String(operands[i + 1]));
  }
  return parts.join(" ");
}
