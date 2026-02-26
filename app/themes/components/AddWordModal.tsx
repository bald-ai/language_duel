"use client";

import { buttonStyles, colors } from "@/lib/theme";
import { THEME_WORD_INPUT_MAX_LENGTH } from "@/lib/themes/constants";

interface AddWordModalProps {
  isOpen: boolean;
  newWordInput: string;
  isAdding: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  onClose: () => void;
}

const actionButtonClassName =
  "flex-1 bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

const primaryActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.primary.gradient.from}, ${buttonStyles.primary.gradient.to})`,
  borderTopColor: buttonStyles.primary.border.top,
  borderBottomColor: buttonStyles.primary.border.bottom,
  borderLeftColor: buttonStyles.primary.border.sides,
  borderRightColor: buttonStyles.primary.border.sides,
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

export function AddWordModal({
  isOpen,
  newWordInput,
  isAdding,
  error,
  onInputChange,
  onAdd,
  onClose,
}: AddWordModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-testid="theme-add-word-modal"
    >
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 20px 60px ${colors.primary.glow}`,
        }}
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

        {error && (
          <div
            className="mb-4 p-3 border-2 rounded-xl text-sm"
            style={{
              backgroundColor: `${colors.status.danger.DEFAULT}1A`,
              borderColor: `${colors.status.danger.DEFAULT}66`,
              color: colors.status.danger.light,
            }}
          >
            {error}
          </div>
        )}

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
            className={actionButtonClassName}
            style={primaryActionStyle}
            data-testid="theme-add-word-submit"
          >
            {isAdding ? "Adding..." : "Add"}
          </button>
          <button
            onClick={onClose}
            disabled={isAdding}
            className={outlineButtonClassName}
            style={outlineButtonStyle}
            data-testid="theme-add-word-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
