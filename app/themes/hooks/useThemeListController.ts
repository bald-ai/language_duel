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

export function useThemeListController(params: UseThemeListControllerParams) {
  const [selectedFriendFilter, setSelectedFriendFilter] = useState<Id<"users"> | null>(null);
  const [myThemesOnly, setMyThemesOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showFriendFilterModal, setShowFriendFilterModal] = useState(false);

  const queryArgs = useMemo(() => {
    if (showArchived) return { archivedOnly: true };
    if (myThemesOnly) return { myThemesOnly: true };
    if (selectedFriendFilter) return { filterByFriendId: selectedFriendFilter };
    return {};
  }, [myThemesOnly, selectedFriendFilter, showArchived]);

  const rawThemesQuery = useQuery(api.themes.getThemes, queryArgs);
  const friends = useQuery(api.friends.getFriends);
  const toggleArchiveMutation = useMutation(api.themes.toggleThemeArchive);

  const themes = useMemo(() => rawThemesQuery ?? [], [rawThemesQuery]);
  const selectedFriend = useMemo(() => {
    if (!selectedFriendFilter || !friends) return null;
    return friends.find((friend) => friend.friendId === selectedFriendFilter) ?? null;
  }, [selectedFriendFilter, friends]);

  const handleSetFriendFilter = useCallback((friendId: Id<"users">) => {
    setSelectedFriendFilter(friendId);
    setMyThemesOnly(false);
    setShowFriendFilterModal(false);
  }, []);

  const handleClearFriendFilter = useCallback(() => {
    setSelectedFriendFilter(null);
    setMyThemesOnly(false);
    setShowArchived(false);
    setShowFriendFilterModal(false);
  }, []);

  const handleShowMyThemes = useCallback(() => {
    setSelectedFriendFilter(null);
    setMyThemesOnly(true);
    setShowFriendFilterModal(false);
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
      selectedFriend,
      myThemesOnly,
      onOpenFriendFilter: () => setShowFriendFilterModal(true),
      onClearFriendFilter: handleClearFriendFilter,
      showArchived,
      onToggleShowArchived: () => setShowArchived((prev) => !prev),
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
      selectedFriend,
      myThemesOnly,
      handleClearFriendFilter,
      showArchived,
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
    friends,
    showArchived,
    listProps,
    friendFilterModalProps,
    handleToggleArchive,
  };
}
