import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MATH_GATE_CORRECT_ADVANCE_MS,
  MATH_GATE_WRONG_LOCK_MS,
} from "@/lib/sabotage/constants";

const fakeBurst = [
  { prompt: "1 + 1", correctAnswer: 2, choices: [2, 3, 4, 5] },
  { prompt: "3 + 4", correctAnswer: 7, choices: [6, 7, 8, 9] },
];

vi.mock("@/lib/mathGate", () => ({
  generateMathGateBurst: vi.fn(() => fakeBurst.map((problem) => ({ ...problem }))),
}));

import { MathGate } from "@/app/game/sabotage/effects/MathGate";

describe("MathGate", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the first problem and progress", () => {
    render(<MathGate />);

    expect(screen.getByTestId("math-gate-prompt").textContent).toContain("1 + 1");
    expect(screen.getByTestId("math-gate-progress").textContent).toContain("1/2");
    expect(screen.getByTestId("math-gate-choice-2")).toBeInTheDocument();
  });

  it("advances to the next problem after a correct answer", () => {
    vi.useFakeTimers();
    render(<MathGate />);

    fireEvent.click(screen.getByTestId("math-gate-choice-2"));
    act(() => {
      vi.advanceTimersByTime(MATH_GATE_CORRECT_ADVANCE_MS);
    });

    expect(screen.getByTestId("math-gate-prompt").textContent).toContain("3 + 4");
    expect(screen.getByTestId("math-gate-progress").textContent).toContain("2/2");
  });

  it("clears the gate after every problem is solved", () => {
    vi.useFakeTimers();
    render(<MathGate />);

    fireEvent.click(screen.getByTestId("math-gate-choice-2"));
    act(() => {
      vi.advanceTimersByTime(MATH_GATE_CORRECT_ADVANCE_MS);
    });
    fireEvent.click(screen.getByTestId("math-gate-choice-7"));
    act(() => {
      vi.advanceTimersByTime(MATH_GATE_CORRECT_ADVANCE_MS);
    });

    expect(screen.queryByTestId("duel-math-gate")).not.toBeInTheDocument();
  });

  it("locks on a wrong answer then re-enables retry on the same problem", () => {
    vi.useFakeTimers();
    render(<MathGate />);

    fireEvent.click(screen.getByTestId("math-gate-choice-3"));

    expect(screen.getByTestId("math-gate-wrong")).toBeInTheDocument();
    expect(screen.getByTestId("math-gate-prompt").textContent).toContain("1 + 1");
    expect((screen.getByTestId("math-gate-choice-2") as HTMLButtonElement).disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(MATH_GATE_WRONG_LOCK_MS);
    });

    expect(screen.queryByTestId("math-gate-wrong")).not.toBeInTheDocument();
    expect((screen.getByTestId("math-gate-choice-2") as HTMLButtonElement).disabled).toBe(false);
  });
});
