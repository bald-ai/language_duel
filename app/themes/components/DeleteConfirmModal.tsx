"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { ConfirmModal } from "@/app/components/modals/ConfirmModal";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  itemName: string;
  itemType: "theme" | "word";
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  itemName,
  itemType,
  isDeleting = false,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  const colors = useAppearanceColors();
  if (!isOpen) return null;

  const label = itemType === "theme" ? "Theme" : "Word";

  return (
    <ConfirmModal
      title={`Delete ${label}?`}
      confirm={{
        label: isDeleting ? "Deleting..." : "Delete",
        onClick: onConfirm,
        variant: "danger",
        testId: "theme-delete-confirm",
      }}
      cancel={{ label: "Cancel", onClick: onCancel, testId: "theme-delete-cancel" }}
      busy={isDeleting}
      testId={`theme-delete-modal-${itemType}`}
    >
      <div
        className="mb-4 p-3 border-2 rounded-xl"
        style={{
          backgroundColor: `${colors.status.danger.DEFAULT}1A`,
          borderColor: `${colors.status.danger.DEFAULT}66`,
        }}
      >
        <div className="text-xs mb-1" style={{ color: colors.status.danger.light }}>
          {label}
        </div>
        <div className="text-lg font-bold" style={{ color: colors.status.danger.light }}>
          {itemName}
        </div>
      </div>

      <p className="text-sm mb-6 text-center" style={{ color: colors.text.muted }}>
        {itemType === "theme"
          ? "This will permanently delete this theme and all its words."
          : "This will remove the word from this theme."}
      </p>
    </ConfirmModal>
  );
}
