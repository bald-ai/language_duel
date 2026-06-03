"use client";

import { useState, type ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { getThemeActionButtonStyle, getThemeOutlineButtonStyle } from "@/app/themes/components/themeStyles";
import { MOCK_SENTENCES, MOCK_THEME_NAME, type MockSentence } from "./mockData";

/**
 * Shared theme-management chrome (header + scrollable card list + save dock),
 * a near 1:1 copy of `SentenceThemeDetail`. The only thing that changes between
 * the three variants is how each Spanish sentence renders its tappable words —
 * passed in via `renderWords`.
 */
function ManageShell({
  hint,
  renderWords,
}: {
  hint: string;
  renderWords: (sentence: MockSentence, sentenceIndex: number) => ReactNode;
}) {
  const colors = useAppearanceColors();

  const utilityButtonClassName =
    "border-2 rounded-xl px-3 py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition hover:brightness-110 whitespace-nowrap";

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col">
      {/* Header — matches SentenceThemeDetailHeader */}
      <header className="w-full flex-shrink-0 pb-4 animate-slide-up">
        <div
          className="w-full rounded-2xl border-2 px-4 py-3 backdrop-blur-sm shadow-lg"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 12px 32px ${colors.primary.glow}`,
          }}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h1
                className="title-font text-xl sm:text-2xl uppercase tracking-wider truncate"
                style={{
                  background: `linear-gradient(135deg, ${colors.text.DEFAULT} 0%, ${colors.neutral.DEFAULT} 50%, ${colors.text.DEFAULT} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {MOCK_THEME_NAME}
              </h1>
              <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                <button className={utilityButtonClassName} style={getThemeOutlineButtonStyle(colors)}>
                  + Add Sentence
                </button>
                <button
                  className={utilityButtonClassName}
                  style={{
                    backgroundColor: colors.background.elevated,
                    borderColor: colors.secondary.dark,
                    color: colors.secondary.light,
                  }}
                >
                  + Generate
                </button>
              </div>
            </div>
            <p className="text-xs sm:text-sm" style={{ color: colors.text.muted }}>
              {hint}
            </p>
          </div>
        </div>
      </header>

      {/* Scrollable card list — matches SentenceThemeDetail body */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className="flex-1 min-h-0 rounded-3xl border-2 p-4 overflow-y-auto backdrop-blur-sm animate-slide-up delay-100"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 20px 60px ${colors.primary.glow}`,
          }}
        >
          <div className="flex flex-col gap-4">
            {MOCK_SENTENCES.map((sentence, index) => (
              <SentenceCardShell key={index} sentence={sentence} index={index}>
                {renderWords(sentence, index)}
              </SentenceCardShell>
            ))}
          </div>
        </div>
      </div>

      {/* Save dock — matches ThemeActionDock */}
      <div className="w-full flex-shrink-0 pt-4 animate-slide-up delay-200">
        <div
          className="rounded-2xl border-2 p-2 backdrop-blur-sm shadow-lg"
          style={{ backgroundColor: `${colors.background.DEFAULT}E6`, borderColor: colors.primary.dark }}
        >
          <div className="flex gap-2">
            <button
              className="flex-1 bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-2xl py-2.5 px-4 text-xs sm:text-sm font-bold uppercase tracking-widest transition-all shadow-lg"
              style={getThemeActionButtonStyle("cta", colors)}
            >
              Save
            </button>
            <button
              className="flex-1 border-2 rounded-2xl py-2.5 px-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition hover:brightness-110"
              style={getThemeOutlineButtonStyle(colors)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Per-sentence card chrome (number badge, English prompt) — the word area is children. */
function SentenceCardShell({
  sentence,
  index,
  children,
}: {
  sentence: MockSentence;
  index: number;
  children: ReactNode;
}) {
  const colors = useAppearanceColors();
  return (
    <div
      className="border-2 rounded-2xl p-4"
      style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold"
          style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark, color: colors.text.DEFAULT }}
        >
          {index + 1}
        </div>
        <span className="text-xs font-semibold tracking-wider uppercase" style={{ color: colors.text.muted }}>
          Sentence
        </span>
      </div>

      {/* English prompt block (read-only) — matches the English field */}
      <div
        className="w-full p-2 border-2 rounded-lg text-sm font-medium mb-3"
        style={{
          backgroundColor: `${colors.primary.DEFAULT}1A`,
          borderColor: `${colors.primary.light}66`,
          color: colors.text.DEFAULT,
        }}
      >
        <div className="text-[10px] mb-1 uppercase tracking-wider" style={{ color: colors.primary.light }}>
          English
        </div>
        <div>{sentence.englishPrompt}</div>
      </div>

      {/* Spanish word area — variant-specific */}
      <div
        className="w-full p-3 border-2 rounded-lg"
        style={{
          backgroundColor: `${colors.secondary.DEFAULT}1A`,
          borderColor: `${colors.secondary.light}66`,
        }}
      >
        <div className="text-[10px] mb-2 uppercase tracking-wider" style={{ color: colors.secondary.light }}>
          Spanish · tap words to keep translated
        </div>
        {children}
      </div>
    </div>
  );
}

function usePinState(sentence: MockSentence) {
  const [pinned, setPinned] = useState<Set<number>>(() => new Set(sentence.defaultPinned));
  const toggle = (i: number) =>
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  return { pinned, toggle };
}

/* ------------------------------------------------------------------ */
/* Variant A — Inline chips: gloss sits directly beneath the freed word */
/* ------------------------------------------------------------------ */

export function ManageVariantInline() {
  return (
    <ManageShell
      hint="Variant A · Inline chips — tapped words light up and their meaning hangs right beneath them."
      renderWords={(sentence) => <InlineWords sentence={sentence} />}
    />
  );
}

function InlineWords({ sentence }: { sentence: MockSentence }) {
  const colors = useAppearanceColors();
  const { pinned, toggle } = usePinState(sentence);
  return (
    <div className="flex flex-wrap items-start gap-x-1.5 gap-y-2">
      {sentence.words.map((word, i) => {
        const isPinned = pinned.has(i);
        return (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="flex flex-col items-center rounded-lg px-2 py-1 transition active:scale-95 hover:brightness-110"
            style={
              isPinned
                ? {
                    backgroundColor: `${colors.cta.DEFAULT}26`,
                    border: `2px solid ${colors.cta.DEFAULT}`,
                    color: colors.text.DEFAULT,
                  }
                : {
                    backgroundColor: "transparent",
                    border: `2px dashed ${colors.secondary.dark}`,
                    color: colors.text.DEFAULT,
                  }
            }
          >
            <span className="text-base font-semibold leading-none">{word.es}</span>
            {isPinned && (
              <span className="mt-1 text-[11px] font-bold leading-none" style={{ color: colors.cta.light }}>
                {word.en}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Variant B — Interlinear: gloss floats above the word (book/ruby style) */
/* ------------------------------------------------------------------ */

export function ManageVariantInterlinear() {
  return (
    <ManageShell
      hint="Variant B · Interlinear — tapped words show a tiny translation floating above, like a textbook gloss."
      renderWords={(sentence) => <InterlinearWords sentence={sentence} />}
    />
  );
}

function InterlinearWords({ sentence }: { sentence: MockSentence }) {
  const colors = useAppearanceColors();
  const { pinned, toggle } = usePinState(sentence);
  return (
    <div className="flex flex-wrap items-end gap-x-2.5 gap-y-3 pt-3">
      {sentence.words.map((word, i) => {
        const isPinned = pinned.has(i);
        return (
          <button
            key={i}
            onClick={() => toggle(i)}
            className="relative flex flex-col items-center transition active:scale-95 hover:brightness-110"
          >
            {isPinned && (
              <span
                className="absolute -top-3.5 whitespace-nowrap text-[10px] font-bold leading-none"
                style={{ color: colors.cta.light }}
              >
                {word.en}
              </span>
            )}
            <span
              className="text-base font-semibold leading-none pb-0.5"
              style={{
                color: colors.text.DEFAULT,
                borderBottom: isPinned
                  ? `2px solid ${colors.cta.DEFAULT}`
                  : `2px dotted ${colors.secondary.dark}`,
              }}
            >
              {word.es}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Variant C — Glossary tray: clean sentence + a removable pill list below */
/* ------------------------------------------------------------------ */

export function ManageVariantGlossary() {
  return (
    <ManageShell
      hint="Variant C · Glossary tray — the sentence stays clean; freed words collect into a tidy list of word → meaning pills."
      renderWords={(sentence) => <GlossaryWords sentence={sentence} />}
    />
  );
}

function GlossaryWords({ sentence }: { sentence: MockSentence }) {
  const colors = useAppearanceColors();
  const { pinned, toggle } = usePinState(sentence);
  const pinnedList = sentence.words
    .map((word, i) => ({ word, i }))
    .filter(({ i }) => pinned.has(i));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-base leading-relaxed">
        {sentence.words.map((word, i) => {
          const isPinned = pinned.has(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className="font-semibold transition active:scale-95 hover:brightness-110"
              style={{
                color: isPinned ? colors.cta.light : colors.text.DEFAULT,
                borderBottom: isPinned ? `2px solid ${colors.cta.DEFAULT}` : "2px solid transparent",
              }}
            >
              {word.es}
            </button>
          );
        })}
      </div>

      <div
        className="rounded-xl border-2 border-dashed p-2.5"
        style={{ borderColor: `${colors.cta.DEFAULT}66`, backgroundColor: `${colors.cta.DEFAULT}10` }}
      >
        <div className="text-[10px] mb-2 uppercase tracking-wider" style={{ color: colors.cta.light }}>
          Free words ({pinnedList.length})
        </div>
        {pinnedList.length === 0 ? (
          <p className="text-xs" style={{ color: colors.text.muted }}>
            Tap a word above to keep its meaning shown for free.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {pinnedList.map(({ word, i }) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-semibold"
                style={{
                  backgroundColor: `${colors.cta.DEFAULT}1A`,
                  borderColor: colors.cta.DEFAULT,
                  color: colors.text.DEFAULT,
                }}
              >
                <span>{word.es}</span>
                <span style={{ color: colors.cta.light }}>→ {word.en}</span>
                <button
                  onClick={() => toggle(i)}
                  className="ml-0.5 leading-none opacity-70 hover:opacity-100"
                  aria-label={`Remove ${word.es}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
