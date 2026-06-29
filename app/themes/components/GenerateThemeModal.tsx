"use client";

import type { WordType } from "@/lib/themes/api";
import { FormError } from "@/app/components/FormError";
import {
  PICK_AND_PRUNE_WORD_COUNT,
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
} from "../constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { ModalShell } from "@/app/components/modals/ModalShell";
import { WordTypeCarousel } from "./WordTypeCarousel";
import { themeActionButtonClassName, themeOutlineButtonClassName, getThemeActionButtonStyle, getThemeOutlineButtonStyle } from "./themeStyles";

interface GenerateThemeModalProps {
  isOpen: boolean;
  themeName: string;
  themePrompt: string;
  wordType: WordType;
  generationMode: "standard" | "pick-and-prune" | null;
  error?: string | null;
  onThemeNameChange: (name: string) => void;
  onThemePromptChange: (prompt: string) => void;
  onWordTypeChange: (wordType: WordType) => void;
  onGenerate: () => void;
  onClose: () => void;
}

export function GenerateThemeModal({
  isOpen,
  themeName,
  themePrompt,
  wordType,
  generationMode,
  error,
  onThemeNameChange,
  onThemePromptChange,
  onWordTypeChange,
  onGenerate,
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

        <div
          className="rounded-xl border-2 px-4 py-3 text-sm"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.muted,
          }}
          data-testid="theme-generate-pick-prune-summary"
        >
          Generate {PICK_AND_PRUNE_WORD_COUNT} words, then keep the useful ones before the draft opens.
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
              : "Generating words... This may take a moment."}
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
    </ModalShell>
  );
}
