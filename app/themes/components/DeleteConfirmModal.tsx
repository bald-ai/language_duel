"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { themeActionButtonClassName, themeOutlineButtonClassName, getThemeOutlineButtonStyle, getThemeModalPanelStyle } from "./themeStyles";

import { cssVarColors as colors } from "@/app/components/themeCssVars";
interface DeleteConfirmModalProps {
  isOpen: boolean;
  itemName: string;
  itemType: "theme" | "word";
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const dangerActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${colors.status.danger.DEFAULT}, ${colors.status.danger.dark})`,
  borderTopColor: colors.status.danger.light,
  borderBottomColor: colors.status.danger.dark,
  borderLeftColor: colors.status.danger.DEFAULT,
  borderRightColor: colors.status.danger.DEFAULT,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

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

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-testid={`theme-delete-modal-${itemType}`}
    >
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={getThemeModalPanelStyle(colors)}
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
            className={themeOutlineButtonClassName}
            style={getThemeOutlineButtonStyle(colors)}
            data-testid="theme-delete-cancel"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className={themeActionButtonClassName}
            style={dangerActionStyle}
            data-testid="theme-delete-confirm"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
