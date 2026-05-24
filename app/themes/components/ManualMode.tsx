"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { getThemeActionButtonStyle, getThemeOutlineButtonStyle } from "./themeStyles";
import { wordEditorActionButtonClassName, wordEditorOutlineButtonClassName } from "./wordEditorStyles";

interface ManualModeProps {
  manualValue: string;
  manualMaxLength: number;
  onManualValueChange: (value: string) => void;
  onSaveManual: () => void;
  onBack: () => void;
}

export function ManualMode({
  manualValue,
  manualMaxLength,
  onManualValueChange,
  onSaveManual,
  onBack,
}: ManualModeProps) {
  const colors = useAppearanceColors();

  return (
    <>
      {/* Manual Input */}
      <div className="mb-4">
        <div className="text-sm mb-2" style={{ color: colors.text.muted }}>
          Enter new value:
        </div>
        <input
          type="text"
          value={manualValue}
          onChange={(e) => {
            if (e.target.value.length <= manualMaxLength) {
              onManualValueChange(e.target.value);
            }
          }}
          className="w-full p-4 border-2 rounded-xl text-lg focus:outline-none"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          maxLength={manualMaxLength}
          autoFocus
          data-testid="word-editor-manual-input"
        />
        <div className="text-xs text-right mt-1" style={{ color: colors.text.muted }}>
          {manualValue.length}/{manualMaxLength}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onSaveManual}
          disabled={!manualValue.trim()}
          className={wordEditorActionButtonClassName}
          style={getThemeActionButtonStyle("primary", colors)}
          data-testid="word-editor-save-manual"
        >
          Save
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
