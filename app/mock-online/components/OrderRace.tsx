"use client";

import { useState } from "react";
import type { OrderState, PlayerSlot } from "@/lib/mockOnline/state";
import { ActionButton } from "./ActionButton";
import { scorerLine } from "./raceResult";

interface OrderRaceProps {
  state: OrderState;
  viewerSlot: PlayerSlot;
  onSubmit: (order: number[]) => void;
}

// Reset of the in-progress pick order is handled by remounting (key={state.index}
// from the parent), so this component needs no effects.
export function OrderRace({ state, viewerSlot, onSubmit }: OrderRaceProps) {
  const [picked, setPicked] = useState<number[]>([]);

  const round = state.rounds[state.index];
  if (!round) return null;

  const youLocked = viewerSlot === "host" ? state.lockedHost : state.lockedGuest;
  const used = new Set(picked);
  const canSubmit = !youLocked && picked.length === round.words.length;

  return (
    <div className="space-y-4" data-testid="order-race">
      <p className="text-center text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--color-cta-dark)" }}>
        Sentence {state.index + 1} of {state.rounds.length}
      </p>

      <div
        className="rounded-3xl border-2 p-4 text-center"
        style={{
          borderColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--color-primary) 16%, white 84%)",
        }}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--color-text-muted)" }}>
          English meaning
        </p>
        <p className="mt-1 text-lg font-semibold" style={{ color: "var(--color-text)" }}>
          {round.english}
        </p>
      </div>

      <div
        className="flex min-h-12 flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed p-3"
        style={{ borderColor: "color-mix(in srgb, var(--color-cta) 55%, transparent)" }}
        data-testid="order-answer"
      >
        {picked.length === 0 ? (
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Tap the words in order…
          </span>
        ) : (
          picked.map((wordIndex, position) => (
            <button
              key={`${wordIndex}-${position}`}
              type="button"
              disabled={youLocked}
              onClick={() => setPicked((current) => current.filter((_, i) => i !== position))}
              className="rounded-xl border px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: "var(--color-cta)", borderColor: "var(--color-cta-light)", color: "white" }}
            >
              {round.words[wordIndex]}
            </button>
          ))
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {round.words.map((word, wordIndex) => (
          <button
            key={wordIndex}
            type="button"
            disabled={youLocked || used.has(wordIndex)}
            onClick={() => setPicked((current) => [...current, wordIndex])}
            data-testid={`order-word-${wordIndex}`}
            className="rounded-xl border-2 px-3 py-2 text-sm font-semibold transition disabled:opacity-40"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-primary) 16%, white 84%)",
              borderColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
              color: "var(--color-text)",
            }}
          >
            {word}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <ActionButton fullWidth variant="ghost" disabled={picked.length === 0 || youLocked} onClick={() => setPicked([])} dataTestId="order-clear">
          Clear
        </ActionButton>
        <ActionButton fullWidth variant="primary" disabled={!canSubmit} onClick={() => onSubmit(picked)} dataTestId="order-submit">
          Submit
        </ActionButton>
      </div>

      {youLocked && (
        <p className="text-center text-sm font-semibold text-red-500" data-testid="order-locked">
          Wrong — wait for the round to resolve.
        </p>
      )}

      {state.lastResolved && (
        <p className="text-center text-sm font-semibold" data-testid="order-last-result" style={{ color: "var(--color-cta-dark)" }}>
          {scorerLine(state.lastResolved.scorer, viewerSlot)} {state.lastResolved.correctText}
        </p>
      )}
    </div>
  );
}
