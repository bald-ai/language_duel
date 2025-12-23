"use client";

import type { WordType } from "@/lib/themes";
import {
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
  GENERATED_WORDS_COUNT,
} from "../constants";
import { buttonStyles, colors } from "@/lib/theme";

interface GenerateThemeModalProps {
  isOpen: boolean;
  themeName: string;
  themePrompt: string;
  wordType: WordType;
  isGenerating: boolean;
  onThemeNameChange: (name: string) => void;
  onThemePromptChange: (prompt: string) => void;
  onWordTypeChange: (wordType: WordType) => void;
  onGenerate: () => void;
  onClose: () => void;
}

const actionButtonClassName =
  "flex-1 bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

const ctaActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.cta.gradient.from}, ${buttonStyles.cta.gradient.to})`,
  borderTopColor: buttonStyles.cta.border.top,
  borderBottomColor: buttonStyles.cta.border.bottom,
  borderLeftColor: buttonStyles.cta.border.sides,
  borderRightColor: buttonStyles.cta.border.sides,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

const outlineButtonClassName =
  "flex-1 border-2 rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed";

const outlineButtonStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.primary.dark,
  color: colors.text.DEFAULT,
};

export function GenerateThemeModal({
  isOpen,
  themeName,
  themePrompt,
  wordType,
  isGenerating,
  onThemeNameChange,
  onThemePromptChange,
  onWordTypeChange,
  onGenerate,
  onClose,
}: GenerateThemeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 20px 60px ${colors.primary.glow}`,
        }}
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
            />
            <p className="text-xs mt-1 text-right" style={{ color: colors.text.muted }}>
              {themePrompt.length}/{THEME_PROMPT_MAX_LENGTH}
            </p>
          </div>
        </div>

        {isGenerating && (
          <div className="mb-4 text-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
              style={{ borderColor: colors.cta.light }}
            />
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Generating {GENERATED_WORDS_COUNT} words... This may take a moment.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onGenerate}
            disabled={!themeName.trim() || isGenerating}
            className={actionButtonClassName}
            style={ctaActionStyle}
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className={outlineButtonClassName}
            style={outlineButtonStyle}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
