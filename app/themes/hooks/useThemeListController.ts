import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import { toast } from "sonner";

type UseThemeListControllerParams = {
  deletingThemeId: Id<"themes"> | null;
  duplicatingThemeId: Id<"themes"> | null;
  onOpenTheme: (theme: ThemeWithOwner) => void;
  onDeleteTheme: (themeId: Id<"themes">, themeName: string) => void;
  onDuplicateTheme: (themeId: Id<"themes">) => void;
  onGenerateNew: () => void;
  onBack: () => void;
};

/**
 * The list shows exactly one view at a time. Modeling it as a discriminated
 * union makes the mutual exclusion structural instead of something each setter
 * has to enforce by hand-clearing the other flags.
 */
export type ListFilter =
  | { kind: "all" }
  | { kind: "mine" }
  | { kind: "friend"; friendId: Id<"users"> }
  | { kind: "archived" };

export function useThemeListController(params: UseThemeListControllerParams) {
  const [filter, setFilter] = useState<ListFilter>({ kind: "all" });
  const [showFriendFilterModal, setShowFriendFilterModal] = useState(false);

  const queryArgs = useMemo(() => {
    switch (filter.kind) {
      case "archived":
        return { archivedOnly: true };
      case "mine":
        return { myThemesOnly: true };
      case "friend":
        return { filterByFriendId: filter.friendId };
      case "all":
        return {};
    }
  }, [filter]);

  const rawThemesQuery = useQuery(api.themes.getThemes, queryArgs);
  const friends = useQuery(api.friends.getFriends);
  const toggleArchiveMutation = useMutation(api.themes.toggleThemeArchive);

  const themes = useMemo(() => rawThemesQuery ?? [], [rawThemesQuery]);
  const selectedFriend = useMemo(() => {
    if (filter.kind !== "friend" || !friends) return null;
    return friends.find((friend) => friend.friendId === filter.friendId) ?? null;
  }, [filter, friends]);

  const handleSetFriendFilter = useCallback((friendId: Id<"users">) => {
    setFilter({ kind: "friend", friendId });
    setShowFriendFilterModal(false);
  }, []);

  const handleClearFriendFilter = useCallback(() => {
    setFilter({ kind: "all" });
    setShowFriendFilterModal(false);
  }, []);

  const handleShowMyThemes = useCallback(() => {
    setFilter({ kind: "mine" });
    setShowFriendFilterModal(false);
  }, []);

  const handleToggleShowArchived = useCallback(() => {
    setFilter((prev) => (prev.kind === "archived" ? { kind: "all" } : { kind: "archived" }));
  }, []);

  const handleToggleArchive = useCallback(
    async (themeId: Id<"themes">) => {
      try {
        const isArchived = await toggleArchiveMutation({ themeId });
        toast.success(isArchived ? "Theme archived" : "Theme unarchived");
      } catch (_err) {
        toast.error("Failed to update archive status");
      }
    },
    [toggleArchiveMutation]
  );

  const listProps = useMemo(
    () => ({
      themes,
      deletingThemeId: params.deletingThemeId,
      duplicatingThemeId: params.duplicatingThemeId,
      onOpenTheme: params.onOpenTheme,
      onDeleteTheme: params.onDeleteTheme,
      onDuplicateTheme: params.onDuplicateTheme,
      onGenerateNew: params.onGenerateNew,
      onBack: params.onBack,
      filter,
      selectedFriend,
      onOpenFriendFilter: () => setShowFriendFilterModal(true),
      onClearFriendFilter: handleClearFriendFilter,
      onToggleShowArchived: handleToggleShowArchived,
      onToggleArchive: handleToggleArchive,
    }),
    [
      themes,
      params.deletingThemeId,
      params.duplicatingThemeId,
      params.onOpenTheme,
      params.onDeleteTheme,
      params.onDuplicateTheme,
      params.onGenerateNew,
      params.onBack,
      filter,
      selectedFriend,
      handleClearFriendFilter,
      handleToggleShowArchived,
      handleToggleArchive,
    ]
  );

  const friendFilterModalProps = useMemo(
    () => ({
      isOpen: showFriendFilterModal,
      friends: friends ?? [],
      onSelectFriend: handleSetFriendFilter,
      onShowAll: handleClearFriendFilter,
      onShowMyThemes: handleShowMyThemes,
      onClose: () => setShowFriendFilterModal(false),
    }),
    [friends, handleClearFriendFilter, handleSetFriendFilter, handleShowMyThemes, showFriendFilterModal]
  );

  return {
    themes,
    listProps,
    friendFilterModalProps,
  };
}
