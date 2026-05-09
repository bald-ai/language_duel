"use client";

import type { WordType } from "@/lib/themes/api";
import { FormError } from "@/app/components/FormError";
import {
  MAX_GENERATED_WORDS_COUNT,
  MIN_GENERATED_WORDS_COUNT,
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
} from "../constants";
import { colors } from "@/lib/theme";
import { themeActionButtonClassName, themeOutlineButtonClassName, getThemeActionButtonStyle, themeOutlineButtonStyle, themeModalPanelStyle } from "./themeStyles";

interface GenerateThemeModalProps {
  isOpen: boolean;
  themeName: string;
  themePrompt: string;
  wordType: WordType;
  wordCount: number;
  isGenerating: boolean;
  error?: string | null;
  onThemeNameChange: (name: string) => void;
  onThemePromptChange: (prompt: string) => void;
  onWordTypeChange: (wordType: WordType) => void;
  onWordCountChange: (wordCount: number) => void;
  onGenerate: () => void;
  onClose: () => void;
}

export function GenerateThemeModal({
  isOpen,
  themeName,
  themePrompt,
  wordType,
  wordCount,
  isGenerating,
  error,
  onThemeNameChange,
  onThemePromptChange,
  onWordTypeChange,
  onWordCountChange,
  onGenerate,
  onClose,
}: GenerateThemeModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-testid="theme-generate-modal"
    >
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={themeModalPanelStyle}
      >
        <h2 className="title-font text-xl font-bold mb-4 text-center" style={{ color: colors.text.DEFAULT }}>
          New Theme
        </h2>

        {/* Word Type Toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => onWordTypeChange("nouns")}
            disabled={isGenerating}
            className="flex-1 py-3 rounded-xl font-bold uppercase transition hover:brightness-110 border-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={
              wordType === "nouns"
                ? {
                    backgroundColor: colors.primary.DEFAULT,
                    borderColor: colors.primary.dark,
                    color: colors.text.DEFAULT,
                  }
                : {
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.primary.dark,
                    color: colors.text.muted,
                }
            }
            data-testid="theme-generate-type-nouns"
          >
            Nouns
          </button>
          <button
            onClick={() => onWordTypeChange("verbs")}
            disabled={isGenerating}
            className="flex-1 py-3 rounded-xl font-bold uppercase transition hover:brightness-110 border-2 disabled:opacity-50 disabled:cursor-not-allowed"
            style={
              wordType === "verbs"
                ? {
                    backgroundColor: colors.primary.DEFAULT,
                    borderColor: colors.primary.dark,
                    color: colors.text.DEFAULT,
                  }
                : {
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.primary.dark,
                    color: colors.text.muted,
                }
            }
            data-testid="theme-generate-type-verbs"
          >
            Verbs
          </button>
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
              Generating {wordCount} words... This may take a moment.
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
            style={getThemeActionButtonStyle("cta")}
            data-testid="theme-generate-submit"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className={themeOutlineButtonClassName}
            style={themeOutlineButtonStyle}
            data-testid="theme-generate-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
