"use client";

import { Id } from "@/convex/_generated/dataModel";
import { buttonStyles, colors } from "@/lib/theme";

interface Theme {
  _id: Id<"themes">;
  name: string;
}

interface StudyHeaderProps {
  themes: Theme[];
  selectedTheme: Theme | null;
  isRevealed: boolean;
  onThemeChange: (themeId: string) => void;
  onToggleReveal: () => void;
}

export function StudyHeader({
  themes,
  selectedTheme,
  isRevealed,
  onThemeChange,
  onToggleReveal,
}: StudyHeaderProps) {
  const toggleStyles = isRevealed ? buttonStyles.primary : buttonStyles.cta;
  const selectedThemeName = selectedTheme?.name ?? "Select theme";

  return (
    <header className="w-full flex-shrink-0">
      <div
        className="w-full rounded-3xl border-2 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 backdrop-blur-sm shadow-lg"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 16px 40px ${colors.primary.glow}`,
        }}
      >
        <div className="relative w-full sm:flex-1">
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
          onClick={onToggleReveal}
          className="w-full sm:w-auto px-6 py-3 rounded-2xl font-semibold text-sm uppercase tracking-widest border-t-2 border-b-4 border-x-2 transition-all duration-200 hover:translate-y-0.5 active:translate-y-1"
          style={{
            backgroundImage: `linear-gradient(to bottom, ${toggleStyles.gradient.from}, ${toggleStyles.gradient.to})`,
            borderTopColor: toggleStyles.border.top,
            borderBottomColor: toggleStyles.border.bottom,
            borderLeftColor: toggleStyles.border.sides,
            borderRightColor: toggleStyles.border.sides,
            color: colors.text.DEFAULT,
            textShadow: "0 2px 4px rgba(0,0,0,0.4)",
          }}
        >
          {isRevealed ? "Testing" : "Reveal"}
        </button>
      </div>
    </header>
  );
}
