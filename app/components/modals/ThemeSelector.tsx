"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { WeeklyGoalThemeMarker } from "@/app/components/WeeklyGoalThemeMarker";
import { useWeeklyGoalThemeIds } from "@/hooks/useWeeklyGoalThemeIds";
import { colors } from "@/lib/theme";

interface Theme {
  _id: Id<"themes">;
  name: string;
  words: unknown[];
}

interface ThemeSelectorProps {
  themes: Theme[] | undefined;
  selectedThemeIds: Id<"themes">[];
  onConfirmSelection: (themeIds: Id<"themes">[]) => void;
  onCreateTheme: () => void;
  emptyMessage?: string;
  confirmLabel?: string;
  draftThemeIds?: Id<"themes">[];
  onDraftThemeIdsChange?: (themeIds: Id<"themes">[]) => void;
  hideConfirmButton?: boolean;
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
}: ThemeSelectorProps) {
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
        className="text-center p-6 border-2 rounded-2xl"
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
        className="text-center p-6 border-2 rounded-2xl"
        style={{
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
        }}
      >
        <p className="text-sm mb-4" style={{ color: colors.text.muted }}>
          {emptyMessage}
        </p>
        <button
          onClick={onCreateTheme}
          className="w-full border-2 rounded-xl py-2 text-sm font-bold uppercase tracking-widest transition hover:brightness-110"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          data-testid="theme-selector-create"
        >
          Create your first theme
        </button>
      </div>
    );
  }

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
          data-testid={`theme-selector-item-${theme._id}`}
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
              {theme.words.length} words
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
            {draftThemeIds.includes(theme._id) && (
              <svg className="w-3.5 h-3.5" fill="white" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
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
