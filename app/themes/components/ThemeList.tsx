"use client";

import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import type { FriendWithDetails } from "@/convex/friends";

interface ThemeWithStatus extends ThemeWithOwner {
  hasDuplicateWords: boolean;
  hasDuplicateWrongAnswers: boolean;
}

interface ThemeListProps {
  themes: ThemeWithStatus[];
  deletingThemeId: Id<"themes"> | null;
  duplicatingThemeId: Id<"themes"> | null;
  onOpenTheme: (theme: ThemeWithOwner) => void;
  onDeleteTheme: (themeId: Id<"themes">, themeName: string) => void;
  onDuplicateTheme: (themeId: Id<"themes">) => void;
  onGenerateNew: () => void;
  onBack: () => void;
  // Friend filter props
  selectedFriend?: FriendWithDetails | null;
  myThemesOnly?: boolean;
  onOpenFriendFilter?: () => void;
  onClearFriendFilter?: () => void;
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
  selectedFriend,
  myThemesOnly,
  onOpenFriendFilter,
  onClearFriendFilter,
}: ThemeListProps) {
  const filterDisplay = myThemesOnly
    ? "My Themes"
    : selectedFriend
      ? `${selectedFriend.nickname || selectedFriend.email}${selectedFriend.discriminator ? `#${selectedFriend.discriminator}` : ""}`
      : null;

  const isFiltering = myThemesOnly || !!selectedFriend;

  return (
    <>
      <header className="w-full mb-6">
        <div className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg py-3 px-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold text-center text-gray-300 uppercase tracking-wide truncate">
                {filterDisplay ? `Themes - ${filterDisplay}` : "Themes"}
              </h1>
              {isFiltering && (
                <p className="text-center text-sm text-gray-500">
                  {themes.length} theme{themes.length !== 1 ? "s" : ""}
                </p>
              )}
            </div>
            {onOpenFriendFilter && (
              <button
                onClick={onOpenFriendFilter}
                className={`ml-3 p-2 rounded-lg border-2 transition-colors ${
                  isFiltering
                    ? "bg-amber-600/20 border-amber-500/50 text-amber-400"
                    : "bg-gray-700 border-gray-600 text-gray-400 hover:bg-gray-600"
                }`}
                title="Filter themes"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              </button>
            )}
          </div>
          {isFiltering && onClearFriendFilter && (
            <button
              onClick={onClearFriendFilter}
              className="mt-2 w-full py-1.5 text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              Clear Filter
            </button>
          )}
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
                      {theme.isOwner && (
                        <button
                          onClick={() => onDeleteTheme(theme._id, theme.name)}
                          disabled={isMutating}
                          className="px-3 py-1 bg-red-500/15 text-red-200 rounded-lg text-sm font-medium hover:bg-red-500/25 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>

                    <div
                      className="px-2 py-1 rounded-md border border-gray-700 bg-gray-800 text-[11px] font-semibold tracking-wide text-gray-300 uppercase leading-none whitespace-nowrap"
                      title="Word type"
                    >
                      {theme.wordType === "verbs" ? "Verbs" : theme.wordType === "nouns" ? "Nouns" : "No category"}
                    </div>
                    {/* Visibility badge */}
                    <div
                      className={`px-2 py-1 rounded-md border text-[11px] font-semibold tracking-wide uppercase leading-none whitespace-nowrap ${
                        theme.visibility === "shared"
                          ? "border-amber-600/50 bg-amber-600/20 text-amber-400"
                          : "border-gray-700 bg-gray-800 text-gray-500"
                      }`}
                      title={theme.visibility === "shared" ? "Shared with friends" : "Private"}
                    >
                      {theme.visibility === "shared" ? "Shared" : "Private"}
                    </div>
                    {/* Owner badge for friend's themes */}
                    {!theme.isOwner && theme.ownerNickname && (
                      <div
                        className="px-2 py-1 rounded-md border border-blue-600/50 bg-blue-600/20 text-[11px] font-semibold tracking-wide text-blue-400 uppercase leading-none whitespace-nowrap"
                        title={`Owned by ${theme.ownerNickname}#${theme.ownerDiscriminator}`}
                      >
                        {theme.ownerNickname}
                      </div>
                    )}
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

