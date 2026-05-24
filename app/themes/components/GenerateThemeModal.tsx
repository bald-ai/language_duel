"use client";

import type { WordType } from "@/lib/themes/api";
import { FormError } from "@/app/components/FormError";
import {
  MAX_GENERATED_WORDS_COUNT,
  MIN_GENERATED_WORDS_COUNT,
  PICK_AND_PRUNE_WORD_COUNT,
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
} from "../constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { ModalShell } from "@/app/components/modals/ModalShell";
import { WordTypeCarousel } from "./WordTypeCarousel";
import { PickAndPruneCta } from "./PickAndPruneCta";
import { themeActionButtonClassName, themeOutlineButtonClassName, getThemeActionButtonStyle, getThemeOutlineButtonStyle } from "./themeStyles";

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

  return (
    <ModalShell title="New Theme" dataTestId="theme-generate-modal">
      <WordTypeCarousel value={wordType} onChange={onWordTypeChange} disabled={isGenerating} />

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

      <PickAndPruneCta
        description={`Use the theme name above, add optional details if you want, then click Try to generate ${PICK_AND_PRUNE_WORD_COUNT} words for review.`}
        onTry={onGeneratePickAndPrune}
        disabled={!themeName.trim() || isGenerating}
        infoTestId="theme-pick-prune-info"
        tryTestId="theme-pick-prune-try"
      />
    </ModalShell>
  );
}
