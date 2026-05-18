"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { THEME_WORD_INPUT_MAX_LENGTH } from "@/lib/themes/constants";
import { FormError } from "@/app/components/FormError";
import { themeActionButtonClassName, themeOutlineButtonClassName, getThemeActionButtonStyle, getThemeOutlineButtonStyle, getThemeModalPanelStyle } from "./themeStyles";

interface AddWordModalProps {
  isOpen: boolean;
  newWordInput: string;
  isAdding: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

export function AddWordModal({
  isOpen,
  newWordInput,
  isAdding,
  error,
  onInputChange,
  onAdd,
  onClose,
}: AddWordModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-testid="theme-add-word-modal"
    >
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={getThemeModalPanelStyle(colors)}
      >
        <h2 className="title-font text-xl font-bold mb-4 text-center" style={{ color: colors.text.DEFAULT }}>
          Add New Word
        </h2>

        <div className="mb-4">
          <label className="block text-sm mb-2" style={{ color: colors.text.muted }}>
            English Word
          </label>
          <input
            type="text"
            value={newWordInput}
            onChange={(e) => {
              if (e.target.value.length <= THEME_WORD_INPUT_MAX_LENGTH) {
                onInputChange(e.target.value);
              }
            }}
            placeholder="Enter an English word..."
            className="w-full p-4 border-2 rounded-xl focus:outline-none placeholder:opacity-60"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
            maxLength={THEME_WORD_INPUT_MAX_LENGTH}
            disabled={isAdding}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && newWordInput.trim()) {
                onAdd();
              }
            }}
            data-testid="theme-add-word-input"
          />
          <p className="text-xs mt-1 text-right" style={{ color: colors.text.muted }}>
            {newWordInput.length}/{THEME_WORD_INPUT_MAX_LENGTH}
          </p>
        </div>

        {error && <FormError message={error} className="mb-4" />}

        {isAdding && (
          <div className="mb-4 text-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
              style={{ borderColor: colors.cta.light }}
            />
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Generating Spanish translation and wrong answers...
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onAdd}
            disabled={!newWordInput.trim() || isAdding}
            className={themeActionButtonClassName}
            style={getThemeActionButtonStyle("primary", colors)}
            data-testid="theme-add-word-submit"
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
          <button
            onClick={onClose}
            disabled={isAdding}
            className={themeOutlineButtonClassName}
            style={getThemeOutlineButtonStyle(colors)}
            data-testid="theme-add-word-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
