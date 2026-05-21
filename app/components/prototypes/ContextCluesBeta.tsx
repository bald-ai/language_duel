"use client";

import { useState } from "react";
import {
  advanceRound,
  answerOption,
  createRound,
  currentItem,
  isLastItem,
  isSelectionCorrect,
  selectedOption,
  VARIANT_META,
  VARIANT_ORDER,
  DEFAULT_VARIANT,
  type ContextCluesRound,
  type ContextCluesVariant,
  type InferWordItem,
  type PreparedItem,
  type SpotPatternItem,
  type StoryDetectiveItem,
} from "@/lib/contextClues";
import { PrototypeActionButton } from "./PrototypeActionButton";
import { PrototypeShell } from "./PrototypeShell";

const CARD_STYLE = {
  borderColor: "color-mix(in srgb, var(--color-primary) 75%, transparent)",
  backgroundColor: "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
} as const;

const LABEL_STYLE = {
  color: "var(--color-text-muted)",
} as const;

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={LABEL_STYLE}>
      {children}
    </p>
  );
}

function SentenceWithTarget({ sentence, target }: { sentence: string; target: string }) {
  const index = sentence.indexOf(target);
  if (index < 0) return <>{sentence}</>;
  return (
    <>
      {sentence.slice(0, index)}
      <span
        className="font-extrabold underline decoration-2 underline-offset-4"
        style={{ color: "var(--color-cta-dark)" }}
        data-testid="context-clues-target"
      >
        {target}
      </span>
      {sentence.slice(index + target.length)}
    </>
  );
}

function InferPrompt({ item }: { item: InferWordItem }) {
  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Context</SectionLabel>
        <p className="mt-1 text-base font-medium" style={{ color: "var(--color-text)" }}>
          {item.glossWithBlank}
        </p>
      </div>
      <div>
        <SectionLabel>Spanish</SectionLabel>
        <p className="mt-1 text-xl font-semibold leading-8" style={{ color: "var(--color-text)" }}>
          <SentenceWithTarget sentence={item.sentence} target={item.target} />
        </p>
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        What does <span style={{ color: "var(--color-cta-dark)" }}>“{item.target}”</span> mean?
      </p>
    </div>
  );
}

function StoryPrompt({ item }: { item: StoryDetectiveItem }) {
  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Story</SectionLabel>
        <div className="mt-1 space-y-1 text-lg font-semibold leading-7" style={{ color: "var(--color-text)" }}>
          {item.passage.map((line, lineIndex) => (
            <p key={lineIndex}>{line}</p>
          ))}
        </div>
      </div>
      <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
        {item.question}
      </p>
    </div>
  );
}

function PatternPrompt({ item }: { item: SpotPatternItem }) {
  return (
    <div className="space-y-3">
      <div>
        <SectionLabel>Examples</SectionLabel>
        <div className="mt-1 space-y-1 text-lg font-semibold leading-7" style={{ color: "var(--color-text)" }}>
          {item.examples.map((example, exampleIndex) => (
            <p key={exampleIndex}>
              {example.from} <span style={{ color: "var(--color-text-muted)" }}>→</span> {example.to}
            </p>
          ))}
        </div>
      </div>
      <div>
        <SectionLabel>Your turn</SectionLabel>
        <p className="mt-1 text-xl font-extrabold" style={{ color: "var(--color-cta-dark)" }}>
          {item.prompt}
        </p>
      </div>
    </div>
  );
}

function ItemPrompt({ prepared }: { prepared: PreparedItem }) {
  const { item } = prepared;
  if (item.variant === "infer_word") return <InferPrompt item={item} />;
  if (item.variant === "story_detective") return <StoryPrompt item={item} />;
  return <PatternPrompt item={item} />;
}

interface VariantTabsProps {
  active: ContextCluesVariant;
  onSelect: (variant: ContextCluesVariant) => void;
}

function VariantTabs({ active, onSelect }: VariantTabsProps) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="tablist">
      {VARIANT_ORDER.map((variant) => {
        const isActive = variant === active;
        return (
          <button
            key={variant}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(variant)}
            data-testid={`context-clues-tab-${variant}`}
            className="rounded-xl border-2 px-2 py-2 text-xs font-bold transition"
            style={{
              backgroundColor: isActive
                ? "var(--color-cta)"
                : "color-mix(in srgb, var(--color-primary) 18%, white 82%)",
              borderColor: isActive
                ? "var(--color-cta-light)"
                : "color-mix(in srgb, var(--color-primary) 60%, transparent)",
              color: isActive ? "#ffffff" : "var(--color-text)",
            }}
          >
            {VARIANT_META[variant].label}
          </button>
        );
      })}
    </div>
  );
}

interface ContextCluesBetaProps {
  onBack: () => void;
}

export function ContextCluesBeta({ onBack }: ContextCluesBetaProps) {
  const [seed, setSeed] = useState(1);
  const [round, setRound] = useState<ContextCluesRound>(() => createRound(DEFAULT_VARIANT, 1));

  const meta = VARIANT_META[round.variant];

  const handleSwitchVariant = (variant: ContextCluesVariant) => {
    if (variant === round.variant) return;
    setRound(createRound(variant, seed));
  };

  const handleRestart = () => {
    const nextSeed = seed + 1;
    setSeed(nextSeed);
    setRound(createRound(round.variant, nextSeed));
  };

  const handleAnswer = (optionId: string) => {
    setRound((current) => answerOption(current, optionId));
  };

  const handleNext = () => {
    setRound((current) => advanceRound(current));
  };

  return (
    <PrototypeShell title="Context Clues" testIdPrefix="context_clues" onBack={onBack}>
      <div className="space-y-4">
        <VariantTabs active={round.variant} onSelect={handleSwitchVariant} />

        {round.status === "complete" ? (
          <div className="space-y-4 text-center" data-testid="context-clues-complete">
            <div className="space-y-2">
              <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--color-cta-dark)" }}>
                {meta.label} complete
              </p>
              <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
                You got {round.correctCount} of {round.items.length}
              </h2>
              <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
                Play again, switch modes with the tabs above, or head back home.
              </p>
            </div>
            <div className="grid gap-3">
              <PrototypeActionButton
                fullWidth
                variant="primary"
                onClick={handleRestart}
                dataTestId="context-clues-restart"
              >
                Play again
              </PrototypeActionButton>
              <PrototypeActionButton fullWidth onClick={onBack} dataTestId="context-clues-complete-back">
                Back to Home
              </PrototypeActionButton>
            </div>
          </div>
        ) : (
          <ActiveRound
            round={round}
            meta={meta}
            onAnswer={handleAnswer}
            onNext={handleNext}
            onBack={onBack}
          />
        )}
      </div>
    </PrototypeShell>
  );
}

interface ActiveRoundProps {
  round: ContextCluesRound;
  meta: (typeof VARIANT_META)[ContextCluesVariant];
  onAnswer: (optionId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function ActiveRound({ round, meta, onAnswer, onNext, onBack }: ActiveRoundProps) {
  const prepared = currentItem(round);
  const answered = round.status === "answered";
  const correct = isSelectionCorrect(round);
  const chosen = selectedOption(round);
  const lastItem = isLastItem(round);

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-center">
        <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: "var(--color-cta-dark)" }}>
          Card {round.index + 1} of {round.items.length} · Score {round.correctCount}
        </p>
        <h2 className="text-2xl font-bold" style={{ color: "var(--color-text)" }}>
          {meta.label}
        </h2>
        <p className="text-sm leading-6" style={{ color: "var(--color-text)" }}>
          {meta.instruction}
        </p>
      </div>

      <div className="rounded-3xl border-2 p-4 sm:p-5 backdrop-blur-sm" style={CARD_STYLE}>
        <ItemPrompt prepared={prepared} />
      </div>

      <div className="grid gap-3">
        {prepared.options.map((option) => {
          const isChosen = chosen?.id === option.id;
          const showCorrect = answered && option.isCorrect;
          const showWrong = answered && isChosen && !option.isCorrect;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onAnswer(option.id)}
              disabled={answered}
              data-testid={`context-clues-option-${option.id}`}
              className="w-full rounded-2xl border-2 px-4 py-3 text-left text-base font-semibold transition disabled:cursor-not-allowed disabled:opacity-80"
              style={{
                backgroundColor: showCorrect
                  ? "color-mix(in srgb, var(--color-cta) 22%, transparent)"
                  : showWrong
                    ? "rgba(239, 68, 68, 0.12)"
                    : "color-mix(in srgb, var(--color-primary) 22%, white 78%)",
                borderColor: showCorrect
                  ? "var(--color-cta)"
                  : showWrong
                    ? "rgb(239 68 68)"
                    : "color-mix(in srgb, var(--color-primary) 75%, transparent)",
                color: "var(--color-text)",
              }}
            >
              {option.text}
              {showCorrect ? "  ✓" : ""}
            </button>
          );
        })}
      </div>

      {answered && (
        <div
          className="rounded-2xl border-2 p-3 text-sm leading-6"
          data-testid="context-clues-explanation"
          style={{
            borderColor: correct
              ? "color-mix(in srgb, var(--color-cta) 60%, transparent)"
              : "rgba(239, 68, 68, 0.5)",
            backgroundColor: correct ? "color-mix(in srgb, var(--color-cta) 12%, transparent)" : "rgba(239, 68, 68, 0.08)",
            color: "var(--color-text)",
          }}
        >
          <p className="font-bold" style={{ color: correct ? "var(--color-cta-dark)" : "rgb(185 28 28)" }}>
            {correct ? "¡Correcto!" : "Not quite —"}
          </p>
          <p className="mt-1">{prepared.item.explanation}</p>
        </div>
      )}

      <div className="flex gap-3">
        <PrototypeActionButton fullWidth variant="ghost" onClick={onBack} dataTestId="context-clues-back-home">
          Back to Home
        </PrototypeActionButton>
        <PrototypeActionButton
          fullWidth
          variant="primary"
          onClick={onNext}
          disabled={!answered}
          dataTestId="context-clues-next"
        >
          {lastItem ? "See results" : "Next"}
        </PrototypeActionButton>
      </div>
    </div>
  );
}
