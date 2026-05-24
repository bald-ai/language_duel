"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { ConfirmModal } from "@/app/components/modals/ConfirmModal";

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
    <ConfirmModal
      title="Regenerate Answers?"
      confirm={{
        label: isRegenerating ? "..." : "Yes",
        onClick: onConfirm,
        variant: "primary",
        testId: "theme-regenerate-confirm",
      }}
      tertiary={{ label: "No", onClick: onSkip, testId: "theme-regenerate-skip" }}
      cancel={{ label: "Cancel", onClick: onCancel, testId: "theme-regenerate-cancel" }}
      busy={isRegenerating}
      testId="theme-regenerate-modal"
    >
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
    </ConfirmModal>
  );
}
