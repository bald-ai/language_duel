"use client";
import { memo } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { WeeklyGoalThemeMarker } from "@/app/components/WeeklyGoalThemeMarker";
import { ThemeCardMenu } from "./ThemeCardMenu";
import { hasMissingThemeTts } from "@/lib/themes/tts";
import { getWordTypeLabel } from "../constants";
import { getThemeItemCount, isSentenceTheme } from "@/lib/themes/themeContent";
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

export const ThemeCard = memo(function ThemeCard({
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

  return (
    <div
      className="relative w-full px-3.5 py-2.5 border-2 rounded-xl transition hover:brightness-105 overflow-hidden"
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
      data-testid={`theme-card-${theme._id}`}
    >
      <div className="flex items-center justify-between gap-2">
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
          <ThemeCardMetadata theme={theme} />
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          <ThemeCardCategoryBadge theme={theme} />
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

function ThemeCardMetadata({ theme }: { theme: ThemeWithOwner }) {
  const colors = useAppearanceColors();
  const itemCount = getThemeItemCount(theme);
  const itemLabel = isSentenceTheme(theme)
    ? `${itemCount} ${itemCount === 1 ? "sentence" : "sentences"}`
    : `${itemCount} ${itemCount === 1 ? "word" : "words"}`;
  const visibilityLabel = theme.visibility === "shared" ? "Shared" : "Private";
  const ownerInfo =
    !theme.isOwner && theme.ownerNickname ? ` • by ${theme.ownerNickname}` : "";
  return (
    <div
      className="text-xs tracking-wide mt-0.5"
      style={{ color: colors.text.muted }}
    >
      {itemLabel} • {visibilityLabel}
      {ownerInfo}
      {" • "}
      <ThemeCardTtsStatus theme={theme} />
    </div>
  );
}

function ThemeCardTtsStatus({ theme }: { theme: ThemeWithOwner }) {
  const colors = useAppearanceColors();
  const isSentence = isSentenceTheme(theme);
  const rows = isSentence ? (theme.sentenceRounds ?? []) : (theme.words ?? []);
  const unit = isSentence ? "sentences" : "words";
  const status = hasMissingThemeTts(rows)
    ? {
        label: "TTS missing",
        title: `Some ${unit} are missing pre-generated TTS`,
        color: colors.status.warning.light,
      }
    : {
        label: "TTS up to date",
        title: `All ${unit} have pre-generated TTS`,
        color: colors.status.success.light,
      };
  return (
    <span
      style={{ color: status.color }}
      title={status.title}
      data-testid={`theme-tts-status-${theme._id}`}
    >
      {status.label}
    </span>
  );
}

function ThemeCardCategoryBadge({ theme }: { theme: ThemeWithOwner }) {
  const colors = useAppearanceColors();
  const isSentence = isSentenceTheme(theme);
  const label = isSentence
    ? "SENTENCES"
    : getWordTypeLabel(theme.wordType, {
        fallback: "No category",
        uppercase: true,
      });
  const style = isSentence
    ? {
        backgroundColor: `${colors.secondary.DEFAULT}1A`,
        borderColor: `${colors.secondary.DEFAULT}66`,
        color: colors.secondary.light,
      }
    : {
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
        color: colors.text.muted,
      };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={style}
      data-testid={`theme-content-type-badge-${theme._id}`}
    >
      {label}
    </span>
  );
}
