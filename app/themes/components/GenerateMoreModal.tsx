"use client";

import {
  GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
  MAX_GENERATE_MORE_WORD_COUNT,
} from "../constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { FormError } from "@/app/components/FormError";
import { ModalShell } from "@/app/components/modals/ModalShell";
import { PickAndPruneCta } from "./PickAndPruneCta";
import { themeActionButtonClassName, themeOutlineButtonClassName, getThemeActionButtonStyle, getThemeOutlineButtonStyle } from "./themeStyles";

interface GenerateMoreModalProps {
  isOpen: boolean;
  themeName: string;
  count: number;
  isGenerating: boolean;
  pickAndPrune: boolean;
  error: string | null;
  onCountChange: (count: number) => void;
  onGenerate: () => void;
  onGeneratePickAndPrune: () => void;
  onClose: () => void;
}

export function GenerateMoreModal({
  isOpen,
  themeName,
  count,
  isGenerating,
  pickAndPrune,
  error,
  onCountChange,
  onGenerate,
  onGeneratePickAndPrune,
  onClose,
}: GenerateMoreModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  return (
    <ModalShell title="Generate More Words" dataTestId="theme-generate-more-modal">
      <div className="mb-4">
        <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>
          Number of words to generate (1-{MAX_GENERATE_MORE_WORD_COUNT})
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="1"
            max={MAX_GENERATE_MORE_WORD_COUNT}
            value={count}
            onChange={(e) => onCountChange(parseInt(e.target.value))}
            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
            style={{ backgroundColor: colors.primary.dark }}
            disabled={isGenerating}
            data-testid="theme-generate-more-range"
          />
          <span className="w-8 text-center text-xl font-bold" style={{ color: colors.text.DEFAULT }}>
            {count}
          </span>
        </div>
      </div>

      <p className="text-sm mb-4 text-center" style={{ color: colors.text.muted }}>
        This will generate {count} new unique word{count > 1 ? "s" : ""} for the theme &quot;{themeName}&quot;
      </p>

      {error && <FormError message={error} className="mb-4" />}

      {isGenerating && (
        <div className="mb-4 text-center">
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
            style={{ borderColor: colors.cta.light }}
          />
          <p className="text-sm" style={{ color: colors.text.muted }}>
            {pickAndPrune
              ? `Generating ${GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT} words for Pick & Prune... This may take a moment.`
              : `Generating ${count} words... This may take a moment.`}
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

      <PickAndPruneCta
        description={`Click Try to generate ${GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT} new unique words for this theme, then review which ones to keep.`}
        onTry={onGeneratePickAndPrune}
        disabled={isGenerating}
        infoTestId="theme-generate-more-pick-prune-info"
        tryTestId="theme-generate-more-pick-prune-try"
      />
    </ModalShell>
  );
}
