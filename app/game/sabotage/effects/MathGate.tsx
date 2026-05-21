"use client";

import { useCallback, useEffect, useState } from "react";
import { generateMathGateBurst, type MathGateProblem } from "@/lib/mathGate";
import {
  MATH_GATE_CORRECT_ADVANCE_MS,
  MATH_GATE_PROBLEM_COUNT,
  MATH_GATE_WRONG_LOCK_MS,
} from "@/lib/sabotage/constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";

type MathGateFeedback = "idle" | "correct" | "wrong";

// Blocks the target's answer options until they solve a short burst of math
// problems. Self-contained: once cleared it renders nothing so the question
// underneath becomes answerable again.
export function MathGate() {
  const colors = useAppearanceColors();
  const [burst] = useState<MathGateProblem[]>(() =>
    generateMathGateBurst(MATH_GATE_PROBLEM_COUNT)
  );
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<MathGateFeedback>("idle");

  const problem = burst[index] ?? null;
  const cleared = index >= burst.length;

  useEffect(() => {
    if (feedback !== "wrong") return;
    const timer = setTimeout(() => {
      setSelected(null);
      setFeedback("idle");
    }, MATH_GATE_WRONG_LOCK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (feedback !== "correct") return;
    const timer = setTimeout(() => {
      setIndex((current) => current + 1);
      setSelected(null);
      setFeedback("idle");
    }, MATH_GATE_CORRECT_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleAnswer = useCallback(
    (choice: number) => {
      if (!problem || feedback !== "idle") return;
      setSelected(choice);
      setFeedback(choice === problem.correctAnswer ? "correct" : "wrong");
    },
    [feedback, problem]
  );

  if (cleared || !problem) return null;

  const locked = feedback !== "idle";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: `${colors.background.DEFAULT}E6` }}
      data-testid="duel-math-gate"
    >
      <div
        className="w-full max-w-xs rounded-2xl border-2 p-5 shadow-2xl"
        style={{ borderColor: colors.primary.dark, backgroundColor: colors.background.elevated }}
      >
        <div
          className="mb-3 text-center text-xs font-semibold uppercase tracking-wider"
          style={{ color: colors.text.muted }}
          data-testid="math-gate-progress"
        >
          Solve to answer · {index + 1}/{burst.length}
        </div>

        <div
          className="mb-4 text-center text-4xl font-bold tabular-nums"
          style={{ color: colors.text.DEFAULT }}
          data-testid="math-gate-prompt"
        >
          {problem.prompt} = ?
        </div>

        <div className="grid grid-cols-2 gap-2">
          {problem.choices.map((choice) => {
            const showResult = locked && selected === choice;
            const isCorrect = choice === problem.correctAnswer;
            const borderColor = showResult
              ? isCorrect
                ? colors.status.success.DEFAULT
                : colors.status.danger.DEFAULT
              : colors.primary.dark;

            return (
              <button
                key={choice}
                type="button"
                disabled={locked}
                onClick={() => handleAnswer(choice)}
                data-testid={`math-gate-choice-${choice}`}
                className="rounded-xl border-2 px-3 py-3 text-xl font-bold tabular-nums transition disabled:opacity-80"
                style={{ borderColor, color: colors.text.DEFAULT, backgroundColor: colors.background.DEFAULT }}
              >
                {choice}
              </button>
            );
          })}
        </div>

        {feedback === "wrong" && (
          <div
            className="mt-3 text-center text-sm font-semibold"
            style={{ color: colors.status.danger.light }}
            data-testid="math-gate-wrong"
          >
            Wrong — try again
          </div>
        )}
      </div>
    </div>
  );
}
