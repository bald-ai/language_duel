"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { WeeklyGoalThemeMarker } from "@/app/components/WeeklyGoalThemeMarker";
import { useWeeklyGoalThemeIds } from "@/hooks/useWeeklyGoalThemeIds";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import type { ModalTheme } from "./types";

interface ThemeSelectorProps {
  themes: ModalTheme[] | undefined;
  selectedThemeIds: Id<"themes">[];
  onConfirmSelection: (themeIds: Id<"themes">[]) => void;
  onCreateTheme: () => void;
  emptyMessage?: string;
  confirmLabel?: string;
  draftThemeIds?: Id<"themes">[];
  onDraftThemeIdsChange?: (themeIds: Id<"themes">[]) => void;
  hideConfirmButton?: boolean;
  hideCreateThemeButton?: boolean;
  /** Dense layout for embedding (e.g. the challenge modal): scroll cap + "Selected" summary footer. */
  compact?: boolean;
  /** Per-row testid prefix; each row is `${itemTestIdPrefix}-${themeId}`. */
  itemTestIdPrefix?: string;
}

function ThemeCheckmark({ className }: { className: string }) {
  return (
    <svg className={className} fill="white" viewBox="0 0 20 20">
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function ThemeSelector({
  themes,
  selectedThemeIds,
  onConfirmSelection,
  onCreateTheme,
  emptyMessage = "No themes available yet.",
  confirmLabel = "Confirm Themes",
  draftThemeIds: controlledDraftThemeIds,
  onDraftThemeIdsChange,
  hideConfirmButton = false,
  hideCreateThemeButton = false,
  compact = false,
  itemTestIdPrefix = "theme-selector-item",
}: ThemeSelectorProps) {
  const colors = useAppearanceColors();
  const [internalDraftThemeIds, setInternalDraftThemeIds] = useState<Id<"themes">[]>(selectedThemeIds);
  const draftThemeIds = controlledDraftThemeIds ?? internalDraftThemeIds;
  const setDraftThemeIds = onDraftThemeIdsChange ?? setInternalDraftThemeIds;
  const goalThemeIds = useWeeklyGoalThemeIds();

  const handleToggleTheme = (themeId: Id<"themes">) => {
    const nextThemeIds = draftThemeIds.includes(themeId)
      ? draftThemeIds.filter((currentThemeId) => currentThemeId !== themeId)
      : [...draftThemeIds, themeId];
    setDraftThemeIds(nextThemeIds);
  };

  if (!themes) {
    return (
      <div
        className={`text-center border-2 rounded-2xl ${compact ? "p-4" : "p-6"}`}
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <p className="text-sm" style={{ color: colors.text.muted }}>
          Loading themes...
        </p>
      </div>
    );
  }

  if (themes.length === 0) {
    return (
      <div
        className={`text-center border-2 rounded-2xl ${compact ? "p-4" : "p-6"}`}
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <p className={`text-sm ${compact ? "mb-3" : "mb-4"}`} style={{ color: colors.text.muted }}>
          {emptyMessage}
        </p>
        {!hideCreateThemeButton && (
          <button
            onClick={onCreateTheme}
            className={`border-2 rounded-xl py-2 text-sm font-bold uppercase tracking-widest transition hover:brightness-110 ${
              compact ? "px-4" : "w-full"
            }`}
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
            data-testid="theme-selector-create"
          >
            {compact ? "Create Theme" : "Create your first theme"}
          </button>
        )}
      </div>
    );
  }

  // Dense, scroll-capped list with a "Selected:" summary footer (embedded usage).
  if (compact) {
    const selectedThemes = themes.filter((theme) => draftThemeIds.includes(theme._id));
    return (
      <div
        className="border-2 rounded-2xl overflow-hidden"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <div className="max-h-40 overflow-y-auto">
          {themes.map((theme, index) => {
            const isSelected = draftThemeIds.includes(theme._id);
            return (
              <button
                key={theme._id}
                onClick={() => handleToggleTheme(theme._id)}
                className="w-full text-left px-4 py-3 transition hover:brightness-110 flex items-center justify-between"
                style={{
                  backgroundColor: isSelected ? `${colors.cta.DEFAULT}1A` : "transparent",
                  borderBottom: index < themes.length - 1 ? `1px solid ${colors.primary.dark}` : undefined,
                }}
                data-testid={`${itemTestIdPrefix}-${theme._id}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="font-semibold text-sm truncate flex-1 min-w-0"
                      style={{ color: isSelected ? colors.cta.light : colors.text.DEFAULT }}
                      title={theme.name}
                    >
                      {theme.name}
                    </div>
                    {goalThemeIds.has(theme._id) && <WeeklyGoalThemeMarker />}
                  </div>
                  <div className="text-xs" style={{ color: colors.text.muted }}>
                    {theme.itemCount} {theme.contentType === "sentence" ? "rounds" : "words"}
                  </div>
                </div>
                {isSelected && (
                  <div
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: colors.cta.DEFAULT }}
                  >
                    <ThemeCheckmark className="w-2.5 h-2.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        {selectedThemes.length > 0 && (
          <div
            className="px-4 py-2 text-center text-xs"
            style={{
              backgroundColor: colors.background.elevated,
              borderTop: `1px solid ${colors.primary.dark}`,
              color: colors.text.muted,
            }}
          >
            Selected: <span style={{ color: colors.cta.light }}>
              {selectedThemes.length === 1
                ? selectedThemes[0].name
                : `${selectedThemes.length} themes`}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Spacious card list with an optional confirm button (standalone usage).
  return (
    <div className="space-y-3 pb-2">
      {themes.map((theme) => (
        <button
          key={theme._id}
          onClick={() => handleToggleTheme(theme._id)}
          className="w-full text-left p-4 border-2 rounded-2xl transition hover:brightness-110 flex items-center justify-between gap-3"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: draftThemeIds.includes(theme._id)
              ? colors.cta.DEFAULT
              : colors.primary.dark,
          }}
          data-testid={`${itemTestIdPrefix}-${theme._id}`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <div
                className="font-semibold text-base truncate flex-1 min-w-0"
                style={{ color: colors.text.DEFAULT }}
                title={theme.name}
              >
                {theme.name}
              </div>
              {goalThemeIds.has(theme._id) && <WeeklyGoalThemeMarker />}
            </div>
            <div className="text-sm" style={{ color: colors.text.muted }}>
              {theme.itemCount} {theme.contentType === "sentence" ? "rounds" : "words"}
            </div>
          </div>
          <div
            className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0"
            style={{
              borderColor: draftThemeIds.includes(theme._id)
                ? colors.cta.DEFAULT
                : colors.primary.dark,
              backgroundColor: draftThemeIds.includes(theme._id)
                ? colors.cta.DEFAULT
                : "transparent",
            }}
          >
            {draftThemeIds.includes(theme._id) && <ThemeCheckmark className="w-3.5 h-3.5" />}
          </div>
        </button>
      ))}

      {!hideConfirmButton && (
        <button
          type="button"
          onClick={() => onConfirmSelection(draftThemeIds)}
          disabled={draftThemeIds.length === 0}
          className="w-full rounded-xl py-3 text-sm font-bold uppercase tracking-widest transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            backgroundColor: colors.cta.DEFAULT,
            color: colors.text.DEFAULT,
          }}
          data-testid="theme-selector-confirm"
        >
          {confirmLabel}
        </button>
      )}
    </div>
  );
}
