"use client";

import { buttonStyles, colors } from "@/lib/theme";

interface RegenerateConfirmModalProps {
  isOpen: boolean;
  pendingWord: string;
  isRegenerating: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onCancel: () => void;
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

export function RegenerateConfirmModal({
  isOpen,
  pendingWord,
  isRegenerating,
  onConfirm,
  onSkip,
  onCancel,
}: RegenerateConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-testid="theme-regenerate-modal"
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
            className={actionButtonClassName}
            style={primaryActionStyle}
            data-testid="theme-regenerate-confirm"
          >
            {isRegenerating ? "..." : "Yes"}
          </button>
          <button
            onClick={onSkip}
            disabled={isRegenerating}
            className={outlineButtonClassName}
            style={outlineButtonStyle}
            data-testid="theme-regenerate-skip"
          >
            No
          </button>
          <button
            onClick={onCancel}
            disabled={isRegenerating}
            className={outlineButtonClassName}
            style={outlineButtonStyle}
            data-testid="theme-regenerate-cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
