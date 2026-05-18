"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { themeActionButtonClassName, themeOutlineButtonClassName, getThemeActionButtonStyle, getThemeOutlineButtonStyle, getThemeModalPanelStyle } from "./themeStyles";

interface RegenerateConfirmModalProps {
  isOpen: boolean;
  pendingWord: string;
  isRegenerating: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function RegenerateConfirmModal({
  isOpen,
  pendingWord,
  isRegenerating,
  onConfirm,
  onSkip,
  onCancel,
}: RegenerateConfirmModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-testid="theme-regenerate-modal"
    >
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={getThemeModalPanelStyle(colors)}
      >
        <h2 className="title-font text-xl font-bold mb-4 text-center" style={{ color: colors.text.DEFAULT }}>
          Regenerate Answers?
        </h2>

        <div
          className="mb-4 p-3 border-2 rounded-xl"
          style={{
            backgroundColor: `${colors.secondary.DEFAULT}1A`,
            borderColor: `${colors.secondary.DEFAULT}66`,
          }}
        >
          <div className="text-xs mb-1" style={{ color: colors.secondary.light }}>
            New Word
          </div>
          <div className="text-lg font-bold" style={{ color: colors.text.DEFAULT }}>
            {pendingWord}
          </div>
        </div>

        <p className="text-sm mb-6 text-center" style={{ color: colors.text.muted }}>
          You changed the word. Would you like to regenerate the correct answer and wrong answers to match the new word?
        </p>

        {isRegenerating && (
          <div className="mb-4 text-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-2"
              style={{ borderColor: colors.cta.light }}
            />
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Generating new answers...
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            disabled={isRegenerating}
            className={themeActionButtonClassName}
            style={getThemeActionButtonStyle("primary", colors)}
            data-testid="theme-regenerate-confirm"
          >
            {isRegenerating ? "..." : "Yes"}
          </button>
          <button
            onClick={onSkip}
            disabled={isRegenerating}
            className={themeOutlineButtonClassName}
            style={getThemeOutlineButtonStyle(colors)}
            data-testid="theme-regenerate-skip"
          >
            No
          </button>
          <button
            onClick={onCancel}
            disabled={isRegenerating}
            className={themeOutlineButtonClassName}
            style={getThemeOutlineButtonStyle(colors)}
            data-testid="theme-regenerate-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
