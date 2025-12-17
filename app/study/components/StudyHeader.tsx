"use client";

import { Id } from "@/convex/_generated/dataModel";

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
  return (
    <header className="w-full mb-4 flex-shrink-0">
      {/* Study Room Title Bar */}
      <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 px-4 mb-3">
        <h1 className="text-xl font-bold text-center text-gray-300 uppercase tracking-wide">
          Study Room
        </h1>
      </div>

      {/* Theme Selection and Mode Toggle */}
      <div className="flex items-center justify-center gap-4">
        {/* Theme Selection - Custom Trigger that sizes to content */}
        <div className="relative">
          {/* Visual Trigger - Sizes to text */}
          <div className="px-6 py-3 rounded-2xl font-medium text-base border-2 border-gray-700 bg-gray-800 text-gray-200 flex items-center justify-center gap-2 min-w-[120px]">
            <span className="uppercase tracking-wide">{selectedTheme?.name}</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-4 h-4 text-gray-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
              />
            </svg>
          </div>

          {/* Hidden Select - Captures clicks */}
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

        {/* Mode Toggle Button */}
        <button
          onClick={onToggleReveal}
          className={`px-6 py-3 rounded-2xl font-medium text-base border-2 transition-colors uppercase tracking-wide min-w-[120px] ${
            isRevealed
              ? "bg-gray-700 border-gray-600 text-white hover:bg-gray-600"
              : "bg-green-500 border-green-600 text-white hover:bg-green-600"
          }`}
        >
          {isRevealed ? "Testing" : "Reveal"}
        </button>
      </div>
    </header>
  );
}

