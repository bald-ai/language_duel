"use client";

import type { MemoryState, PlayerSlot } from "@/lib/mockOnline/state";

interface MemoryBoardProps {
  state: MemoryState;
  viewerSlot: PlayerSlot;
  onFlip: (index: number) => void;
}

export function MemoryBoard({ state, viewerSlot, onFlip }: MemoryBoardProps) {
  const isYourTurn = state.turn === viewerSlot;
  const matched = new Set(state.matched);
  // The server keeps `lastMismatch` set until the next flip, so the revealed
  // pair stays visible to both players until someone acts — no local timer.
  const mismatched = new Set(state.lastMismatch ?? []);

  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3" data-testid="memory-board">
      {state.cards.map((card, index) => {
        const isMatched = matched.has(index);
        const isFaceUp = isMatched || state.firstPick === index || mismatched.has(index);
        const disabled = !isYourTurn || isFaceUp;

        return (
          <button
            key={index}
            type="button"
            disabled={disabled}
            onClick={() => onFlip(index)}
            data-testid={`memory-card-${index}`}
            className="flex aspect-[0.82] items-center justify-center rounded-2xl border-2 p-2 text-center text-sm font-bold transition disabled:cursor-default sm:text-base"
            style={cardStyle(isFaceUp, isMatched)}
          >
            {isFaceUp ? card.face : "?"}
          </button>
        );
      })}
    </div>
  );
}

function cardStyle(isFaceUp: boolean, isMatched: boolean) {
  if (isMatched) {
    return {
      backgroundColor: "color-mix(in srgb, var(--color-cta) 20%, white 80%)",
      borderColor: "var(--color-cta)",
      color: "var(--color-cta-dark)",
    };
  }
  if (isFaceUp) {
    return {
      backgroundColor: "color-mix(in srgb, var(--color-primary) 18%, white 82%)",
      borderColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
      color: "var(--color-text)",
    };
  }
  return {
    backgroundImage:
      "linear-gradient(180deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)",
    borderColor: "color-mix(in srgb, var(--color-primary-light) 60%, transparent)",
    color: "white",
  };
}
