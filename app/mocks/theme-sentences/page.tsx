"use client";

import { useMemo, useState } from "react";
import { ThemedPage } from "@/app/components/ThemedPage";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import {
  getThemeActionButtonStyle,
  getThemeModalPanelStyle,
  getThemeOutlineButtonStyle,
  themeActionButtonClassName,
  themeOutlineButtonClassName,
} from "@/app/themes/components/themeStyles";
import {
  getActiveActionButtonStyle,
  getActiveBadgeStyle,
  getActivePanelStyle,
  getActiveRowStyle,
  getCountPillStyle,
  getRemovedActionButtonStyle,
  getRemovedBadgeStyle,
  getRemovedPanelStyle,
  getRemovedPillStyle,
  getRemovedRowStyle,
} from "@/app/themes/components/pickAndPruneReviewStyles";
import { MOCK_THEMES, type MockTheme } from "./mockThemes";
import type {
  GeneratedSentence,
  GeneratedWord,
} from "@/app/api/mocks/theme-sentences/route";

/**
 * THROWAWAY PROTOTYPE: pick themes → AI generates natural on-topic sentences
 * (2× over-generation) → Pick & Prune review → theme-style preview. Sentences
 * lean on the selected themes' vocabulary; any word outside the themes is a
 * free word the player is given. Styled with the real app's theme components so
 * the feature can be felt in context. No Convex reads or writes; only the LLM
 * call is real.
 */

type Stage = "setup" | "review" | "preview";

const TARGET_COUNTS = [3, 5, 8];

function sentenceText(sentence: GeneratedSentence): string {
  return sentence.words.map((w) => w.es).join(" ");
}

export default function ThemeSentencesMockPage() {
  const colors = useAppearanceColors();
  const [stage, setStage] = useState<Stage>("setup");
  const [selectedIds, setSelectedIds] = useState<string[]>(["food", "travel"]);
  const [targetCount, setTargetCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedSentence[]>([]);
  const [removedIndexes, setRemovedIndexes] = useState<Set<number>>(new Set());
  const [removedOpen, setRemovedOpen] = useState(false);
  const [revealThemeWords, setRevealThemeWords] = useState(false);

  const selectedThemes = useMemo(
    () => MOCK_THEMES.filter((t) => selectedIds.includes(t.id)),
    [selectedIds]
  );

  const themeWordColor = useMemo(() => {
    const map = new Map<string, string>();
    for (const theme of selectedThemes) {
      for (const w of theme.words) map.set(w.word, theme.color);
    }
    return map;
  }, [selectedThemes]);

  const keptSentences = useMemo(
    () => generated.filter((_, i) => !removedIndexes.has(i)),
    [generated, removedIndexes]
  );

  const usedThemeWords = useMemo(() => {
    const used = new Set<string>();
    for (const sentence of keptSentences) {
      for (const word of sentence.words) {
        if (word.themeWord) used.add(word.themeWord);
      }
    }
    return used;
  }, [keptSentences]);

  const toggleTheme = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleRemoved = (index: number) => {
    setRemovedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/mocks/theme-sentences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themes: selectedThemes.map((t) => ({ name: t.name, words: t.words })),
          // Pick & Prune: over-generate 2× the target so the user can curate.
          sentenceCount: targetCount * 2,
        }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error || "Generation failed");
      setGenerated(data.sentences);
      setRemovedIndexes(new Set());
      setRemovedOpen(false);
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const startOver = () => {
    setStage("setup");
    setGenerated([]);
    setRemovedIndexes(new Set());
    setRevealThemeWords(false);
  };

  const header = (eyebrow: string, title: string, pills?: React.ReactNode) => (
    <header className="text-center shrink-0">
      <p
        className="text-[11px] font-bold uppercase tracking-[0.22em]"
        style={{ color: colors.cta.light }}
      >
        {eyebrow}
      </p>
      <h1 className="title-font text-lg font-bold mt-0.5" style={{ color: colors.text.DEFAULT }}>
        {title}
      </h1>
      {pills && <div className="mt-1.5 flex justify-center gap-2 text-[11px]">{pills}</div>}
    </header>
  );

  const renderWordTile = (word: GeneratedWord, index: number) => {
    const isThemeWord = word.themeWord !== "";
    const accent = isThemeWord
      ? (themeWordColor.get(word.themeWord) ?? colors.primary.DEFAULT)
      : colors.text.muted;

    return (
      <span
        key={index}
        className="inline-flex flex-col items-center rounded-lg border-2 px-2 py-1"
        style={{
          borderColor: accent,
          borderStyle: isThemeWord ? "solid" : "dashed",
          backgroundColor: isThemeWord ? `${accent}22` : colors.background.elevated,
        }}
      >
        <span className="text-sm font-bold" style={{ color: colors.text.DEFAULT }}>
          {word.es}
        </span>
        <span
          className="text-[10px] leading-tight"
          style={{
            color: colors.text.muted,
            visibility: isThemeWord && !revealThemeWords ? "hidden" : "visible",
          }}
        >
          {word.en}
        </span>
      </span>
    );
  };

  /* ---------------- Stage: setup ---------------- */

  const renderSetup = () => (
    <div
      className="w-full max-w-md mx-auto rounded-3xl border-2 p-4 flex flex-col gap-4"
      style={getThemeModalPanelStyle(colors)}
    >
      {header("Experimental Prototype", "Generate From Themes")}

      <div className="flex flex-col gap-1.5">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: colors.primary.dark }}
        >
          Themes
        </p>
        <div className="flex flex-wrap gap-2">
          {MOCK_THEMES.map((theme) => {
            const isSelected = selectedIds.includes(theme.id);
            return (
              <button
                key={theme.id}
                onClick={() => toggleTheme(theme.id)}
                title={theme.words.map((w) => w.word).join(", ")}
                className="rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition hover:brightness-110"
                style={{
                  borderColor: isSelected ? theme.color : colors.text.muted,
                  backgroundColor: isSelected ? theme.color : "transparent",
                  color: isSelected ? "#1c1917" : colors.text.muted,
                  opacity: isSelected ? 1 : 0.6,
                }}
              >
                <span className="mr-1">{isSelected ? "✓" : "+"}</span>
                {theme.name}
                <span className="ml-1 font-normal opacity-70">({theme.words.length})</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.18em]"
          style={{ color: colors.primary.dark }}
        >
          Rounds
        </p>
        <div
          className="inline-flex self-start rounded-xl overflow-hidden border-2"
          style={{ borderColor: colors.primary.dark }}
        >
          {TARGET_COUNTS.map((count) => (
            <button
              key={count}
              onClick={() => setTargetCount(count)}
              className="px-4 py-1.5 text-sm font-semibold transition hover:brightness-110"
              style={{
                backgroundColor:
                  targetCount === count ? colors.primary.DEFAULT : colors.background.DEFAULT,
                color: targetCount === count ? colors.text.DEFAULT : colors.text.muted,
              }}
            >
              {count}
            </button>
          ))}
        </div>
        <p className="text-[11px]" style={{ color: colors.text.muted }}>
          Generates {targetCount * 2} sentences, then you pick &amp; prune down to the keepers.
        </p>
      </div>

      <button
        type="button"
        onClick={generate}
        disabled={loading || selectedThemes.length === 0}
        className={themeActionButtonClassName}
        style={getThemeActionButtonStyle("cta", colors)}
      >
        {loading ? "Generating…" : "Generate Sentences"}
      </button>
    </div>
  );

  /* ---------------- Stage: review (Pick & Prune) ---------------- */

  const renderReviewRow = (index: number, removed: boolean) => {
    const sentence = generated[index];
    return (
      <article
        key={index}
        className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-1.5 py-[7px] transition hover:brightness-105"
        style={removed ? getRemovedRowStyle(colors) : getActiveRowStyle(colors)}
      >
        <span
          className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold"
          style={removed ? getRemovedBadgeStyle(colors) : getActiveBadgeStyle(colors)}
        >
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: colors.text.DEFAULT }}>
            {sentence.englishPrompt}
          </p>
          <p className="truncate text-sm italic" style={{ color: colors.text.muted }}>
            {sentenceText(sentence)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => toggleRemoved(index)}
          className="rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition hover:brightness-110"
          style={removed ? getRemovedActionButtonStyle(colors) : getActiveActionButtonStyle(colors)}
        >
          {removed ? "Restore" : "Remove"}
        </button>
      </article>
    );
  };

  const renderReview = () => {
    const activeIndexes = generated.map((_, i) => i).filter((i) => !removedIndexes.has(i));
    const removedList = generated.map((_, i) => i).filter((i) => removedIndexes.has(i));

    return (
      <div
        className="w-full max-w-md mx-auto rounded-3xl border-2 p-4 flex flex-col gap-3"
        style={getThemeModalPanelStyle(colors)}
      >
        {header(
          "Pick & Prune",
          "Review Generated Sentences",
          <>
            <span className="rounded-full border px-2.5 py-0.5 font-semibold" style={getCountPillStyle(colors)}>
              Active: {activeIndexes.length}
            </span>
            <span className="rounded-full border px-2.5 py-0.5 font-semibold" style={getRemovedPillStyle(colors)}>
              Removed: {removedList.length}
            </span>
          </>
        )}

        <section className="rounded-2xl border-2 p-2.5 flex flex-col" style={getActivePanelStyle(colors)}>
          <h2
            className="text-[11px] font-bold uppercase tracking-[0.18em] px-1 pb-1.5 shrink-0"
            style={{ color: colors.primary.dark }}
          >
            Active ({activeIndexes.length})
          </h2>
          <div className="space-y-1">
            {activeIndexes.map((i) => renderReviewRow(i, false))}
            {activeIndexes.length === 0 && (
              <p className="text-xs text-center py-3" style={{ color: colors.text.muted }}>
                No sentences selected. Restore at least one to continue.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border-2 shrink-0" style={getRemovedPanelStyle(colors)}>
          <button
            type="button"
            className="w-full flex items-center justify-between text-left text-[11px] font-bold uppercase tracking-[0.18em] px-3 py-2"
            style={{ color: colors.status.danger.light }}
            onClick={() => setRemovedOpen(!removedOpen)}
          >
            <span>Removed ({removedList.length})</span>
            <span aria-hidden className="text-lg leading-none">{removedOpen ? "▴" : "▾"}</span>
          </button>
          {removedOpen && (
            <div className="px-2.5 pb-2.5 space-y-1 max-h-40 overflow-y-auto">
              {removedList.map((i) => renderReviewRow(i, true))}
              {removedList.length === 0 && (
                <p className="text-xs text-center py-2" style={{ color: colors.text.muted }}>
                  Removed sentences will appear here.
                </p>
              )}
            </div>
          )}
        </section>

        <footer className="flex gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setStage("preview")}
            disabled={activeIndexes.length === 0}
            className={themeActionButtonClassName}
            style={getThemeActionButtonStyle("cta", colors)}
          >
            {`Continue with ${activeIndexes.length} ${activeIndexes.length === 1 ? "sentence" : "sentences"}`}
          </button>
          <button
            type="button"
            onClick={startOver}
            className={themeOutlineButtonClassName}
            style={getThemeOutlineButtonStyle(colors)}
          >
            Cancel
          </button>
        </footer>
      </div>
    );
  };

  /* ---------------- Stage: preview ---------------- */

  const renderThemeCoverage = (theme: MockTheme) => (
    <div key={theme.id} className="flex flex-wrap items-center gap-1">
      <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: theme.color }}>
        {theme.name}
      </span>
      {theme.words.map((w) => {
        const used = usedThemeWords.has(w.word);
        return (
          <span
            key={w.word}
            className="rounded-full border px-1.5 py-0.5 text-[10px] font-semibold"
            style={{
              borderColor: theme.color,
              backgroundColor: used ? `${theme.color}33` : "transparent",
              color: used ? colors.text.DEFAULT : colors.text.muted,
              opacity: used ? 1 : 0.55,
            }}
          >
            {w.word}
          </span>
        );
      })}
    </div>
  );

  const renderPreview = () => (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-3">
      <div
        className="rounded-3xl border-2 p-4 flex flex-col gap-3"
        style={getThemeModalPanelStyle(colors)}
      >
        {header("Experimental Prototype", `Theme Preview — ${keptSentences.length} Rounds`)}

        <div className="flex flex-wrap items-center justify-center gap-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: colors.text.muted }}>
            <input
              type="checkbox"
              checked={revealThemeWords}
              onChange={(e) => setRevealThemeWords(e.target.checked)}
            />
            Reveal theme-word translations
          </label>
        </div>

        <div className="flex flex-col gap-3">
          {keptSentences.map((sentence, i) => (
            <div
              key={i}
              className="rounded-2xl border-2 p-3 flex flex-col gap-2"
              style={getActivePanelStyle(colors)}
            >
              <p className="text-xs italic" style={{ color: colors.text.muted }}>
                “{sentence.englishPrompt}”
              </p>
              <div className="flex flex-wrap gap-1.5">{sentence.words.map(renderWordTile)}</div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="text-[9px] font-black uppercase tracking-wider"
                  style={{ color: colors.status.danger.light }}
                >
                  Distractors
                </span>
                {sentence.distractors.map((d) => (
                  <span
                    key={d}
                    className="rounded-lg border px-2 py-0.5 text-xs font-bold"
                    style={{
                      borderColor: `${colors.status.danger.DEFAULT}66`,
                      backgroundColor: `${colors.status.danger.DEFAULT}14`,
                      color: colors.text.DEFAULT,
                    }}
                  >
                    {d}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border-2 p-3 flex flex-col gap-2" style={getActivePanelStyle(colors)}>
          <span
            className="text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: colors.primary.dark }}
          >
            Theme word coverage — {usedThemeWords.size} of{" "}
            {selectedThemes.reduce((n, t) => n + t.words.length, 0)} words used
          </span>
          {selectedThemes.map(renderThemeCoverage)}
        </div>
      </div>

      <footer className="flex gap-3">
        <button
          type="button"
          onClick={() => setStage("review")}
          className={themeOutlineButtonClassName}
          style={getThemeOutlineButtonStyle(colors)}
        >
          Back to review
        </button>
        <button
          type="button"
          onClick={startOver}
          className={themeOutlineButtonClassName}
          style={getThemeOutlineButtonStyle(colors)}
        >
          Start over
        </button>
      </footer>
    </div>
  );

  /* ---------------- Page ---------------- */

  return (
    <ThemedPage className="min-h-dvh">
      <div className="relative z-10 w-full px-6 pt-6 pb-10 flex flex-col gap-4">
        {error && (
          <p
            className="text-xs font-semibold text-center"
            style={{ color: colors.status.danger.light }}
          >
            {error}
          </p>
        )}

        {stage === "setup" && renderSetup()}
        {stage === "review" && renderReview()}
        {stage === "preview" && renderPreview()}
      </div>
    </ThemedPage>
  );
}
