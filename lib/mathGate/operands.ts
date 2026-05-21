import {
  DIVISION_DIVISOR_MAX,
  DIVISION_DIVISOR_MIN,
  DIVISION_QUOTIENT_MAX,
  DIVISION_QUOTIENT_MIN,
  ONE_DIGIT_MAX,
  ONE_DIGIT_MIN,
  TWO_DIGIT_MAX,
  TWO_DIGIT_MIN,
} from "./constants";
import { randomInt } from "./random";
import type { MathOperator, RandomFn } from "./types";

function isTwoDigit(value: number): boolean {
  return value >= TWO_DIGIT_MIN && value <= TWO_DIGIT_MAX;
}

export function countTwoDigitOperands(operands: readonly number[]): number {
  return operands.filter(isTwoDigit).length;
}

export function pickOneDigitOperand(random: RandomFn): number {
  return randomInt(random, ONE_DIGIT_MIN, ONE_DIGIT_MAX);
}

export function pickTwoDigitOperand(random: RandomFn): number {
  return randomInt(random, TWO_DIGIT_MIN, TWO_DIGIT_MAX);
}

/** Picks 1–9 or 10–99 based on slot plan for 3-term expressions. */
export function pickOperandForSlot(
  random: RandomFn,
  slotUsesTwoDigit: boolean
): number {
  return slotUsesTwoDigit ? pickTwoDigitOperand(random) : pickOneDigitOperand(random);
}

/**
 * Assigns which of three slots (if any) holds the single allowed 2-digit operand.
 * Returns [usesTwoDigit, usesTwoDigit, usesTwoDigit] booleans.
 */
export function planThreeTermDigitSlots(random: RandomFn): [boolean, boolean, boolean] {
  const includeTwoDigit = random() < 0.55;
  if (!includeTwoDigit) {
    return [false, false, false];
  }
  const twoDigitSlot = randomInt(random, 0, 2);
  return [twoDigitSlot === 0, twoDigitSlot === 1, twoDigitSlot === 2];
}

export function pickTwoTermOperands(
  random: RandomFn,
  operator: MathOperator,
  operandMax: number = TWO_DIGIT_MAX
): [number, number] | null {
  switch (operator) {
    case "+": {
      const a = randomInt(random, ONE_DIGIT_MIN, operandMax);
      const b = randomInt(random, ONE_DIGIT_MIN, operandMax);
      return [a, b];
    }
    case "-": {
      const a = randomInt(random, ONE_DIGIT_MIN, operandMax);
      const b = randomInt(random, ONE_DIGIT_MIN, a);
      return [a, b];
    }
    case "*": {
      if (random() < 0.75) {
        return [pickOneDigitOperand(random), pickOneDigitOperand(random)];
      }
      const twoDigit = pickTwoDigitOperand(random);
      const oneDigit = pickOneDigitOperand(random);
      return random() < 0.5 ? [twoDigit, oneDigit] : [oneDigit, twoDigit];
    }
    case "/": {
      const divisor = randomInt(random, DIVISION_DIVISOR_MIN, DIVISION_DIVISOR_MAX);
      const quotient = randomInt(random, DIVISION_QUOTIENT_MIN, DIVISION_QUOTIENT_MAX);
      return [quotient * divisor, divisor];
    }
    default:
      return null;
  }
}
