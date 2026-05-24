"use client";

import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { BackButton } from "@/app/components/BackButton";
import { getThemeActionButtonStyle, getThemeOutlineButtonStyle } from "./themeStyles";

const rowActionButtonClassName =
  "flex-1 bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-2xl py-2.5 px-4 text-xs sm:text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg";

const outlineButtonClassName =
  "flex-1 border-2 rounded-2xl py-2.5 px-3 text-xs sm:text-sm font-bold uppercase tracking-wider transition hover:brightness-110";

interface ThemeActionDockProps {
  canEdit: boolean;
  isSaving: boolean;
  isSaveDisabled: boolean;
  hasThemeIssues: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function ThemeActionDock({
  canEdit,
  isSaving,
  isSaveDisabled,
  hasThemeIssues,
  onSave,
  onCancel,
}: ThemeActionDockProps) {
  const colors = useAppearanceColors();

  return (
    <div className="w-full flex-shrink-0 pt-4 animate-slide-up delay-200">
      <div
        className="rounded-2xl border-2 p-2 backdrop-blur-sm shadow-lg"
        style={{
          backgroundColor: `${colors.background.DEFAULT}E6`,
          borderColor: colors.primary.dark,
        }}
      >
        <div className="flex gap-2">
          {canEdit ? (
            <>
              <button
                onClick={onSave}
                disabled={isSaveDisabled}
                className={`${rowActionButtonClassName} disabled:opacity-50 disabled:cursor-not-allowed`}
                style={getThemeActionButtonStyle("cta", colors)}
                data-testid="theme-save"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={onCancel}
                disabled={isSaving}
                className={`${outlineButtonClassName} disabled:opacity-50 disabled:cursor-not-allowed`}
                style={getThemeOutlineButtonStyle(colors)}
                data-testid="theme-cancel"
              >
                Cancel
              </button>
            </>
          ) : (
            <BackButton onClick={onCancel} dataTestId="theme-back" />
          )}
        </div>
        {canEdit && hasThemeIssues && (
          <div
            className="mt-2 rounded-xl border-2 px-3 py-1 text-[11px] font-medium"
            style={{
              backgroundColor: `${colors.status.danger.DEFAULT}1A`,
              borderColor: `${colors.status.danger.DEFAULT}66`,
              color: colors.status.danger.light,
            }}
          >
            Fix highlighted words to enable saving.
          </div>
        )}
      </div>
    </div>
  );
}
