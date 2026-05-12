"use client";

import { colors } from "@/lib/theme";
import {
  getThemeActionButtonStyle,
  themeActionButtonClassName,
  themeModalPanelStyle,
  themeOutlineButtonClassName,
  themeOutlineButtonStyle,
} from "./themeStyles";

interface DiscardPickAndPruneModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DiscardPickAndPruneModal({
  isOpen,
  onConfirm,
  onCancel,
}: DiscardPickAndPruneModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      data-testid="theme-pick-prune-discard-modal"
    >
      <div
        className="rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm"
        style={themeModalPanelStyle}
      >
        <h2 className="title-font text-xl font-bold mb-4 text-center" style={{ color: colors.text.DEFAULT }}>
          Discard generated words?
        </h2>

        <p className="text-sm mb-6 text-center" style={{ color: colors.text.muted }}>
          This will drop this Pick & Prune list and no theme will be created.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className={themeOutlineButtonClassName}
            style={themeOutlineButtonStyle}
            data-testid="theme-pick-prune-discard-cancel"
          >
            Keep reviewing
          </button>
          <button
            onClick={onConfirm}
            className={themeActionButtonClassName}
            style={getThemeActionButtonStyle("danger")}
            data-testid="theme-pick-prune-discard-confirm"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
