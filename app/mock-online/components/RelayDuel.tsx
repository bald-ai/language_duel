"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { otherSlot } from "@/lib/mockOnline/players";
import { relayPoints } from "@/lib/mockOnline/relay";
import type { PlayerSlot, RelayDifficulty, RelayState } from "@/lib/mockOnline/state";

interface RelayDuelProps {
  state: RelayState;
  viewerSlot: PlayerSlot;
  opponentName: string;
  onPick: (wordId: string) => void;
  onAnswer: (value: string) => void;
}

const rowStyle: CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--color-primary) 16%, white 84%)",
  borderColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
  color: "var(--color-text)",
};
const selectedStyle: CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--color-cta) 18%, white 82%)",
  borderColor: "var(--color-cta)",
  color: "var(--color-text)",
};
const ctaStyle: CSSProperties = {
  backgroundColor: "var(--color-cta)",
  borderColor: "var(--color-cta-light)",
  color: "#ffffff",
};

export function RelayDuel({ state, viewerSlot, opponentName, onPick, onAnswer }: RelayDuelProps) {
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const amPicker = viewerSlot === state.picker;
  const amAnswerer = viewerSlot === otherSlot(state.picker);

  return (
    <div className="space-y-4" data-testid="relay-duel">
      <div className="space-y-1 text-center">
        <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--color-cta-dark)" }}>
          {state.resolved} of {state.total} answered
        </p>
        {state.lastResult && <ResultLine result={state.lastResult} viewerSlot={viewerSlot} />}
      </div>

      {state.phase === "pick" ? (
        amPicker ? (
          <PickList
            state={state}
            opponentName={opponentName}
            selectedWordId={selectedWordId}
            onSelect={setSelectedWordId}
            onHandOver={() => selectedWordId && onPick(selectedWordId)}
          />
        ) : (
          <Waiting>Waiting for {opponentName} to pick a word…</Waiting>
        )
      ) : amAnswerer && state.assigned ? (
        <AnswerCard
          state={state}
          opponentName={opponentName}
          selectedAnswer={selectedAnswer}
          onSelect={setSelectedAnswer}
          onConfirm={() => selectedAnswer && onAnswer(selectedAnswer)}
        />
      ) : (
        <Waiting>
          Waiting for {opponentName} to answer…
          {state.assigned && (
            <span className="mt-2 block text-sm" style={{ color: "var(--color-text-muted)" }}>
              You handed over <strong style={{ color: "var(--color-text)" }}>{state.assigned.prompt}</strong>
            </span>
          )}
        </Waiting>
      )}
    </div>
  );
}

function PickList({
  state,
  opponentName,
  selectedWordId,
  onSelect,
  onHandOver,
}: {
  state: RelayState;
  opponentName: string;
  selectedWordId: string | null;
  onSelect: (id: string) => void;
  onHandOver: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        Hand a word to {opponentName}
      </p>
      <div className="grid gap-2">
        {state.pool.map((word) => {
          const selected = selectedWordId === word.id;
          return (
            <button
              key={word.id}
              type="button"
              onClick={() => onSelect(word.id)}
              data-testid={`relay-pick-${word.id}`}
              className="flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition"
              style={selected ? selectedStyle : rowStyle}
            >
              <span className="text-base font-semibold">{word.prompt}</span>
              {state.stakes && <DifficultyTag difficulty={word.difficulty} />}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!selectedWordId}
        onClick={onHandOver}
        data-testid="relay-hand-over"
        className="w-full rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
        style={ctaStyle}
      >
        Hand to {opponentName}
      </button>
    </div>
  );
}

function AnswerCard({
  state,
  opponentName,
  selectedAnswer,
  onSelect,
  onConfirm,
}: {
  state: RelayState;
  opponentName: string;
  selectedAnswer: string | null;
  onSelect: (value: string) => void;
  onConfirm: () => void;
}) {
  const word = state.assigned;
  if (!word) return null;

  return (
    <div className="space-y-4">
      <div
        className="rounded-3xl border-2 p-4 text-center"
        style={{
          borderColor: "color-mix(in srgb, var(--color-primary) 70%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--color-primary) 16%, white 84%)",
        }}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: "var(--color-text-muted)" }}>
          From {opponentName} · translate to Spanish
        </p>
        <p className="mt-1 text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          {word.prompt}
        </p>
        {state.stakes && (
          <div className="mt-2 flex justify-center">
            <DifficultyTag difficulty={word.difficulty} />
          </div>
        )}
      </div>

      <div className="grid gap-2.5">
        {word.options.map((option) => {
          const selected = selectedAnswer === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              data-testid={`relay-option-${option}`}
              className="w-full rounded-2xl border-2 px-4 py-3 text-center text-base font-semibold transition"
              style={selected ? selectedStyle : rowStyle}
            >
              {option}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!selectedAnswer}
        onClick={onConfirm}
        data-testid="relay-confirm"
        className="w-full rounded-2xl border-2 px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
        style={ctaStyle}
      >
        Confirm answer
      </button>
    </div>
  );
}

function DifficultyTag({ difficulty }: { difficulty: RelayDifficulty }) {
  return (
    <span
      className="rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em]"
      style={{
        borderColor: "color-mix(in srgb, var(--color-cta) 60%, transparent)",
        color: "var(--color-cta-dark)",
        backgroundColor: "color-mix(in srgb, var(--color-cta) 12%, white 88%)",
      }}
    >
      {difficulty} +{relayPoints(difficulty, true)}
    </span>
  );
}

function ResultLine({
  result,
  viewerSlot,
}: {
  result: NonNullable<RelayState["lastResult"]>;
  viewerSlot: PlayerSlot;
}) {
  const who = result.scorer === null ? "Nobody" : result.scorer === viewerSlot ? "You" : "Opponent";
  const summary = result.correct ? `${who} scored +${result.gained}` : `${who === "Nobody" ? "Missed" : `${who} missed`}`;
  return (
    <p className="text-sm font-semibold" data-testid="relay-last-result" style={{ color: "var(--color-cta-dark)" }}>
      {result.prompt} → {result.answer} · {summary}
    </p>
  );
}

function Waiting({ children }: { children: ReactNode }) {
  return (
    <div className="py-8 text-center text-base font-semibold" data-testid="relay-waiting" style={{ color: "var(--color-text)" }}>
      {children}
    </div>
  );
}
