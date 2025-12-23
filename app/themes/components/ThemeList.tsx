"use client";

import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import type { FriendWithDetails } from "@/convex/friends";
import { buttonStyles, colors } from "@/lib/theme";

interface ThemeListProps {
  themes: ThemeWithOwner[];
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

const actionButtonClassName =
  "w-full bg-gradient-to-b border-t-2 border-b-4 border-x-2 rounded-xl py-3 px-4 text-sm sm:text-base font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-lg";

const badgeBaseClassName =
  "px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase leading-none";

const primaryActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.primary.gradient.from}, ${buttonStyles.primary.gradient.to})`,
  borderTopColor: buttonStyles.primary.border.top,
  borderBottomColor: buttonStyles.primary.border.bottom,
  borderLeftColor: buttonStyles.primary.border.sides,
  borderRightColor: buttonStyles.primary.border.sides,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

const ctaActionStyle = {
  backgroundImage: `linear-gradient(to bottom, ${buttonStyles.cta.gradient.from}, ${buttonStyles.cta.gradient.to})`,
  borderTopColor: buttonStyles.cta.border.top,
  borderBottomColor: buttonStyles.cta.border.bottom,
  borderLeftColor: buttonStyles.cta.border.sides,
  borderRightColor: buttonStyles.cta.border.sides,
  color: colors.text.DEFAULT,
  textShadow: "0 2px 4px rgba(0,0,0,0.4)",
};

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
  const subtitle = filterDisplay
    ? `Filtering: ${filterDisplay} • ${themes.length} theme${themes.length !== 1 ? "s" : ""}`
    : `${themes.length} theme${themes.length !== 1 ? "s" : ""} available`;

  const filterButtonStyle = isFiltering
    ? {
        backgroundColor: `${colors.secondary.DEFAULT}26`,
        borderColor: `${colors.secondary.DEFAULT}66`,
        color: colors.secondary.light,
      }
    : {
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
        color: colors.text.muted,
      };

  return (
    <>
      <header className="w-full mb-6 animate-slide-up">
        <div
          className="w-full rounded-3xl border-2 p-4 sm:p-5 flex flex-col gap-3 backdrop-blur-sm shadow-lg"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 16px 40px ${colors.primary.glow}`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0 text-center">
              <h1
                className="title-font text-2xl sm:text-3xl uppercase tracking-wider truncate"
                style={{
                  background: `linear-gradient(135deg, ${colors.text.DEFAULT} 0%, ${colors.neutral.DEFAULT} 50%, ${colors.text.DEFAULT} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
                }}
              >
                Themes
              </h1>
              <p className="text-xs sm:text-sm mt-1" style={{ color: colors.text.muted }}>
                {subtitle}
              </p>
            </div>
            {onOpenFriendFilter && (
              <button
                onClick={onOpenFriendFilter}
                className="p-2 rounded-xl border-2 transition hover:brightness-110"
                style={filterButtonStyle}
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
              className="mt-1 w-full py-1.5 text-xs sm:text-sm uppercase tracking-widest transition"
              style={{ color: colors.secondary.light }}
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="mt-4 animate-slide-up delay-100">
          <button onClick={onGenerateNew} className={actionButtonClassName} style={ctaActionStyle}>
            Generate New
          </button>
        </div>
      </header>

      <div
        className="w-full rounded-3xl border-2 p-4 mb-4 flex-1 min-h-0 overflow-y-auto backdrop-blur-sm animate-slide-up delay-200"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 20px 60px ${colors.primary.glow}`,
        }}
      >
        <div className="flex flex-col gap-3">
          {themes.map((theme) => {
            const isDeleting = deletingThemeId === theme._id;
            const isDuplicating = duplicatingThemeId === theme._id;
            const isMutating = isDeleting || isDuplicating;

            return (
              <div
                key={theme._id}
                className="w-full p-4 border-2 rounded-2xl transition hover:brightness-110 overflow-hidden"
                style={{
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.primary.dark,
                }}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      onClick={() => onOpenTheme(theme)}
                      disabled={isMutating}
                      className="text-left flex-1 min-w-0 transition hover:brightness-110"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="font-bold text-lg leading-snug whitespace-normal break-words"
                          title={theme.name}
                          style={{ color: colors.text.DEFAULT }}
                        >
                          {theme.name}
                        </span>
                      </div>
                      <div
                        className="text-sm"
                        title={`${theme.words.length} words`}
                        style={{ color: colors.text.muted }}
                      >
                        {theme.words.length} words
                      </div>
                    </button>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <button
                        onClick={() => onDuplicateTheme(theme._id)}
                        disabled={isMutating}
                        className="px-3 py-1 rounded-lg text-sm font-medium transition whitespace-nowrap border disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                        style={{
                          backgroundColor: `${colors.secondary.DEFAULT}1A`,
                          borderColor: `${colors.secondary.DEFAULT}66`,
                          color: colors.secondary.light,
                        }}
                      >
                        {isDuplicating ? "Duplicating..." : "Duplicate"}
                      </button>
                      {theme.isOwner && (
                        <button
                          onClick={() => onDeleteTheme(theme._id, theme.name)}
                          disabled={isMutating}
                          className="px-3 py-1 rounded-lg text-sm font-medium transition whitespace-nowrap border disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                          style={{
                            backgroundColor: `${colors.status.danger.DEFAULT}1A`,
                            borderColor: `${colors.status.danger.DEFAULT}66`,
                            color: colors.status.danger.light,
                          }}
                        >
                          {isDeleting ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div
                      className="h-px w-full"
                      style={{ backgroundColor: `${colors.primary.dark}66` }}
                      aria-hidden="true"
                    />
                    <div className="flex flex-wrap items-center justify-end gap-2">
                    <div
                      className={`${badgeBaseClassName} whitespace-nowrap`}
                      style={{
                        backgroundColor: `${colors.text.muted}14`,
                        color: colors.text.muted,
                      }}
                      title="Word type"
                    >
                      {theme.wordType === "verbs" ? "Verbs" : theme.wordType === "nouns" ? "Nouns" : "No category"}
                    </div>
                    <div
                      className={`${badgeBaseClassName} whitespace-nowrap`}
                      style={
                        theme.visibility === "shared"
                          ? {
                              backgroundColor: `${colors.neutral.dark}24`,
                              color: colors.neutral.light,
                            }
                          : {
                              backgroundColor: `${colors.text.muted}14`,
                              color: colors.text.muted,
                            }
                      }
                      title={theme.visibility === "shared" ? "Shared with friends" : "Private"}
                    >
                      {theme.visibility === "shared" ? "Shared" : "Private"}
                    </div>
                    {!theme.isOwner && theme.ownerNickname && (
                      <div
                      className={`${badgeBaseClassName} whitespace-nowrap`}
                      style={{
                        backgroundColor: `${colors.text.muted}14`,
                        color: colors.neutral.dark,
                      }}
                      title={`Owned by ${theme.ownerNickname}#${theme.ownerDiscriminator}`}
                    >
                        {theme.ownerNickname}
                      </div>
                    )}
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
        className={`${actionButtonClassName} animate-slide-up delay-300`}
        style={primaryActionStyle}
      >
        Back
      </button>
    </>
  );
}
