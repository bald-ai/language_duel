"use client";

import { useState, type ReactNode } from "react";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { buildDuelViewStyles } from "@/app/duel/[duelId]/components/duelViewStyles";
import { MOCK_DUEL_SENTENCE, MOCK_THEME_NAME, type MockSentence } from "./mockData";

/**
 * Shared duel chrome, a near 1:1 copy of `SentenceBuildBoard`: theme label,
 * English prompt, countdown, the build area, and the Confirm / Reset row. The
 * body (how freed words are surfaced) is the variant-specific bit.
 */
function DuelShell({
  caption,
  children,
}: {
  caption: string;
  children: ReactNode;
}) {
  const colors = useAppearanceColors();
  const styles = buildDuelViewStyles(colors);

  return (
    <div className="w-full flex-1 min-h-0 flex flex-col">
      <div
        className="flex-1 min-h-0 rounded-3xl border-2 p-4 overflow-y-auto backdrop-blur-sm"
        style={styles.gameContainer}
      >
        <div className="flex flex-col items-center justify-start px-2 py-2">
          <div className="text-center mb-4">
            <div className="text-xs uppercase tracking-[0.25em] mb-2" style={styles.mutedText}>
              {MOCK_THEME_NAME}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight" style={{ color: colors.text.DEFAULT }}>
              {MOCK_DUEL_SENTENCE.englishPrompt}
            </h1>
          </div>

          <div className="mb-4 text-center">
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-bold tabular-nums" style={{ color: colors.text.DEFAULT }}>
                18
              </span>
              <span className="text-xs" style={styles.mutedText}>
                sec
              </span>
            </div>
          </div>

          {children}

          <div className="mt-5 flex gap-3 w-full max-w-md">
            <button
              className="flex-1 rounded-xl font-extrabold text-lg py-3.5"
              style={{ backgroundColor: colors.cta.DEFAULT, color: "#fff", borderBottom: `4px solid ${colors.cta.dark}` }}
            >
              Confirm
            </button>
            <button
              className="rounded-xl font-extrabold text-lg py-3.5 px-5"
              style={{ backgroundColor: colors.neutral.light, color: colors.text.DEFAULT, borderBottom: `4px solid ${colors.neutral.dark}` }}
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <p className="flex-shrink-0 mt-3 text-center text-xs" style={{ color: colors.text.muted }}>
        {caption}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Duel Variant 1 — Locked scaffold: freed words are pre-placed + locked */
/* ------------------------------------------------------------------ */

export function DuelVariantScaffold() {
  const colors = useAppearanceColors();
  const sentence: MockSentence = MOCK_DUEL_SENTENCE;
  const freed = new Set(sentence.defaultPinned);
  // The words the player must still order (everything not freed).
  const poolWords = sentence.words.map((w, i) => ({ ...w, i })).filter(({ i }) => !freed.has(i));
  const [placed, setPlaced] = useState<number[]>([]);

  const togglePool = (i: number) =>
    setPlaced((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  return (
    <DuelShell caption="Duel · Scaffold — the freed connector words are already locked into the sentence (with their meaning). The player only orders the words they're learning.">
      {/* Sentence line being built — freed words locked in place */}
      <div className="w-full max-w-md mb-4 flex flex-wrap items-center gap-2 justify-center">
        {sentence.words.map((word, i) => {
          if (freed.has(i)) {
            return (
              <span
                key={i}
                className="inline-flex flex-col items-center rounded-lg border-2 px-2.5 py-1"
                style={{ borderColor: colors.cta.DEFAULT, backgroundColor: `${colors.cta.DEFAULT}1A`, color: colors.text.muted }}
              >
                <span className="flex items-center gap-1 text-sm font-semibold" style={{ color: colors.text.DEFAULT }}>
                  <svg className="w-3 h-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  {word.es}
                </span>
                <span className="text-[10px] font-bold leading-none" style={{ color: colors.cta.light }}>
                  {word.en}
                </span>
              </span>
            );
          }
          const order = placed.indexOf(i);
          return (
            <span
              key={i}
              className="inline-flex h-9 min-w-[3rem] items-center justify-center rounded-lg border-2 border-dashed px-2 text-sm font-semibold"
              style={{
                borderColor: colors.primary.dark,
                backgroundColor: order === -1 ? "transparent" : colors.background.DEFAULT,
                color: colors.text.DEFAULT,
              }}
            >
              {order === -1 ? "" : sentence.words[i].es}
            </span>
          );
        })}
      </div>

      {/* Tile pool — only the words the player must order */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
        {poolWords.map(({ es, i }) => {
          const order = placed.indexOf(i);
          const isPlaced = order !== -1;
          return (
            <button
              key={i}
              onClick={() => togglePool(i)}
              className="p-4 rounded-lg border-2 text-lg font-medium relative active:scale-95 transition-all"
              style={{
                borderColor: isPlaced ? colors.neutral.dark : colors.primary.dark,
                backgroundColor: isPlaced ? colors.background.DEFAULT : colors.background.elevated,
                color: isPlaced ? colors.text.muted : colors.text.DEFAULT,
                opacity: isPlaced ? 0.7 : 1,
              }}
            >
              {es}
              {isPlaced && (
                <span
                  className="absolute -top-2 -left-2 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center text-white shadow"
                  style={{ backgroundColor: colors.primary.DEFAULT }}
                >
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </DuelShell>
  );
}

/* ------------------------------------------------------------------ */
/* Duel Variant 2 — Glossed tiles: freed words still placed, but show meaning */
/* ------------------------------------------------------------------ */

export function DuelVariantGloss() {
  const colors = useAppearanceColors();
  const sentence: MockSentence = MOCK_DUEL_SENTENCE;
  const freed = new Set(sentence.defaultPinned);
  const [placed, setPlaced] = useState<number[]>([]);

  const toggle = (i: number) =>
    setPlaced((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));

  return (
    <DuelShell caption="Duel · Glossed tiles — every word is still in the pool to arrange, but the freed words wear their English meaning underneath so the player isn't blocked by them.">
      <div className="mt-1 w-full max-w-md text-center text-base mb-3" style={{ color: colors.text.muted }}>
        Tap the words in order…
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full max-w-md">
        {sentence.words.map((word, i) => {
          const order = placed.indexOf(i);
          const isPlaced = order !== -1;
          const isFreed = freed.has(i);
          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className="p-3 rounded-lg border-2 font-medium relative active:scale-95 transition-all flex flex-col items-center"
              style={{
                borderColor: isPlaced ? colors.neutral.dark : isFreed ? colors.cta.DEFAULT : colors.primary.dark,
                backgroundColor: isPlaced ? colors.background.DEFAULT : colors.background.elevated,
                color: isPlaced ? colors.text.muted : colors.text.DEFAULT,
                opacity: isPlaced ? 0.7 : 1,
                boxShadow: isFreed && !isPlaced ? `0 0 0 2px ${colors.cta.DEFAULT}33` : undefined,
              }}
            >
              <span className="text-lg leading-none">{word.es}</span>
              {isFreed && (
                <span className="mt-1 text-[11px] font-bold leading-none" style={{ color: colors.cta.light }}>
                  {word.en}
                </span>
              )}
              {isPlaced && (
                <span
                  className="absolute -top-2 -left-2 w-6 h-6 rounded-full text-xs font-extrabold flex items-center justify-center text-white shadow"
                  style={{ backgroundColor: colors.primary.DEFAULT }}
                >
                  {order + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </DuelShell>
  );
}
