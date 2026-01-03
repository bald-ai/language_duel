"use client";

import { memo } from "react";
import { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";
import { EyeIcon, EyeSlashIcon } from "@/app/components/icons";

interface Theme {
  _id: Id<"themes">;
  name: string;
}

interface StudyHeaderProps {
  themes: Theme[];
  selectedTheme: Theme | null;
  onThemeChange: (themeId: string) => void;
  isAllRevealed: boolean;
  onToggleRevealAll: () => void;
}

function StudyHeaderComponent({
  themes,
  selectedTheme,
  onThemeChange,
  isAllRevealed,
  onToggleRevealAll,
}: StudyHeaderProps) {
  const selectedThemeName = selectedTheme?.name ?? "Select theme";

  return (
    <header className="w-full flex-shrink-0">
      <div
        className="w-full rounded-3xl border-2 p-4 sm:p-5 flex items-center justify-between backdrop-blur-sm shadow-lg"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 16px 40px ${colors.primary.glow}`,
        }}
      >
        <div className="relative flex-1">
          <div
            className="px-5 py-3 rounded-2xl font-semibold text-sm uppercase tracking-widest border-2 flex items-center justify-center gap-2"
            style={{
              backgroundColor: colors.background.DEFAULT,
              borderColor: colors.primary.dark,
              color: colors.text.DEFAULT,
            }}
          >
            <span className="truncate max-w-[180px] sm:max-w-none" title={selectedThemeName}>
              {selectedThemeName}
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-4 h-4"
              style={{ color: colors.neutral.DEFAULT }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </div>

          <select
            value={selectedTheme?._id || ""}
            onChange={(e) => onThemeChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none"
          >
            {themes.map((theme) => (
              <option key={theme._id} value={theme._id}>
                {theme.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onToggleRevealAll}
          className="ml-4 w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition hover:brightness-110"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
          aria-label={isAllRevealed ? "Hide All" : "Reveal All"}
          title={isAllRevealed ? "Hide All" : "Reveal All"}
        >
          {isAllRevealed ? (
            <EyeSlashIcon className="w-5 h-5" />
          ) : (
            <EyeIcon className="w-5 h-5" />
          )}
        </button>
      </div>
    </header>
  );
}

export const StudyHeader = memo(StudyHeaderComponent);
