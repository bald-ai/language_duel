"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import type { FriendWithDetails } from "@/convex/friends";
import {
  VariableSizeList as List,
  type ListChildComponentProps,
  type VariableSizeList,
} from "react-window";
import { buttonStyles, colors } from "@/lib/theme";
import { ThemeCardMenu } from "./ThemeCardMenu";

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

const ITEM_GAP = 12;
const ITEM_SIZE = 100;

interface ThemeCardProps {
  theme: ThemeWithOwner;
  isDeleting: boolean;
  isDuplicating: boolean;
  onOpenTheme: (theme: ThemeWithOwner) => void;
  onDeleteTheme: (themeId: Id<"themes">, themeName: string) => void;
  onDuplicateTheme: (themeId: Id<"themes">) => void;
}

const ThemeCard = memo(function ThemeCard({
  theme,
  isDeleting,
  isDuplicating,
  onOpenTheme,
  onDeleteTheme,
  onDuplicateTheme,
}: ThemeCardProps) {
  const isMutating = isDeleting || isDuplicating;

  const categoryLabel =
    theme.wordType === "verbs"
      ? "Verbs"
      : theme.wordType === "nouns"
        ? "Nouns"
        : "No category";

  const visibilityLabel = theme.visibility === "shared" ? "Shared" : "Private";

  const ownerInfo =
    !theme.isOwner && theme.ownerNickname
      ? ` • by ${theme.ownerNickname}`
      : "";

  return (
    <div
      className="relative w-full p-4 border-2 rounded-2xl transition hover:brightness-110 overflow-hidden"
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <button
          onClick={() => onOpenTheme(theme)}
          disabled={isMutating}
          className="text-left flex-1 min-w-0 transition hover:brightness-110"
        >
          <h3
            className="font-bold text-xl uppercase tracking-wide leading-snug whitespace-normal break-words"
            title={theme.name}
            style={{ color: colors.text.DEFAULT }}
          >
            {theme.name}
          </h3>
        </button>
        <ThemeCardMenu
          themeId={theme._id}
          themeName={theme.name}
          isOwner={theme.isOwner}
          isDeleting={isDeleting}
          isDuplicating={isDuplicating}
          onDuplicate={onDuplicateTheme}
          onDelete={onDeleteTheme}
        />
      </div>

      <div
        className="text-sm uppercase tracking-wide"
        style={{ color: colors.text.muted }}
      >
        {theme.words.length} words • {categoryLabel} • {visibilityLabel}{ownerInfo}
      </div>
    </div>
  );
});

interface ThemeListData {
  themes: ThemeWithOwner[];
  deletingThemeId: Id<"themes"> | null;
  duplicatingThemeId: Id<"themes"> | null;
  onOpenTheme: (theme: ThemeWithOwner) => void;
  onDeleteTheme: (themeId: Id<"themes">, themeName: string) => void;
  onDuplicateTheme: (themeId: Id<"themes">) => void;
  setRowSize: (index: number, size: number) => void;
}

const ThemeRow = memo(function ThemeRow({
  index,
  style,
  data,
}: ListChildComponentProps<ThemeListData>) {
  const theme = data.themes[index];
  const contentRef = useRef<HTMLDivElement | null>(null);
  const rowStyle = {
    ...style,
    paddingBottom: ITEM_GAP,
  };

  useLayoutEffect(() => {
    if (!theme || !contentRef.current) {
      return;
    }

    const rect = contentRef.current.getBoundingClientRect();

    if (rect.height > 0) {
      data.setRowSize(index, Math.ceil(rect.height + ITEM_GAP));
    }
  }, [data, index, theme]);

  if (!theme) {
    return null;
  }

  const isDeleting = data.deletingThemeId === theme._id;
  const isDuplicating = data.duplicatingThemeId === theme._id;

  return (
    <div style={rowStyle}>
      <div ref={contentRef}>
        <ThemeCard
          theme={theme}
          isDeleting={isDeleting}
          isDuplicating={isDuplicating}
          onOpenTheme={data.onOpenTheme}
          onDeleteTheme={data.onDeleteTheme}
          onDuplicateTheme={data.onDuplicateTheme}
        />
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
  selectedFriend,
  myThemesOnly,
  onOpenFriendFilter,
  onClearFriendFilter,
}: ThemeListProps) {
  const listRef = useRef<VariableSizeList | null>(null);
  const sizeMapRef = useRef<Map<number, number>>(new Map());
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [listHeight, setListHeight] = useState(0);
  const [listWidth, setListWidth] = useState(0);

  const filterDisplay = myThemesOnly
    ? "My Themes"
    : selectedFriend
      ? `${selectedFriend.nickname || selectedFriend.email}${selectedFriend.discriminator ? `#${selectedFriend.discriminator}` : ""}`
      : null;

  const isFiltering = myThemesOnly || !!selectedFriend;
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
    [isFiltering]
  );

  useEffect(() => {
    sizeMapRef.current.clear();
    listRef.current?.resetAfterIndex(0, true);
  }, [themes]);

  useEffect(() => {
    const container = listContainerRef.current;

    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setListHeight(Math.max(0, Math.floor(entry.contentRect.height)));
        setListWidth(Math.max(0, Math.floor(entry.contentRect.width)));
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [themes.length]);

  const setRowSize = useCallback((index: number, size: number) => {
    const currentSize = sizeMapRef.current.get(index);

    if (currentSize === size) {
      return;
    }

    sizeMapRef.current.set(index, size);
    listRef.current?.resetAfterIndex(index);
  }, []);

  const listData = useMemo<ThemeListData>(
    () => ({
      themes,
      deletingThemeId,
      duplicatingThemeId,
      onOpenTheme,
      onDeleteTheme,
      onDuplicateTheme,
      setRowSize,
    }),
    [
      themes,
      deletingThemeId,
      duplicatingThemeId,
      onOpenTheme,
      onDeleteTheme,
      onDuplicateTheme,
      setRowSize,
    ]
  );

  const getItemSize = useCallback((index: number) => {
    return sizeMapRef.current.get(index) ?? ITEM_SIZE;
  }, []);

  const itemKey = useCallback((index: number, data: ThemeListData) => {
    return data.themes[index]?._id ?? index;
  }, []);

  const listViewportHeight = useMemo(() => {
    if (listHeight > 0) {
      return listHeight;
    }

    const visibleCount = Math.min(themes.length, 6);
    return Math.max(ITEM_SIZE, visibleCount * ITEM_SIZE);
  }, [listHeight, themes.length]);

  const listViewportWidth = useMemo(() => Math.max(1, listWidth), [listWidth]);

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
              style={{ color: colors.cta.lighter }}
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
        className="w-full rounded-3xl border-2 p-4 mb-4 flex-1 min-h-0 overflow-hidden backdrop-blur-sm animate-slide-up delay-200"
        style={{
          backgroundColor: colors.background.elevated,
          borderColor: colors.primary.dark,
          boxShadow: `0 20px 60px ${colors.primary.glow}`,
        }}
      >
        <div ref={listContainerRef} className="h-full">
          <List
            height={listViewportHeight}
            itemCount={themes.length}
            itemSize={getItemSize}
            estimatedItemSize={ITEM_SIZE}
            overscanCount={3}
            width={listViewportWidth}
            itemData={listData}
            itemKey={itemKey}
            ref={listRef}
          >
            {ThemeRow}
          </List>
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
