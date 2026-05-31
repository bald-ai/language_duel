"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { ConfirmModal } from "@/app/components/modals/ConfirmModal";

interface DiscardPickAndPruneModalProps {
  isOpen: boolean;
  reviewKind: "new-theme" | "existing-theme";
  generatedItemLabel?: "words" | "sentences";
  onConfirm: () => void;
  onCancel: () => void;
}

export function DiscardPickAndPruneModal({
  isOpen,
  reviewKind,
  generatedItemLabel = "words",
  onConfirm,
  onCancel,
}: DiscardPickAndPruneModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  const reviewListLabel =
    generatedItemLabel === "sentences" ? "sentence Pick & Prune list" : "Pick & Prune list";
  const message =
    reviewKind === "existing-theme"
      ? `These generated ${generatedItemLabel} will not be added to the current theme.`
      : `This will drop this ${reviewListLabel} and no theme will be created.`;

  return (
    <ConfirmModal
      title={`Discard generated ${generatedItemLabel}?`}
      confirm={{
        label: "Discard",
        onClick: onConfirm,
        variant: "danger",
        testId: "theme-pick-prune-discard-confirm",
      }}
      cancel={{
        label: "Keep reviewing",
        onClick: onCancel,
        testId: "theme-pick-prune-discard-cancel",
      }}
      testId="theme-pick-prune-discard-modal"
    >
      <p
        className="text-sm mb-6 text-center"
        style={{ color: colors.text.muted }}
        data-testid="theme-pick-prune-discard-message"
      >
        {message}
      </p>
    </ConfirmModal>
  );
}
