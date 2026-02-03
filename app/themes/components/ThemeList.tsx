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
  showArchived?: boolean;
  onToggleShowArchived?: () => void;
  onToggleArchive?: (themeId: Id<"themes">) => void;
}

const actionButtonClassName =
  "w-full bg-gradient-to-b border-t-2 border-b-3 border-x-2 rounded-xl py-2.5 px-4 text-sm font-bold uppercase tracking-widest hover:translate-y-0.5 hover:brightness-110 active:translate-y-1 transition-all duration-200 shadow-md";

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

const ITEM_GAP = 8;
const ITEM_SIZE = 72;
const LIST_CONTAINER_PADDING = 24;

interface ThemeCardProps {
  theme: ThemeWithOwner;
  isDeleting: boolean;
  isDuplicating: boolean;
  onOpenTheme: (theme: ThemeWithOwner) => void;
  onDeleteTheme: (themeId: Id<"themes">, themeName: string) => void;
  onDuplicateTheme: (themeId: Id<"themes">) => void;
  isArchived?: boolean;
  onToggleArchive?: (themeId: Id<"themes">) => void;
}

const ThemeCard = memo(function ThemeCard({
  theme,
  isDeleting,
  isDuplicating,
  onOpenTheme,
  onDeleteTheme,
  onDuplicateTheme,
  isArchived,
  onToggleArchive,
}: ThemeCardProps) {
  const isMutating = isDeleting || isDuplicating;

  const categoryLabel =
    theme.wordType === "verbs"
      ? "VERBS"
      : theme.wordType === "nouns"
        ? "NOUNS"
        : "NO CATEGORY";

  const visibilityLabel = theme.visibility === "shared" ? "Shared" : "Private";

  const ownerInfo =
    !theme.isOwner && theme.ownerNickname
      ? ` • by ${theme.ownerNickname}`
      : "";

  return (
    <div
      className="relative w-full px-4 py-3 border-2 rounded-2xl transition hover:brightness-105 overflow-hidden"
      style={{
        backgroundColor: colors.background.DEFAULT,
        borderColor: colors.primary.dark,
      }}
      data-testid={`theme-card-${theme._id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => onOpenTheme(theme)}
          disabled={isMutating}
          className="text-left flex-1 min-w-0 transition hover:brightness-110"
          data-testid={`theme-open-${theme._id}`}
        >
          <h3
            className="font-bold text-base uppercase tracking-wide leading-tight truncate"
            title={theme.name}
            style={{ color: colors.text.DEFAULT }}
          >
            {theme.name}
          </h3>
          <div
            className="text-xs tracking-wide mt-0.5"
            style={{ color: colors.text.muted }}
          >
            {theme.words.length} words • {categoryLabel} • {visibilityLabel}{ownerInfo}
          </div>
        </button>
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
  );
});

interface ThemeListData {
  themes: ThemeWithOwner[];
  deletingThemeId: Id<"themes"> | null;
  duplicatingThemeId: Id<"themes"> | null;
  onOpenTheme: (theme: ThemeWithOwner) => void;
  onDeleteTheme: (themeId: Id<"themes">, themeName: string) => void;
  onDuplicateTheme: (themeId: Id<"themes">) => void;
  onToggleArchive?: (themeId: Id<"themes">) => void;
  isArchived?: boolean;
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
    paddingRight: 12,
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
          isArchived={data.isArchived}
          onToggleArchive={data.onToggleArchive}
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
  showArchived,
  onToggleShowArchived,
  onToggleArchive,
}: ThemeListProps) {
  const listRef = useRef<VariableSizeList | null>(null);
  const sizeMapRef = useRef<Map<number, number>>(new Map());
  const listSpaceRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const [availableHeight, setAvailableHeight] = useState(0);
  const [listWidth, setListWidth] = useState(0);

  const filterDisplay = showArchived
    ? "Archived Themes"
    : myThemesOnly
      ? "My Themes"
      : selectedFriend
        ? `${selectedFriend.nickname || selectedFriend.email}${selectedFriend.discriminator ? `#${selectedFriend.discriminator}` : ""}`
        : null;

  const isFiltering = showArchived || myThemesOnly || !!selectedFriend;
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
    const container = listSpaceRef.current;

    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setAvailableHeight(Math.max(0, Math.floor(entry.contentRect.height)));
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = listContainerRef.current;

    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setListWidth(Math.max(0, Math.floor(entry.contentRect.width)));
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, []);

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
      onToggleArchive,
      isArchived: showArchived,
      setRowSize,
    }),
    [
      themes,
      deletingThemeId,
      duplicatingThemeId,
      onOpenTheme,
      onDeleteTheme,
      onDuplicateTheme,
      onToggleArchive,
      showArchived,
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
    const totalContentHeight = Math.max(themes.length * ITEM_SIZE, ITEM_SIZE);

    // Fallback before ResizeObserver fires: estimate based on viewport height
    // Subtract approximate space for header (~200px), footer button (~60px), and page padding (~48px)
    const estimatedAvailableHeight =
      typeof window !== "undefined" ? Math.max(300, window.innerHeight - 308) : 500;
    const availableSpace = availableHeight > 0 ? availableHeight : estimatedAvailableHeight;
    const listSpace = Math.max(0, availableSpace - LIST_CONTAINER_PADDING);

    return Math.min(listSpace, totalContentHeight);
  }, [availableHeight, themes.length]);

  const listViewportWidth = useMemo(() => Math.max(1, listWidth), [listWidth]);

  return (
    <>
      <header className="w-full mb-4 animate-slide-up">
        <div
          className="w-full rounded-2xl border-2 px-4 py-3 flex flex-col gap-2 backdrop-blur-sm shadow-md"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 8px 24px ${colors.primary.glow}`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm" style={{ color: colors.text.muted }}>
                {subtitle}
              </p>
            </div>
            {onOpenFriendFilter && (
              <button
                onClick={onOpenFriendFilter}
                className="p-1.5 rounded-lg border-2 transition hover:brightness-110"
                style={filterButtonStyle}
                title="Filter themes"
                data-testid="themes-filter"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
              </button>
            )}
            {onToggleShowArchived && (
              <button
                onClick={onToggleShowArchived}
                className="p-1.5 rounded-lg border-2 transition hover:brightness-110 ml-2"
                style={{
                  backgroundColor: showArchived ? `${colors.secondary.DEFAULT}26` : colors.background.DEFAULT,
                  borderColor: showArchived ? `${colors.secondary.DEFAULT}66` : colors.primary.dark,
                  color: showArchived ? colors.cta.lighter : colors.text.muted,
                }}
                title={showArchived ? "Show Active Themes" : "Show Archived Themes"}
                data-testid="themes-toggle-archived"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                  />
                </svg>
              </button>
            )}
          </div>
          {isFiltering && onClearFriendFilter && (
            <button
              onClick={onClearFriendFilter}
              className="w-full py-1 text-xs uppercase tracking-widest transition"
              style={{ color: colors.cta.lighter }}
              data-testid="themes-clear-filter"
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="mt-3 animate-slide-up delay-100">
          <button
            onClick={onGenerateNew}
            className={actionButtonClassName}
            style={ctaActionStyle}
            data-testid="themes-generate-new"
          >
            Generate New
          </button>
        </div>
      </header>

      <div ref={listSpaceRef} className="w-full flex-1 min-h-0 mb-3">
        <div
          className="w-full rounded-2xl border-2 p-3 overflow-hidden backdrop-blur-sm animate-slide-up delay-200"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 12px 32px ${colors.primary.glow}`,
            // Cap container height at content size to eliminate white space when few items
            maxHeight:
              listViewportHeight > 0 ? listViewportHeight + LIST_CONTAINER_PADDING : undefined,
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
      </div>

      <button
        onClick={onBack}
        className={`${actionButtonClassName} animate-slide-up delay-300`}
        style={primaryActionStyle}
        data-testid="themes-back"
      >
        Back
      </button>
    </>
  );
}
