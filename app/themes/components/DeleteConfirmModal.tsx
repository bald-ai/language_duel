"use client";

import { colors } from "@/lib/theme";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  itemName: string;
  itemType: "theme" | "word";
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const actionButtonClassName =
  "flex-1 bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed";

const dangerActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${colors.status.danger.DEFAULT}, ${colors.status.danger.dark})`,
  borderTopColor: colors.status.danger.light,
  borderBottomColor: colors.status.danger.dark,
  borderLeftColor: colors.status.danger.DEFAULT,
  borderRightColor: colors.status.danger.DEFAULT,
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

export function DeleteConfirmModal({
  isOpen,
  itemName,
  itemType,
  isDeleting = false,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 20px 60px ${colors.primary.glow}`,
        }}
      >
        <h2 className="title-font text-xl font-bold mb-4 text-center" style={{ color: colors.text.DEFAULT }}>
          Delete {itemType === "theme" ? "Theme" : "Word"}?
        </h2>

        <div
          className="mb-4 p-3 border-2 rounded-xl"
          style={{
            backgroundColor: `${colors.status.danger.DEFAULT}1A`,
            borderColor: `${colors.status.danger.DEFAULT}66`,
          }}
        >
          <div className="text-xs mb-1" style={{ color: colors.status.danger.light }}>
            {itemType === "theme" ? "Theme" : "Word"}
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

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className={outlineButtonClassName}
            style={outlineButtonStyle}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={actionButtonClassName}
            style={dangerActionStyle}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
