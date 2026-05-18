"use client";

import type { WordType } from "@/lib/themes/api";
import { FormError } from "@/app/components/FormError";
import {
  MAX_GENERATED_WORDS_COUNT,
  MIN_GENERATED_WORDS_COUNT,
  PICK_AND_PRUNE_WORD_COUNT,
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
  WORD_TYPE_OPTIONS,
} from "../constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { themeActionButtonClassName, themeOutlineButtonClassName, getThemeActionButtonStyle, getThemeOutlineButtonStyle, getThemeModalPanelStyle } from "./themeStyles";

interface GenerateThemeModalProps {
  isOpen: boolean;
  themeName: string;
  themePrompt: string;
  wordType: WordType;
  wordCount: number;
  generationMode: "standard" | "pick-and-prune" | null;
  error?: string | null;
  onThemeNameChange: (name: string) => void;
  onThemePromptChange: (prompt: string) => void;
  onWordTypeChange: (wordType: WordType) => void;
  onWordCountChange: (wordCount: number) => void;
  onGenerate: () => void;
  onGeneratePickAndPrune: () => void;
  onClose: () => void;
}

export function GenerateThemeModal({
  isOpen,
  themeName,
  themePrompt,
  wordType,
  wordCount,
  generationMode,
  error,
  onThemeNameChange,
  onThemePromptChange,
  onWordTypeChange,
  onWordCountChange,
  onGenerate,
  onGeneratePickAndPrune,
  onClose,
}: GenerateThemeModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  const isGenerating = generationMode !== null;
  const selectedWordTypeIndex = WORD_TYPE_OPTIONS.findIndex((option) => option.value === wordType);
  const currentWordType = WORD_TYPE_OPTIONS[selectedWordTypeIndex] || WORD_TYPE_OPTIONS[0];

  const cycleWordType = (direction: -1 | 1) => {
    const nextIndex =
      (selectedWordTypeIndex + direction + WORD_TYPE_OPTIONS.length) % WORD_TYPE_OPTIONS.length;
    onWordTypeChange(WORD_TYPE_OPTIONS[nextIndex].value);
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-testid="theme-generate-modal"
    >
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={getThemeModalPanelStyle(colors)}
      >
        <h2 className="title-font text-xl font-bold mb-4 text-center" style={{ color: colors.text.DEFAULT }}>
          New Theme
        </h2>

        <div className="mb-6" data-testid="theme-generate-type-carousel">
          <div className="grid grid-cols-[3.5rem_1fr_3.5rem] items-center gap-5">
            <button
              type="button"
              onClick={() => cycleWordType(-1)}
              disabled={isGenerating}
              className="flex h-11 w-11 items-center justify-center justify-self-center rounded-xl border-2 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              aria-label="Previous word type"
              data-testid="theme-generate-type-previous"
            >
              <ChevronLeftIcon />
            </button>

            <div
              className="min-w-0 rounded-xl border-2 px-6 py-3 text-center text-sm font-bold uppercase tracking-widest shadow-lg"
              style={{
                backgroundImage: `linear-gradient(to bottom, ${colors.primary.light}, ${colors.primary.DEFAULT})`,
                borderColor: colors.primary.dark,
                color: colors.text.inverse,
                boxShadow: `0 10px 24px ${colors.primary.glow}`,
                opacity: isGenerating ? 0.5 : 1,
              }}
              aria-live="polite"
              data-testid="theme-generate-type-selected"
            >
              {currentWordType.label}
            </div>

            <button
              type="button"
              onClick={() => cycleWordType(1)}
              disabled={isGenerating}
              className="flex h-11 w-11 items-center justify-center justify-self-center rounded-xl border-2 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              aria-label="Next word type"
              data-testid="theme-generate-type-next"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div className="mt-5 flex justify-center gap-3" aria-label="Word type options">
            {WORD_TYPE_OPTIONS.map((option) => {
              const selected = option.value === wordType;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onWordTypeChange(option.value)}
                  disabled={isGenerating}
                  className="h-2.5 rounded-full transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  style={{
                    width: selected ? "1.5rem" : "0.625rem",
                    backgroundColor: selected ? colors.primary.dark : colors.neutral.light,
                  }}
                  aria-label={`Select ${option.label}`}
                  aria-pressed={selected}
                  data-testid={`theme-generate-type-${option.value}`}
                />
              );
            })}
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div>
            <input
              type="text"
              value={themeName}
              onChange={(e) => {
                if (e.target.value.length <= THEME_NAME_MAX_LENGTH) {
                  onThemeNameChange(e.target.value);
                }
              }}
              placeholder="Theme name (e.g. Kitchen)"
              maxLength={THEME_NAME_MAX_LENGTH}
              className="w-full p-4 border-2 rounded-xl focus:outline-none placeholder:opacity-60"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              disabled={isGenerating}
              data-testid="theme-generate-name"
            />
            <p className="text-xs mt-1 text-right" style={{ color: colors.text.muted }}>
              {themeName.length}/{THEME_NAME_MAX_LENGTH}
            </p>
          </div>

          <div>
            <textarea
              value={themePrompt}
              onChange={(e) => {
                if (e.target.value.length <= THEME_PROMPT_MAX_LENGTH) {
                  onThemePromptChange(e.target.value);
                }
              }}
              placeholder="Optional: Specify details (e.g. small items)"
              maxLength={THEME_PROMPT_MAX_LENGTH}
              rows={2}
              className="w-full p-4 border-2 rounded-xl focus:outline-none resize-none placeholder:opacity-60"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              disabled={isGenerating}
              data-testid="theme-generate-prompt"
            />
            <p className="text-xs mt-1 text-right" style={{ color: colors.text.muted }}>
              {themePrompt.length}/{THEME_PROMPT_MAX_LENGTH}
            </p>
          </div>

          <div>
            <label
              htmlFor="theme-generate-word-count"
              className="block text-sm font-medium mb-2"
              style={{ color: colors.text.DEFAULT }}
            >
              Number of words ({MIN_GENERATED_WORDS_COUNT}-{MAX_GENERATED_WORDS_COUNT})
            </label>
            <div className="flex items-center gap-4">
              <input
                id="theme-generate-word-count"
                type="range"
                min={MIN_GENERATED_WORDS_COUNT}
                max={MAX_GENERATED_WORDS_COUNT}
                value={wordCount}
                onChange={(e) => onWordCountChange(Number.parseInt(e.target.value, 10))}
                className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
                style={{ backgroundColor: colors.primary.dark }}
                disabled={isGenerating}
                data-testid="theme-generate-word-count"
              />
              <span
                className="w-8 text-center text-xl font-bold shrink-0"
                style={{ color: colors.text.DEFAULT }}
              >
                {wordCount}
              </span>
            </div>
          </div>
        </div>

        {isGenerating && (
          <div className="mb-4 text-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
              style={{ borderColor: colors.cta.light }}
            />
            <p className="text-sm" style={{ color: colors.text.muted }}>
              {generationMode === "pick-and-prune"
                ? `Generating ${PICK_AND_PRUNE_WORD_COUNT} words for Pick & Prune... This may take a moment.`
                : `Generating ${wordCount} words... This may take a moment.`}
            </p>
          </div>
        )}

        {error && !isGenerating && (
          <FormError message={error} className="mb-4" dataTestId="theme-generate-error" />
        )}

        <div className="flex gap-3">
          <button
            onClick={onGenerate}
            disabled={!themeName.trim() || isGenerating}
            className={themeActionButtonClassName}
            style={getThemeActionButtonStyle("cta", colors)}
            data-testid="theme-generate-submit"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className={themeOutlineButtonClassName}
            style={getThemeOutlineButtonStyle(colors)}
            data-testid="theme-generate-cancel"
          >
            Cancel
          </button>
        </div>

        <div
          className="mt-4 rounded-2xl border p-3"
          style={{
            backgroundColor: `${colors.primary.DEFAULT}14`,
            borderColor: `${colors.primary.DEFAULT}55`,
          }}
          data-testid="theme-pick-prune-info"
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: colors.primary.light }}
          >
            Try Pick & Prune
          </p>
          <p className="mt-1 text-xs" style={{ color: colors.text.muted }}>
            Use the theme name above, add optional details if you want, then click Try to generate{" "}
            {PICK_AND_PRUNE_WORD_COUNT} words for review.
          </p>
          <button
            onClick={onGeneratePickAndPrune}
            disabled={!themeName.trim() || isGenerating}
            className={`${themeOutlineButtonClassName} mt-3 w-full`}
            style={getThemeOutlineButtonStyle(colors)}
            data-testid="theme-pick-prune-try"
          >
            Try
          </button>
        </div>
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 5l-7 7 7 7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
