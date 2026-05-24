"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { CUSTOM_INSTRUCTIONS_MAX_LENGTH } from "@/lib/themes/constants";
import { getThemeActionButtonStyle, getThemeOutlineButtonStyle } from "./themeStyles";
import { wordEditorActionButtonClassName, wordEditorOutlineButtonClassName } from "./wordEditorStyles";

interface ChoiceModeProps {
  promptSummary: string;
  customInstructions: string;
  isGenerating: boolean;
  onCustomInstructionsChange: (value: string) => void;
  onGenerate: () => void;
  onGoToManual: () => void;
  onBack: () => void;
}

export function ChoiceMode({
  promptSummary,
  customInstructions,
  isGenerating,
  onCustomInstructionsChange,
  onGenerate,
  onGoToManual,
  onBack,
}: ChoiceModeProps) {
  const colors = useAppearanceColors();

  return (
    <>
      {/* Human-readable summary */}
      <div
        className="mb-4 p-3 border-2 rounded-xl"
        style={{
          backgroundColor: `${colors.secondary.DEFAULT}0D`,
          borderColor: `${colors.secondary.DEFAULT}33`,
        }}
      >
        <div className="text-xs mb-1" style={{ color: colors.secondary.light }}>
          What the AI will do
        </div>
        <div className="text-sm" style={{ color: colors.text.DEFAULT }}>
          {promptSummary}
        </div>
      </div>

      {/* Custom Instructions */}
      <div className="mb-4">
        <div className="text-xs mb-1" style={{ color: colors.text.muted }}>
          Custom Instructions (optional)
        </div>
        <textarea
          value={customInstructions}
          onChange={(e) => {
            if (e.target.value.length <= CUSTOM_INSTRUCTIONS_MAX_LENGTH) {
              onCustomInstructionsChange(e.target.value);
            }
          }}
          placeholder="Add specifications (e.g., 'use formal language', 'make it more challenging', 'prefer Latin American Spanish')"
          className="w-full p-3 border-2 rounded-xl text-sm focus:outline-none resize-none placeholder:opacity-60"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          rows={3}
          data-testid="word-editor-custom-instructions"
        />
        <div className="text-xs text-right mt-1" style={{ color: colors.text.muted }}>
          {customInstructions.length}/{CUSTOM_INSTRUCTIONS_MAX_LENGTH}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className={wordEditorActionButtonClassName}
          style={getThemeActionButtonStyle("primary", colors)}
          data-testid="word-editor-generate"
        >
          {isGenerating ? "Generating..." : "Generate"}
        </button>
        <button
          onClick={onGoToManual}
          className={wordEditorOutlineButtonClassName}
          style={getThemeOutlineButtonStyle(colors)}
          data-testid="word-editor-manual"
        >
          Manually
        </button>
        <button
          onClick={onBack}
          className={wordEditorOutlineButtonClassName}
          style={getThemeOutlineButtonStyle(colors)}
          data-testid="word-editor-cancel"
        >
          Cancel
        </button>
      </div>
    </>
  );
}
