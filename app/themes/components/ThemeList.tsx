"use client";

import { memo, useMemo } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import type { FriendWithDetails } from "@/convex/friends";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { BackButton } from "@/app/components/BackButton";
import { WeeklyGoalThemeMarker } from "@/app/components/WeeklyGoalThemeMarker";
import { useWeeklyGoalThemeIds } from "@/hooks/useWeeklyGoalThemeIds";
import { ThemeCardMenu } from "./ThemeCardMenu";
import { hasMissingThemeTts } from "@/lib/themes/tts";
import { getThemeActionButtonStyle } from "./themeStyles";
import { getWordTypeLabel } from "../constants";
import { formatVisibleUser } from "@/lib/userDisplay";
import type { ListFilter } from "../hooks/useThemeListController";

interface ThemeListProps {
  themes: ThemeWithOwner[];
  deletingThemeId: Id<"themes"> | null;
  duplicatingThemeId: Id<"themes"> | null;
  onOpenTheme: (theme: ThemeWithOwner) => void;
  onDeleteTheme: (themeId: Id<"themes">, themeName: string) => void;
  onDuplicateTheme: (themeId: Id<"themes">) => void;
  onGenerateNew: () => void;
  onBack: () => void;
  // Filter props
  filter?: ListFilter;
  selectedFriend?: FriendWithDetails | null;
  onOpenFriendFilter?: () => void;
  onClearFriendFilter?: () => void;
  onToggleShowArchived?: () => void;
  onToggleArchive?: (themeId: Id<"themes">) => void;
}

interface ThemeCardProps {
  theme: ThemeWithOwner;
  isDeleting: boolean;
  isDuplicating: boolean;
  onOpenTheme: (theme: ThemeWithOwner) => void;
  onDeleteTheme: (themeId: Id<"themes">, themeName: string) => void;
  onDuplicateTheme: (themeId: Id<"themes">) => void;
  isInWeeklyGoal: boolean;
  isArchived?: boolean;
  onToggleArchive?: (themeId: Id<"themes">) => void;
}

const ThemeCard = memo(function ThemeCard({
  theme,
  isDeleting,
  isDuplicating,
  onOpenTheme,
  onDeleteTheme,
  onDuplicateTheme,
  isInWeeklyGoal,
  isArchived,
  onToggleArchive,
}: ThemeCardProps) {
  const colors = useAppearanceColors();
  const isMutating = isDeleting || isDuplicating;

  const categoryLabel = getWordTypeLabel(theme.wordType, {
    fallback: "No category",
    uppercase: true,
  });

  const visibilityLabel = theme.visibility === "shared" ? "Shared" : "Private";

  const ownerInfo =
    !theme.isOwner && theme.ownerNickname
      ? ` • by ${theme.ownerNickname}`
      : "";
  const hasMissingTts = hasMissingThemeTts(theme.words);
  const ttsStatusLabel = hasMissingTts ? "TTS missing" : "TTS up to date";
  const ttsStatusTitle = hasMissingTts
    ? "Some words are missing pre-generated TTS"
    : "All words have pre-generated TTS";

  return (
    <div
      className="relative w-full px-4 py-3 border-2 rounded-2xl transition hover:brightness-105 overflow-hidden"
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
      data-testid={`theme-card-${theme._id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => onOpenTheme(theme)}
          disabled={isMutating}
          className="text-left flex-1 min-w-0 transition hover:brightness-110"
          data-testid={`theme-open-${theme._id}`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <h3
              className="font-bold text-base uppercase tracking-wide leading-tight truncate flex-1 min-w-0"
              title={theme.name}
              style={{ color: colors.text.DEFAULT }}
            >
              {theme.name}
            </h3>
            {isInWeeklyGoal && <WeeklyGoalThemeMarker />}
          </div>
          <div
            className="text-xs tracking-wide mt-0.5"
            style={{ color: colors.text.muted }}
          >
            {theme.words.length} words • {categoryLabel} • {visibilityLabel}{ownerInfo}
          </div>
        </button>
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              backgroundColor: hasMissingTts
                ? `${colors.status.warning.DEFAULT}1A`
                : `${colors.status.success.DEFAULT}1A`,
              borderColor: hasMissingTts
                ? colors.status.warning.dark
                : colors.status.success.dark,
              color: hasMissingTts
                ? colors.status.warning.light
                : colors.status.success.light,
            }}
            title={ttsStatusTitle}
            data-testid={`theme-tts-status-${theme._id}`}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: hasMissingTts
                  ? colors.status.warning.DEFAULT
                  : colors.status.success.DEFAULT,
              }}
              aria-hidden="true"
            />
            {ttsStatusLabel}
          </span>
          <ThemeCardMenu
            themeId={theme._id}
            themeName={theme.name}
            isOwner={theme.isOwner}
            isDeleting={isDeleting}
            isDuplicating={isDuplicating}
            onDuplicate={onDuplicateTheme}
            onDelete={onDeleteTheme}
            isArchived={isArchived}
            onToggleArchive={onToggleArchive}
          />
        </div>
      </div>
    </div>
  );
});

export function ThemeList({
  themes,
  deletingThemeId,
  duplicatingThemeId,
  onOpenTheme,
  onDeleteTheme,
  onDuplicateTheme,
  onGenerateNew,
  onBack,
  filter = { kind: "all" },
  selectedFriend,
  onOpenFriendFilter,
  onClearFriendFilter,
  onToggleShowArchived,
  onToggleArchive,
}: ThemeListProps) {
  const colors = useAppearanceColors();
  const goalThemeIds = useWeeklyGoalThemeIds();

  const showArchived = filter.kind === "archived";
  const isFiltering = filter.kind !== "all";
  const filterDisplay = (() => {
    switch (filter.kind) {
      case "archived":
        return "Archived Themes";
      case "mine":
        return "My Themes";
      case "friend":
        return selectedFriend ? formatVisibleUser(selectedFriend) : null;
      case "all":
        return null;
    }
  })();

  const subtitle = filterDisplay
    ? `Filtering: ${filterDisplay} • ${themes.length} theme${themes.length !== 1 ? "s" : ""}`
    : `${themes.length} theme${themes.length !== 1 ? "s" : ""} available`;

  const filterButtonStyle = useMemo(
    () =>
      isFiltering
        ? {
          backgroundColor: `${colors.secondary.DEFAULT}26`,
          borderColor: `${colors.secondary.DEFAULT}66`,
          color: colors.cta.lighter,
        }
        : {
          backgroundColor: colors.background.DEFAULT,
          borderColor: colors.primary.dark,
          color: colors.text.muted,
        },
    [colors, isFiltering]
  );

  return (
    <>
      <header className="w-full mb-4 animate-slide-up">
        <div
          className="w-full rounded-2xl border-2 px-4 py-3 flex flex-col gap-2 backdrop-blur-sm shadow-md"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 8px 24px ${colors.primary.glow}`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: colors.text.muted }}>
                {subtitle}
              </p>
            </div>
            {onOpenFriendFilter && (
              <button
                onClick={onOpenFriendFilter}
                className="p-1.5 rounded-lg border-2 transition hover:brightness-110"
                style={filterButtonStyle}
                title="Filter themes"
                data-testid="themes-filter"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              </button>
            )}
            {onToggleShowArchived && (
              <button
                onClick={onToggleShowArchived}
                className="p-1.5 rounded-lg border-2 transition hover:brightness-110 ml-2"
                style={{
                  backgroundColor: showArchived ? `${colors.secondary.DEFAULT}26` : colors.background.DEFAULT,
                  borderColor: showArchived ? `${colors.secondary.DEFAULT}66` : colors.primary.dark,
                  color: showArchived ? colors.cta.lighter : colors.text.muted,
                }}
                title={showArchived ? "Show Active Themes" : "Show Archived Themes"}
                data-testid="themes-toggle-archived"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
              </button>
            )}
          </div>
          {isFiltering && onClearFriendFilter && (
            <button
              onClick={onClearFriendFilter}
              className="w-full py-1 text-xs uppercase tracking-widest transition"
              style={{ color: colors.cta.lighter }}
              data-testid="themes-clear-filter"
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="mt-3 animate-slide-up delay-100">
          <button
            onClick={onGenerateNew}
            className="w-full bg-gradient-to-b border-t-2 border-b-3 border-x-2 rounded-xl py-2.5 px-4 text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-md"
            style={getThemeActionButtonStyle("cta", colors)}
            data-testid="themes-generate-new"
          >
            Generate New
          </button>
        </div>
      </header>

      <div className="w-full flex-1 min-h-0 mb-3 flex flex-col">
        <div
          className="w-full min-h-0 overflow-y-auto rounded-2xl border-2 p-3 backdrop-blur-sm animate-slide-up delay-200"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 12px 32px ${colors.primary.glow}`,
          }}
        >
          <div className="flex flex-col gap-2">
            {themes.map((theme) => (
              <ThemeCard
                key={theme._id}
                theme={theme}
                isDeleting={deletingThemeId === theme._id}
                isDuplicating={duplicatingThemeId === theme._id}
                onOpenTheme={onOpenTheme}
                onDeleteTheme={onDeleteTheme}
                onDuplicateTheme={onDuplicateTheme}
                isInWeeklyGoal={goalThemeIds.has(theme._id)}
                isArchived={showArchived}
                onToggleArchive={onToggleArchive}
              />
            ))}
          </div>
        </div>
      </div>

      <BackButton
        onClick={onBack}
        className="animate-slide-up delay-300"
        dataTestId="themes-back"
      />
    </>
  );
}
