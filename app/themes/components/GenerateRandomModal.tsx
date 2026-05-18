"use client";

import {
  GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
  MAX_RANDOM_WORD_COUNT,
} from "../constants";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { FormError } from "@/app/components/FormError";
import { themeActionButtonClassName, themeOutlineButtonClassName, getThemeActionButtonStyle, getThemeOutlineButtonStyle, getThemeModalPanelStyle } from "./themeStyles";

interface GenerateRandomModalProps {
  isOpen: boolean;
  themeName: string;
  count: number;
  isGenerating: boolean;
  generationMode: "standard" | "pick-and-prune" | null;
  error: string | null;
  onCountChange: (count: number) => void;
  onGenerate: () => void;
  onGeneratePickAndPrune: () => void;
  onClose: () => void;
}

export function GenerateRandomModal({
  isOpen,
  themeName,
  count,
  isGenerating,
  generationMode,
  error,
  onCountChange,
  onGenerate,
  onGeneratePickAndPrune,
  onClose,
}: GenerateRandomModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-testid="theme-generate-random-modal"
    >
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={getThemeModalPanelStyle(colors)}
      >
        <h2 className="title-font text-xl font-bold mb-4 text-center" style={{ color: colors.text.DEFAULT }}>
          Generate Random Words
        </h2>

        <div className="mb-4">
          <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>
            Number of words to generate (1-{MAX_RANDOM_WORD_COUNT})
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="1"
              max={MAX_RANDOM_WORD_COUNT}
              value={count}
              onChange={(e) => onCountChange(parseInt(e.target.value))}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
              style={{ backgroundColor: colors.primary.dark }}
              disabled={isGenerating}
              data-testid="theme-generate-random-range"
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
              {generationMode === "pick-and-prune"
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
            data-testid="theme-generate-random-submit"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className={themeOutlineButtonClassName}
            style={getThemeOutlineButtonStyle(colors)}
            data-testid="theme-generate-random-cancel"
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
          data-testid="theme-generate-random-pick-prune-info"
        >
          <p
            className="text-xs font-bold uppercase tracking-[0.2em]"
            style={{ color: colors.primary.light }}
          >
            Try Pick & Prune
          </p>
          <p className="mt-1 text-xs" style={{ color: colors.text.muted }}>
            Click Try to generate {GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT} new unique words for this theme, then review which ones to keep.
          </p>
          <button
            type="button"
            onClick={onGeneratePickAndPrune}
            disabled={isGenerating}
            className={`${themeOutlineButtonClassName} mt-3 w-full`}
            style={getThemeOutlineButtonStyle(colors)}
            data-testid="theme-generate-random-pick-prune-try"
          >
            Try
          </button>
        </div>
      </div>
    </div>
  );
}
