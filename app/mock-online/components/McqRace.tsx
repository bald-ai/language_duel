"use client";

import type { McqState, PlayerSlot } from "@/lib/mockOnline/state";
import { scorerLine } from "./raceResult";

interface McqRaceProps {
  state: McqState;
  viewerSlot: PlayerSlot;
  onAnswer: (value: string) => void;
}

export function McqRace({ state, viewerSlot, onAnswer }: McqRaceProps) {
  const question = state.questions[state.index];
  if (!question) return null;

  const youLocked = viewerSlot === "host" ? state.lockedHost : state.lockedGuest;
  const isFillBlank = question.sentenceStart !== undefined;

  return (
    <div className="space-y-4" data-testid="mcq-race">
      <p className="text-center text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--color-cta-dark)" }}>
        Question {state.index + 1} of {state.questions.length}
      </p>

      <div
        className="rounded-3xl border-2 p-4 text-center"
        style={{
          borderColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--color-primary) 16%, white 84%)",
        }}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--color-text-muted)" }}>
          {isFillBlank ? "English meaning" : "Translate to Spanish"}
        </p>
        <p className="mt-1 text-lg font-semibold" style={{ color: "var(--color-text)" }}>
          {question.prompt}
        </p>
        {isFillBlank && (
          <p className="mt-3 text-xl font-semibold leading-8" style={{ color: "var(--color-text)" }}>
            {question.sentenceStart}{" "}
            <span
              className="inline-flex min-w-20 items-center justify-center rounded-xl border border-dashed px-3 py-0.5 text-base"
              style={{ borderColor: "color-mix(in srgb, var(--color-cta) 70%, transparent)", color: "var(--color-cta-dark)" }}
            >
              ____
            </span>{" "}
            {question.sentenceEnd}
          </p>
        )}
      </div>

      <div className="grid gap-2.5">
        {question.options.map((option) => (
          <button
            key={option}
            type="button"
            disabled={youLocked}
            onClick={() => onAnswer(option)}
            data-testid={`mcq-option-${option}`}
            className="w-full rounded-2xl border-2 px-4 py-3 text-center text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-primary) 16%, white 84%)",
              borderColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
              color: "var(--color-text)",
            }}
          >
            {option}
          </button>
        ))}
      </div>

      {youLocked && (
        <p className="text-center text-sm font-semibold text-red-500" data-testid="mcq-locked">
          Wrong — wait for the round to resolve.
        </p>
      )}

      {state.lastResolved && (
        <p className="text-center text-sm font-semibold" data-testid="mcq-last-result" style={{ color: "var(--color-cta-dark)" }}>
          {scorerLine(state.lastResolved.scorer, viewerSlot)} Correct: {state.lastResolved.correct}
        </p>
      )}
    </div>
  );
}
