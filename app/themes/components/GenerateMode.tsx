"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { THEME_USER_FEEDBACK_MAX_LENGTH } from "@/lib/themes/constants";
import type { FieldType } from "../constants";
import { getThemeActionButtonStyle, getThemeOutlineButtonStyle } from "./themeStyles";
import { wordEditorActionButtonClassName, wordEditorOutlineButtonClassName } from "./wordEditorStyles";

interface GenerateModeProps {
  fieldLabel: string;
  editingField: FieldType;
  oldValue: string;
  generatedValue: string;
  userFeedback: string;
  isGenerating: boolean;
  onUserFeedbackChange: (value: string) => void;
  onAcceptGenerated: () => void;
  onRegenerate: () => void;
  onBack: () => void;
}

export function GenerateMode({
  fieldLabel,
  editingField,
  oldValue,
  generatedValue,
  userFeedback,
  isGenerating,
  onUserFeedbackChange,
  onAcceptGenerated,
  onRegenerate,
  onBack,
}: GenerateModeProps) {
  const colors = useAppearanceColors();

  return (
    <>
      {/* Old vs New Comparison */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div
          className="p-3 border-2 rounded-xl"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
          }}
        >
          <div className="text-xs mb-1" style={{ color: colors.text.muted }}>
            Old {fieldLabel}
          </div>
          <div className="text-lg font-bold" style={{ color: colors.text.DEFAULT }}>
            {oldValue}
          </div>
        </div>
        <div
          className="p-3 border-2 rounded-xl"
          style={{
            backgroundColor: `${colors.secondary.DEFAULT}1A`,
            borderColor: `${colors.secondary.DEFAULT}66`,
            color: colors.secondary.light,
          }}
        >
          <div className="text-xs mb-1" style={{ color: colors.secondary.light }}>
            New {fieldLabel}
          </div>
          <div className="text-lg font-bold" style={{ color: colors.text.DEFAULT }}>
            {generatedValue}
          </div>
        </div>
      </div>

      {editingField !== "word" && (
        <div className="mb-4">
          <div className="text-xs mb-1" style={{ color: colors.text.muted }}>
            Feedback for regeneration (optional)
          </div>
          <textarea
            value={userFeedback}
            onChange={(e) => {
              if (e.target.value.length <= THEME_USER_FEEDBACK_MAX_LENGTH) {
                onUserFeedbackChange(e.target.value);
              }
            }}
            placeholder="e.g. Make the wrong answer more challenging"
            className="w-full p-3 border-2 rounded-xl text-sm focus:outline-none resize-none placeholder:opacity-60"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
            rows={3}
            maxLength={THEME_USER_FEEDBACK_MAX_LENGTH}
            data-testid="word-editor-user-feedback"
          />
          <div className="text-xs text-right mt-1" style={{ color: colors.text.muted }}>
            {userFeedback.length}/{THEME_USER_FEEDBACK_MAX_LENGTH}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onAcceptGenerated}
          className={wordEditorActionButtonClassName}
          style={getThemeActionButtonStyle("primary", colors)}
          data-testid="word-editor-accept"
        >
          Accept
        </button>
        <button
          onClick={onRegenerate}
          disabled={isGenerating}
          className={wordEditorOutlineButtonClassName}
          style={getThemeOutlineButtonStyle(colors)}
          data-testid="word-editor-regenerate"
        >
          {isGenerating ? "..." : "Regenerate"}
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
