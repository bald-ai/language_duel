"use client";

import type { Id } from "@/convex/_generated/dataModel";

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
      <div className="text-center py-8">
        <p className="text-gray-400 mb-4">{emptyMessage}</p>
        <button onClick={onCreateTheme} className="text-blue-400 hover:text-blue-300 underline">
          Create your first theme →
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2 pb-2">
      {themes.map((theme) => (
        <button
          key={theme._id}
          onClick={() => onSelect(theme._id)}
          className="w-full text-left p-3 border border-gray-700 rounded hover:bg-gray-700 transition-colors"
        >
          <div className="font-semibold text-white">{theme.name}</div>
          <div className="text-sm text-gray-300">{theme.words.length} words</div>
        </button>
      ))}
    </div>
  );
}

