"use client";

import {
  GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
} from "../constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { FormError } from "@/app/components/FormError";
import { ModalShell } from "@/app/components/modals/ModalShell";
import { themeActionButtonClassName, themeOutlineButtonClassName, getThemeActionButtonStyle, getThemeOutlineButtonStyle } from "./themeStyles";

interface GenerateMoreModalProps {
  isOpen: boolean;
  themeName: string;
  isGenerating: boolean;
  error: string | null;
  onGenerate: () => void;
  onClose: () => void;
}

export function GenerateMoreModal({
  isOpen,
  themeName,
  isGenerating,
  error,
  onGenerate,
  onClose,
}: GenerateMoreModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  return (
    <ModalShell title="Generate More Words" dataTestId="theme-generate-more-modal">
      <p className="text-sm mb-4 text-center" style={{ color: colors.text.muted }}>
        Generate {GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT} new unique words for &quot;{themeName}&quot;, then review which ones to keep.
      </p>

      {error && <FormError message={error} className="mb-4" />}

      {isGenerating && (
        <div className="mb-4 text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
            style={{ borderColor: colors.cta.light }}
          />
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Generating {GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT} words for Pick & Prune... This may take a moment.
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={themeActionButtonClassName}
          style={getThemeActionButtonStyle("primary", colors)}
          data-testid="theme-generate-more-submit"
        >
          {isGenerating ? "Generating..." : "Generate"}
        </button>
        <button
          onClick={onClose}
          disabled={isGenerating}
          className={themeOutlineButtonClassName}
          style={getThemeOutlineButtonStyle(colors)}
          data-testid="theme-generate-more-cancel"
        >
          Cancel
        </button>
      </div>
    </ModalShell>
  );
}
