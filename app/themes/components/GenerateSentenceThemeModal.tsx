"use client";

import { useState } from "react";
import { FormError } from "@/app/components/FormError";
import {
  THEME_NAME_MAX_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
} from "../constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { ModalShell } from "@/app/components/modals/ModalShell";
import {
  themeActionButtonClassName,
  themeOutlineButtonClassName,
  getThemeActionButtonStyle,
  getThemeOutlineButtonStyle,
} from "./themeStyles";
import {
  DEFAULT_SENTENCE_GENERATION_ROUND_COUNT,
  SENTENCE_PICK_AND_PRUNE_ROUND_COUNT,
} from "@/lib/themes/sentenceConstants";

interface GenerateSentenceThemeModalProps {
  isOpen: boolean;
  isGenerating: boolean;
  error: string | null;
  onClose: () => void;
  onGenerate: (params: { themeName: string; themePrompt: string }) => void;
}

/**
 * Sentence-theme generate modal. Always over-generates (Pick & Prune mode) so
 * the user reviews and prunes the result. v1 doesn't offer a "standard"
 * direct-generate path — the plan recommends Pick & Prune as the default for
 * sentence themes because sentence quality is harder to validate at a glance.
 */
export function GenerateSentenceThemeModal({
  isOpen,
  isGenerating,
  error,
  onClose,
  onGenerate,
}: GenerateSentenceThemeModalProps) {
  const colors = useAppearanceColors();
  const [themeName, setThemeName] = useState("");
  const [themePrompt, setThemePrompt] = useState("");

  if (!isOpen) return null;

  return (
    <ModalShell title="New Sentence Theme" dataTestId="sentence-theme-generate-modal">
      <div className="mb-6 space-y-4">
        <div>
          <input
            type="text"
            value={themeName}
            onChange={(event) => {
              if (event.target.value.length <= THEME_NAME_MAX_LENGTH) {
                setThemeName(event.target.value);
              }
            }}
            placeholder="Theme name (e.g. Ordering coffee)"
            maxLength={THEME_NAME_MAX_LENGTH}
            className="w-full p-4 border-2 rounded-xl focus:outline-none placeholder:opacity-60"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
            disabled={isGenerating}
            data-testid="sentence-theme-generate-name"
          />
          <p className="text-xs mt-1 text-right" style={{ color: colors.text.muted }}>
            {themeName.length}/{THEME_NAME_MAX_LENGTH}
          </p>
        </div>

        <div>
          <textarea
            value={themePrompt}
            onChange={(event) => {
              if (event.target.value.length <= THEME_PROMPT_MAX_LENGTH) {
                setThemePrompt(event.target.value);
              }
            }}
            placeholder="Optional: tone / context / target grammar"
            maxLength={THEME_PROMPT_MAX_LENGTH}
            rows={2}
            className="w-full p-4 border-2 rounded-xl focus:outline-none resize-none placeholder:opacity-60"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
            disabled={isGenerating}
            data-testid="sentence-theme-generate-prompt"
          />
          <p className="text-xs mt-1 text-right" style={{ color: colors.text.muted }}>
            {themePrompt.length}/{THEME_PROMPT_MAX_LENGTH}
          </p>
        </div>

        <div className="text-xs" style={{ color: colors.text.muted }}>
          We&apos;ll generate {SENTENCE_PICK_AND_PRUNE_ROUND_COUNT} short Spanish sentences (target {DEFAULT_SENTENCE_GENERATION_ROUND_COUNT} kept). Edit any field before saving.
        </div>
      </div>

      {isGenerating && (
        <div className="mb-4 text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
            style={{ borderColor: colors.cta.light }}
          />
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Generating {SENTENCE_PICK_AND_PRUNE_ROUND_COUNT} sentences. This may take a moment.
          </p>
        </div>
      )}

      {error && !isGenerating && (
        <FormError message={error} className="mb-4" dataTestId="sentence-theme-generate-error" />
      )}

      <div className="flex gap-3">
        <button
          onClick={() => onGenerate({ themeName, themePrompt })}
          disabled={!themeName.trim() || isGenerating}
          className={themeActionButtonClassName}
          style={getThemeActionButtonStyle("cta", colors)}
          data-testid="sentence-theme-generate-submit"
        >
          {isGenerating ? "Generating..." : "Generate"}
        </button>
        <button
          onClick={onClose}
          disabled={isGenerating}
          className={themeOutlineButtonClassName}
          style={getThemeOutlineButtonStyle(colors)}
          data-testid="sentence-theme-generate-cancel"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
