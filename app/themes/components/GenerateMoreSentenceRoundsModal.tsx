"use client";

import { FormError } from "@/app/components/FormError";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { ModalShell } from "@/app/components/modals/ModalShell";
import {
  themeActionButtonClassName,
  themeOutlineButtonClassName,
  getThemeActionButtonStyle,
  getThemeOutlineButtonStyle,
} from "./themeStyles";
import { SENTENCE_GENERATE_MORE_ROUND_COUNT } from "@/lib/themes/sentenceConstants";

interface GenerateMoreSentenceRoundsModalProps {
  isOpen: boolean;
  themeName: string;
  isGenerating: boolean;
  error: string | null;
  onClose: () => void;
  onGenerate: () => void;
}

/**
 * "Generate more sentence rounds" modal for an existing sentence theme.
 * Mirrors the word "Generate more" modal, but the round count is fixed in v1
 * (defer count picker to a later pass).
 */
export function GenerateMoreSentenceRoundsModal({
  isOpen,
  themeName,
  isGenerating,
  error,
  onClose,
  onGenerate,
}: GenerateMoreSentenceRoundsModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  return (
    <ModalShell
      title={"Generate more sentences"}
      dataTestId="sentence-generate-more-modal"
    >
      <p className="text-sm mb-4" style={{ color: colors.text.muted }}>
        Generate {SENTENCE_GENERATE_MORE_ROUND_COUNT} new sentence rounds for &quot;{themeName}&quot;. New rounds avoid
        duplicating existing kept sentences.
      </p>

      {isGenerating && (
        <div className="mb-4 text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
            style={{ borderColor: colors.cta.light }}
          />
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Generating {SENTENCE_GENERATE_MORE_ROUND_COUNT} more sentences...
          </p>
        </div>
      )}

      {error && !isGenerating && (
        <FormError message={error} className="mb-4" dataTestId="sentence-generate-more-error" />
      )}

      <div className="flex gap-3">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={themeActionButtonClassName}
          style={getThemeActionButtonStyle("cta", colors)}
          data-testid="sentence-generate-more-submit"
        >
          {isGenerating ? "Generating..." : "Generate"}
        </button>
        <button
          onClick={onClose}
          disabled={isGenerating}
          className={themeOutlineButtonClassName}
          style={getThemeOutlineButtonStyle(colors)}
          data-testid="sentence-generate-more-cancel"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
