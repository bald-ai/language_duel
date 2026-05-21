"use client";

import { useState, type ReactNode } from "react";
import type { PlayerSlot, SentenceRound, SentenceState } from "@/lib/mockOnline/state";
import { ActionButton } from "./ActionButton";

interface SentenceBuilderProps {
  state: SentenceState;
  viewerSlot: PlayerSlot;
  onSubmit: (order: number[]) => void;
  onTap: (tile: number) => void;
}

// Reset of in-progress race picks is handled by remounting (key={state.index}
// from the parent), so this component needs no effects.
export function SentenceBuilder({ state, viewerSlot, onSubmit, onTap }: SentenceBuilderProps) {
  const round = state.rounds[state.index];
  if (!round) return null;

  return (
    <div className="space-y-4" data-testid="sentence-builder">
      <RoundHeader index={state.index} total={state.rounds.length} round={round} />
      {state.mode === "race" ? (
        <RaceBoard
          round={round}
          locked={viewerSlot === "host" ? state.lockedHost : state.lockedGuest}
          onSubmit={onSubmit}
        />
      ) : (
        <SharedBoard state={state} round={round} viewerSlot={viewerSlot} onTap={onTap} />
      )}
      {state.lastResolved && (
        <p
          className="text-center text-sm font-semibold"
          data-testid="sentence-last-result"
          style={{ color: "var(--color-cta-dark)" }}
        >
          {resultLine(state.lastResolved.scorer, viewerSlot)}{" "}
          <span className="font-bold">{state.lastResolved.correctText}</span>
        </p>
      )}
    </div>
  );
}

function RoundHeader({ index, total, round }: { index: number; total: number; round: SentenceRound }) {
  return (
    <>
      <p className="text-center text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--color-cta-dark)" }}>
        Sentence {index + 1} of {total}
      </p>
      <div
        className="rounded-3xl border-2 p-4 text-center"
        style={{
          borderColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--color-primary) 16%, white 84%)",
        }}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--color-text-muted)" }}>
          Build this sentence
        </p>
        <p className="mt-1 text-lg font-semibold" style={{ color: "var(--color-text)" }}>
          {round.english}
        </p>
      </div>
    </>
  );
}

// ---------------- Race: free assembly on your own board, then submit ----------------

function RaceBoard({
  round,
  locked,
  onSubmit,
}: {
  round: SentenceRound;
  locked: boolean;
  onSubmit: (order: number[]) => void;
}) {
  const [picked, setPicked] = useState<number[]>([]);
  const used = new Set(picked);
  const canSubmit = !locked && picked.length === round.words.length;

  const place = (tile: number) =>
    setPicked((current) => (locked || current.includes(tile) ? current : [...current, tile]));
  const removeAt = (position: number) =>
    setPicked((current) => (locked ? current : current.filter((_, i) => i !== position)));
  const undoLast = () => setPicked((current) => (locked ? current : current.slice(0, -1)));
  const clearAll = () => {
    if (!locked) setPicked([]);
  };

  return (
    <div className="space-y-4">
      <AssembledRow tiles={picked.map((t) => round.words[t])} onRemove={locked ? undefined : removeAt} />

      <WordTray>
        {round.words.map((word, tile) => (
          <WordTile
            key={tile}
            label={word}
            testId={`sentence-word-${tile}`}
            disabled={locked || used.has(tile)}
            dimmed={used.has(tile)}
            onClick={() => place(tile)}
          />
        ))}
      </WordTray>

      <div className="flex gap-2">
        <ActionButton
          fullWidth
          variant="ghost"
          disabled={locked || picked.length === 0}
          onClick={undoLast}
          dataTestId="sentence-undo"
        >
          Undo
        </ActionButton>
        <ActionButton
          fullWidth
          variant="ghost"
          disabled={locked || picked.length === 0}
          onClick={clearAll}
          dataTestId="sentence-clear"
        >
          Clear
        </ActionButton>
        <ActionButton fullWidth variant="primary" disabled={!canSubmit} onClick={() => onSubmit(picked)} dataTestId="sentence-submit">
          Submit
        </ActionButton>
      </div>

      {locked && (
        <p className="text-center text-sm font-semibold text-red-500" data-testid="sentence-locked">
          Wrong order — wait for the round to resolve.
        </p>
      )}
    </div>
  );
}

// ---------------- Coop + Duel: one shared board, place the next word ----------------

function SharedBoard({
  state,
  round,
  viewerSlot,
  onTap,
}: {
  state: SentenceState;
  round: SentenceRound;
  viewerSlot: PlayerSlot;
  onTap: (tile: number) => void;
}) {
  const isYourTurn = state.turn === viewerSlot;
  const placedSet = new Set(state.placed);

  return (
    <div className="space-y-4">
      <AssembledRow tiles={state.placed.map((t) => round.words[t])} />

      <WordTray>
        {round.words.map((word, tile) => (
          <WordTile
            key={tile}
            label={word}
            testId={`sentence-word-${tile}`}
            disabled={!isYourTurn || placedSet.has(tile)}
            dimmed={placedSet.has(tile)}
            onClick={() => onTap(tile)}
          />
        ))}
      </WordTray>

      <TurnBanner mode={state.mode} isYourTurn={isYourTurn} lastError={state.lastError} viewerSlot={viewerSlot} />
    </div>
  );
}

function TurnBanner({
  mode,
  isYourTurn,
  lastError,
  viewerSlot,
}: {
  mode: SentenceState["mode"];
  isYourTurn: boolean;
  lastError: PlayerSlot | null;
  viewerSlot: PlayerSlot;
}) {
  const youMissed = lastError === viewerSlot;
  const theyMissed = lastError !== null && lastError !== viewerSlot;

  return (
    <div className="text-center text-sm font-semibold" data-testid="sentence-turn">
      {isYourTurn ? (
        <span style={{ color: "var(--color-cta-dark)" }}>
          Your turn — {mode === "duel" ? "place the next word to score" : "place the next word"}
          {theyMissed && " · opponent missed, grab it!"}
        </span>
      ) : (
        <span style={{ color: "var(--color-text-muted)" }}>
          Waiting for opponent…{youMissed && " (your pick was wrong)"}
        </span>
      )}
    </div>
  );
}

// ---------------- Shared building blocks ----------------

function AssembledRow({ tiles, onRemove }: { tiles: string[]; onRemove?: (position: number) => void }) {
  return (
    <div
      className="flex min-h-14 flex-wrap items-center justify-center gap-2 rounded-2xl border border-dashed p-3"
      style={{ borderColor: "color-mix(in srgb, var(--color-cta) 55%, transparent)" }}
      data-testid="sentence-assembled"
    >
      {tiles.length === 0 ? (
        <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          Tap the words in order…
        </span>
      ) : (
        tiles.map((word, position) => (
          <button
            key={`${word}-${position}`}
            type="button"
            disabled={!onRemove}
            onClick={() => onRemove?.(position)}
            className="relative rounded-xl border px-3 py-1.5 text-sm font-semibold transition-all active:scale-95 disabled:cursor-default"
            style={{ backgroundColor: "var(--color-cta)", borderColor: "var(--color-cta-light)", color: "white" }}
          >
            <span
              className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
              style={{ backgroundColor: "var(--color-cta-dark)", color: "white" }}
            >
              {position + 1}
            </span>
            {word}
          </button>
        ))
      )}
    </div>
  );
}

function WordTray({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-2">{children}</div>;
}

function WordTile({
  label,
  testId,
  disabled,
  dimmed,
  onClick,
}: {
  label: string;
  testId: string;
  disabled: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className="rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-all hover:brightness-105 active:scale-95 disabled:cursor-not-allowed"
      style={{
        backgroundColor: dimmed
          ? "color-mix(in srgb, var(--color-primary) 8%, white 92%)"
          : "color-mix(in srgb, var(--color-primary) 16%, white 84%)",
        borderColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
        color: "var(--color-text)",
        opacity: dimmed ? 0.4 : 1,
      }}
    >
      {label}
    </button>
  );
}

function resultLine(scorer: PlayerSlot | "shared" | null, viewerSlot: PlayerSlot): string {
  if (scorer === "shared") return "Built together!";
  if (scorer === null) return "Nobody got it:";
  return scorer === viewerSlot ? "You scored!" : "Opponent scored:";
}
