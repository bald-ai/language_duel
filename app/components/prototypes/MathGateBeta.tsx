"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  generateMathGateBurst,
  generateMathGateProblem,
  type MathGateProblem,
  type MathTermCount,
} from "@/lib/mathGate";
import { PrototypeActionButton } from "./PrototypeActionButton";
import { PrototypeShell } from "./PrototypeShell";

const SABOTAGE_GATE_SIZE = 3;
const WRONG_ANSWER_LOCK_MS = 2000;
const CORRECT_ANSWER_ADVANCE_MS = 600;

type MathGateFeedback = "idle" | "correct" | "wrong";

interface MathGateBetaProps {
  onBack: () => void;
}

function createBurst(): MathGateProblem[] {
  return generateMathGateBurst(SABOTAGE_GATE_SIZE, { termCount: "random" });
}

export function MathGateBeta({ onBack }: MathGateBetaProps) {
  const [burst, setBurst] = useState<MathGateProblem[]>(() => createBurst());
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<MathGateFeedback>("idle");
  const [solvedCount, setSolvedCount] = useState(0);
  const [termFilter, setTermFilter] = useState<MathTermCount | "random">("random");

  const problem = burst[index] ?? null;

  const regenerateOne = useCallback(
    (filter: MathTermCount | "random") => {
      const next = generateMathGateProblem({ termCount: filter });
      setBurst((current) => {
        const copy = [...current];
        copy[index] = next;
        return copy;
      });
      setSelected(null);
      setFeedback("idle");
    },
    [index]
  );

  const handleNewBurst = useCallback(() => {
    setBurst(createBurst());
    setIndex(0);
    setSelected(null);
    setFeedback("idle");
    setSolvedCount(0);
  }, []);

  useEffect(() => {
    if (feedback !== "wrong") return;
    const timer = setTimeout(() => {
      setFeedback("idle");
      setSelected(null);
    }, WRONG_ANSWER_LOCK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (feedback !== "correct") return;
    const timer = setTimeout(() => {
      setIndex((current) => {
        if (current + 1 >= burst.length) return current;
        return current + 1;
      });
      setSelected(null);
      setFeedback("idle");
    }, CORRECT_ANSWER_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [burst.length, feedback]);

  const handleAnswer = useCallback(
    (choice: number) => {
      if (!problem || feedback !== "idle") return;
      const isCorrect = choice === problem.correctAnswer;
      setSelected(choice);
      setFeedback(isCorrect ? "correct" : "wrong");
      if (isCorrect) {
        setSolvedCount((count) => count + 1);
      }
    },
    [feedback, problem]
  );

  const gateComplete = solvedCount >= burst.length;
  const choicesLocked = feedback !== "idle" || gateComplete;

  const debugLines = useMemo(() => {
    if (!problem) return [];
    return [
      `Terms: ${problem.termCount} · Operands: ${problem.operands.join(", ")}`,
      `Correct: ${problem.correctAnswer}`,
      `Wrongs: ${problem.wrongAnswers.map((w) => `${w.value} (${w.kind})`).join(" · ")}`,
      `Kinds tried: ${problem.distractorKindsAttempted.slice(0, 8).join(", ")}…`,
    ];
  }, [problem]);

  if (!problem) {
    return (
      <PrototypeShell title="Math Gate" testIdPrefix="math_gate" onBack={onBack}>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Could not generate a problem. Try again.
        </p>
        <PrototypeActionButton fullWidth onClick={handleNewBurst} dataTestId="math-gate-retry">
          New burst
        </PrototypeActionButton>
      </PrototypeShell>
    );
  }

  return (
    <PrototypeShell title="Math Gate" testIdPrefix="math_gate" onBack={onBack}>
      <p className="mb-3 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        Sabotage prototype: solve {SABOTAGE_GATE_SIZE} quick math items to get back to the word question.
        All answers are whole numbers (no fractions).
      </p>

      <div
        className="mb-4 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--color-primary-dark)" }}
      >
        <span data-testid="math-gate-progress">
          Problem {index + 1} / {burst.length}
        </span>
        <span data-testid="math-gate-solved">Solved {solvedCount}</span>
      </div>

      <div
        className="mb-4 rounded-2xl border px-4 py-5 text-center"
        style={{
          borderColor: "color-mix(in srgb, var(--color-primary) 30%, transparent)",
          background: "color-mix(in srgb, var(--color-background-elevated) 70%, transparent)",
        }}
      >
        <p className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "var(--color-text-muted)" }}>
          Solve
        </p>
        <p
          className="title-font mt-2 text-4xl tabular-nums"
          style={{ color: "var(--color-text)" }}
          data-testid="math-gate-prompt"
        >
          {problem.prompt} = ?
        </p>
      </div>

      <div
        className="mb-4 grid grid-cols-2 gap-2"
        data-testid="math-gate-choices"
        data-locked={choicesLocked ? "true" : "false"}
      >
        {problem.choices.map((choice) => {
          const isSelected = selected === choice;
          const isCorrect = choice === problem.correctAnswer;
          const showResult = choicesLocked && isSelected;

          let borderColor = "color-mix(in srgb, var(--color-primary) 25%, transparent)";
          if (showResult) {
            borderColor = isCorrect
              ? "var(--color-status-success)"
              : "var(--color-status-danger)";
          }

          return (
            <button
              key={choice}
              type="button"
              disabled={choicesLocked}
              onClick={() => handleAnswer(choice)}
              data-testid={`math-gate-choice-${choice}`}
              className="rounded-xl border px-3 py-4 text-xl font-bold tabular-nums transition disabled:opacity-70"
              style={{
                borderColor,
                color: "var(--color-text)",
                background: "color-mix(in srgb, var(--color-background-elevated) 85%, transparent)",
              }}
            >
              {choice}
            </button>
          );
        })}
      </div>

      {feedback === "correct" && (
        <p className="mb-3 text-center text-sm font-semibold" style={{ color: "var(--color-status-success)" }}>
          Correct
        </p>
      )}
      {feedback === "wrong" && (
        <p
          className="mb-3 text-center text-sm font-semibold"
          style={{ color: "var(--color-status-danger)" }}
          data-testid="math-gate-wrong-lock"
        >
          Wrong — answer was {problem.correctAnswer}. Wait 2s to try again…
        </p>
      )}

      <div className="mb-4 flex flex-col gap-2">
        <PrototypeActionButton
          fullWidth
          variant="ghost"
          onClick={() => regenerateOne(termFilter)}
          dataTestId="math-gate-regenerate-one"
        >
          Regenerate this problem
        </PrototypeActionButton>
        <PrototypeActionButton fullWidth variant="ghost" onClick={handleNewBurst} dataTestId="math-gate-new-burst">
          New burst ({SABOTAGE_GATE_SIZE} problems)
        </PrototypeActionButton>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {(["random", 2, 3] as const).map((filter) => (
          <button
            key={String(filter)}
            type="button"
            onClick={() => {
              setTermFilter(filter);
              regenerateOne(filter);
            }}
            data-testid={`math-gate-filter-${filter}`}
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor:
                termFilter === filter
                  ? "var(--color-primary)"
                  : "color-mix(in srgb, var(--color-primary) 20%, transparent)",
              color: termFilter === filter ? "var(--color-primary)" : "var(--color-text-muted)",
            }}
          >
            {filter === "random" ? "Random terms" : `${filter} terms`}
          </button>
        ))}
      </div>

      {gateComplete ? (
        <p
          className="mb-3 rounded-xl border px-3 py-2 text-center text-sm font-semibold"
          style={{
            borderColor: "var(--color-status-success)",
            color: "var(--color-status-success)",
          }}
          data-testid="math-gate-complete"
        >
          Gate cleared — you would return to the vocabulary question here.
        </p>
      ) : null}

      <details
        className="rounded-xl border px-3 py-2 text-xs"
        style={{ borderColor: "color-mix(in srgb, var(--color-primary) 18%, transparent)" }}
      >
        <summary className="cursor-pointer font-semibold" style={{ color: "var(--color-text-muted)" }}>
          Generator debug
        </summary>
        <ul className="mt-2 space-y-1" style={{ color: "var(--color-text-muted)" }}>
          {debugLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>

      <PrototypeActionButton fullWidth variant="ghost" onClick={onBack} dataTestId="math-gate-back-home">
        Back to Home
      </PrototypeActionButton>
    </PrototypeShell>
  );
}
