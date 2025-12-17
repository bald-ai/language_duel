"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";

interface ThemeWithStatus extends Doc<"themes"> {
  hasDuplicateWords: boolean;
  hasDuplicateWrongAnswers: boolean;
}

interface ThemeListProps {
  themes: ThemeWithStatus[];
  deletingThemeId: Id<"themes"> | null;
  duplicatingThemeId: Id<"themes"> | null;
  onOpenTheme: (theme: Doc<"themes">) => void;
  onDeleteTheme: (themeId: Id<"themes">, themeName: string) => void;
  onDuplicateTheme: (themeId: Id<"themes">) => void;
  onGenerateNew: () => void;
  onBack: () => void;
}

export function ThemeList({
  themes,
  deletingThemeId,
  duplicatingThemeId,
  onOpenTheme,
  onDeleteTheme,
  onDuplicateTheme,
  onGenerateNew,
  onBack,
}: ThemeListProps) {
  return (
    <>
      <header className="w-full mb-6">
        <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 px-4 mb-4">
          <h1 className="text-xl font-bold text-center text-gray-300 uppercase tracking-wide">
            Themes
          </h1>
        </div>

        <button
          onClick={onGenerateNew}
          className="w-full bg-gray-800 border-2 border-gray-700 rounded-xl py-3 text-lg font-bold text-white uppercase tracking-wide hover:bg-gray-700 transition-colors"
        >
          Generate New
        </button>
      </header>

      <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl p-4 mb-4 flex-1 overflow-y-auto">
        <div className="flex flex-col gap-3">
          {themes.map((theme) => {
            const isDeleting = deletingThemeId === theme._id;
            const isDuplicating = duplicatingThemeId === theme._id;
            const isMutating = isDeleting || isDuplicating;

            return (
              <div
                key={theme._id}
                className="w-full p-4 bg-gray-800/50 border-2 border-gray-700 rounded-xl hover:border-gray-600 transition-colors overflow-hidden"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button
                    onClick={() => onOpenTheme(theme)}
                    disabled={isMutating}
                    className="text-left flex-1 min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-lg truncate" title={theme.name}>
                        {theme.name}
                      </span>
                      {theme.hasDuplicateWords && (
                        <span
                          className="text-red-500 text-xl font-bold shrink-0"
                          title="This theme has duplicate words"
                        >
                          !
                        </span>
                      )}
                      {theme.hasDuplicateWrongAnswers && (
                        <span
                          className="text-orange-500 text-xl font-bold shrink-0"
                          title="This theme has duplicate wrong answers"
                        >
                          ⚠
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 truncate" title={`${theme.words.length} words`}>
                      {theme.words.length} words
                    </div>
                  </button>
                  <div className="flex flex-col items-end gap-2 ml-auto">
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => onDuplicateTheme(theme._id)}
                        disabled={isMutating}
                        className="px-3 py-1 bg-blue-500/15 text-blue-200 rounded-lg text-sm font-medium hover:bg-blue-500/25 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDuplicating ? "Duplicating..." : "Duplicate"}
                      </button>
                      <button
                        onClick={() => onDeleteTheme(theme._id, theme.name)}
                        disabled={isMutating}
                        className="px-3 py-1 bg-red-500/15 text-red-200 rounded-lg text-sm font-medium hover:bg-red-500/25 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDeleting ? "Deleting..." : "Delete"}
                      </button>
                    </div>

                    <div
                      className="px-2 py-1 rounded-md border border-gray-700 bg-gray-800 text-[11px] font-semibold tracking-wide text-gray-300 uppercase leading-none whitespace-nowrap"
                      title="Word type"
                    >
                      {theme.wordType === "verbs" ? "Verbs" : theme.wordType === "nouns" ? "Nouns" : "No category"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={onBack}
        className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl py-4 text-xl font-bold text-white uppercase tracking-wide hover:bg-gray-700 transition-colors"
      >
        Back
      </button>
    </>
  );
}

