"use client";

import type { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";

interface Theme {
  _id: Id<"themes">;
  name: string;
  words: unknown[];
}

interface ThemeSelectorProps {
  themes: Theme[] | undefined;
  onSelect: (themeId: Id<"themes">) => void;
  onCreateTheme: () => void;
  emptyMessage?: string;
}

export function ThemeSelector({
  themes,
  onSelect,
  onCreateTheme,
  emptyMessage = "No themes available yet.",
}: ThemeSelectorProps) {
  if (!themes || themes.length === 0) {
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
          onClick={() => onSelect(theme._id)}
          className="w-full text-left p-4 border-2 rounded-2xl transition hover:brightness-110"
          style={{
            backgroundColor: colors.background.DEFAULT,
            borderColor: colors.primary.dark,
          }}
          data-testid={`theme-selector-item-${theme._id}`}
        >
          <div
            className="font-semibold text-base truncate"
            style={{ color: colors.text.DEFAULT }}
            title={theme.name}
          >
            {theme.name}
          </div>
          <div className="text-sm" style={{ color: colors.text.muted }}>
            {theme.words.length} words
          </div>
        </button>
      ))}
    </div>
  );
}
