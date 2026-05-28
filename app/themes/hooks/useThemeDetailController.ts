import { Dispatch, SetStateAction, useCallback, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ThemeWithOwner } from "@/convex/themes";
import type { WordEntry } from "@/lib/types";
import { getThemeSaveErrorMessage } from "@/lib/themes/themeUiValidation";
import { isWordTheme } from "@/lib/themes/themeContent";
import { areThemeWordsEqual } from "@/lib/themes/wordEditing";
import { DEFAULT_WORD_TYPE, VIEW_MODES, type ViewMode } from "../constants";
import type { ThemeDetailTheme } from "../components/ThemeDetail";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "sonner";
import type { DeleteConfirmState, SelectedThemeState } from "./themeControllerTypes";
import type { useThemeActions } from "./useThemeActions";

type ThemeActions = ReturnType<typeof useThemeActions>;

type UseThemeDetailControllerParams = {
  setDeleteConfirm: Dispatch<SetStateAction<DeleteConfirmState | null>>;
  themeActions: ThemeActions;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
};

export function useThemeDetailController(params: UseThemeDetailControllerParams) {
  const [selectedThemeState, setSelectedThemeState] = useState<SelectedThemeState>(null);
  const [localWords, setLocalWords] = useState<WordEntry[]>([]);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [isUpdatingFriendsCanEdit, setIsUpdatingFriendsCanEdit] = useState(false);

  const updateVisibilityMutation = useMutation(api.themes.updateThemeVisibility);
  const updateFriendsCanEditMutation = useMutation(api.themes.updateThemeFriendsCanEdit);

  const selectedTheme = useMemo<ThemeDetailTheme | null>(() => {
    if (!selectedThemeState) return null;
    if (selectedThemeState.kind === "saved") {
      const saved = selectedThemeState.theme;
      // Saved themes can be sentence themes too — those flow through a
      // separate controller (`useSentenceThemeController`). When a word-theme
      // path lands here for a sentence theme (which shouldn't happen because
      // `useThemesController.handleOpenTheme` routes sentence themes
      // elsewhere), surface an empty `words` array rather than letting
      // `undefined` leak into the editor.
      const savedWords = isWordTheme(saved) ? saved.words : [];
      return {
        ...saved,
        words: (savedWords ?? []) as ThemeDetailTheme["words"],
      };
    }
    const draft = selectedThemeState.draft;
    return {
      name: draft.name,
      description: draft.description,
      words: draft.words,
      wordType: draft.wordType,
      visibility: draft.visibility,
      friendsCanEdit: draft.friendsCanEdit,
      isOwner: true,
      canEdit: true,
    };
  }, [selectedThemeState]);

  const selectedWordType = selectedTheme?.wordType || DEFAULT_WORD_TYPE;
  const persistedSelectedTheme = useMemo(() => {
    if (!selectedThemeState || selectedThemeState.kind === "unsaved") return null;
    return selectedThemeState.theme;
  }, [selectedThemeState]);

  const hasUnsavedThemeChanges = useMemo(() => {
    if (!selectedThemeState) return false;
    if (selectedThemeState.kind === "unsaved") return true;
    if (!persistedSelectedTheme) return false;

    if (selectedThemeState.theme.name !== persistedSelectedTheme.name) {
      return true;
    }

    const persistedWords = isWordTheme(persistedSelectedTheme)
      ? persistedSelectedTheme.words
      : [];
    return !areThemeWordsEqual(localWords, persistedWords as WordEntry[]);
  }, [localWords, persistedSelectedTheme, selectedThemeState]);

  const openTheme = useCallback((theme: ThemeWithOwner) => {
    setSelectedThemeState({ kind: "saved", theme });
    const themeWords = isWordTheme(theme) ? theme.words : [];
    setLocalWords([...(themeWords ?? [])]);
    params.setViewMode(VIEW_MODES.DETAIL);
  }, [params]);

  const handleThemeNameChange = useCallback((name: string) => {
    setSelectedThemeState((prev) => {
      if (!prev) return null;
      if (prev.kind === "unsaved") return { kind: "unsaved", draft: { ...prev.draft, name } };
      return { kind: "saved", theme: { ...prev.theme, name } };
    });
  }, []);

  const handleVisibilityChange = useCallback(
    async (visibility: "private" | "shared") => {
      if (!selectedTheme || selectedTheme.isOwner === false) return;

      if (selectedThemeState?.kind === "unsaved") {
        setSelectedThemeState({ kind: "unsaved", draft: { ...selectedThemeState.draft, visibility } });
        return;
      }

      setIsUpdatingVisibility(true);
      try {
        if (selectedThemeState?.kind !== "saved") return;
        await updateVisibilityMutation({
          themeId: selectedThemeState.theme._id,
          visibility,
        });
        setSelectedThemeState((prev) => {
          if (!prev || prev.kind !== "saved") return prev;
          return { kind: "saved", theme: { ...prev.theme, visibility } };
        });
        toast.success(`Theme is now ${visibility}`);
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to update visibility"));
      } finally {
        setIsUpdatingVisibility(false);
      }
    },
    [selectedTheme, selectedThemeState, updateVisibilityMutation]
  );

  const handleFriendsCanEditChange = useCallback(
    async (friendsCanEdit: boolean) => {
      if (!selectedTheme || selectedTheme.isOwner === false) return;

      if (selectedThemeState?.kind === "unsaved") {
        setSelectedThemeState({ kind: "unsaved", draft: { ...selectedThemeState.draft, friendsCanEdit } });
        return;
      }

      setIsUpdatingFriendsCanEdit(true);
      try {
        if (selectedThemeState?.kind !== "saved") return;
        await updateFriendsCanEditMutation({
          themeId: selectedThemeState.theme._id,
          friendsCanEdit,
        });
        setSelectedThemeState((prev) => {
          if (!prev || prev.kind !== "saved") return prev;
          return { kind: "saved", theme: { ...prev.theme, friendsCanEdit } };
        });
        toast.success(friendsCanEdit ? "Friends can now edit this theme" : "Theme is now view-only for friends");
      } catch (err) {
        toast.error(getErrorMessage(err, "Failed to update edit permissions"));
      } finally {
        setIsUpdatingFriendsCanEdit(false);
      }
    },
    [selectedTheme, selectedThemeState, updateFriendsCanEditMutation]
  );

  const handleDeleteTheme = useCallback((themeId: Id<"themes">, themeName: string) => {
    params.setDeleteConfirm({ type: "theme", themeId, themeName });
  }, [params]);

  const handleDeleteWord = useCallback(
    (index: number) => {
      if (selectedTheme && selectedTheme.canEdit === false) return;

      const word = localWords[index];
      if (!word) return;
      params.setDeleteConfirm({ type: "word", wordIndex: index, wordName: word.word });
    },
    [localWords, params, selectedTheme]
  );

  const confirmDeleteWord = useCallback((deleteConfirm: DeleteConfirmState | null) => {
    if (deleteConfirm?.wordIndex === undefined) return;
    setLocalWords((prev) => prev.filter((_, idx) => idx !== deleteConfirm.wordIndex));
    params.setDeleteConfirm(null);
  }, [params]);

  const handleSaveTheme = useCallback(async () => {
    if (!selectedTheme || selectedTheme.canEdit === false) return;
    if (params.themeActions.isCreating || params.themeActions.isUpdating) return;

    const saveErrorMessage = getThemeSaveErrorMessage(localWords);
    if (saveErrorMessage) {
      toast.error(saveErrorMessage);
      return;
    }

    if (selectedThemeState?.kind === "unsaved") {
      const draft = selectedThemeState.draft;
      const result = await params.themeActions.create(
        selectedTheme.name,
        draft.description,
        localWords,
        draft.wordType,
        draft.saveRequestId,
        selectedTheme.visibility,
        selectedTheme.friendsCanEdit ?? false
      );
      if (result.ok) {
        setSelectedThemeState(null);
        params.setViewMode(VIEW_MODES.LIST);
        setLocalWords([]);
        toast.success("Theme created successfully");
      } else {
        toast.error(result.error || "Failed to create theme");
      }
    } else {
      if (selectedThemeState?.kind !== "saved") return;
      const result = await params.themeActions.update(selectedThemeState.theme._id, selectedTheme.name, localWords);
      if (result.ok) {
        setSelectedThemeState(null);
        params.setViewMode(VIEW_MODES.LIST);
        setLocalWords([]);
      } else {
        toast.error(result.error || "Failed to save theme");
      }
    }
  }, [localWords, params, selectedTheme, selectedThemeState]);

  const handleCancelTheme = useCallback(() => {
    setSelectedThemeState(null);
    params.setViewMode(VIEW_MODES.LIST);
    setLocalWords([]);
  }, [params]);

  const resetSelection = useCallback(() => {
    setSelectedThemeState(null);
    setLocalWords([]);
  }, []);

  return {
    selectedThemeState,
    setSelectedThemeState,
    selectedTheme,
    selectedWordType,
    localWords,
    setLocalWords,
    hasUnsavedThemeChanges,
    isUpdatingVisibility,
    isUpdatingFriendsCanEdit,
    openTheme,
    resetSelection,
    handleThemeNameChange,
    handleVisibilityChange,
    handleFriendsCanEditChange,
    handleDeleteTheme,
    handleDeleteWord,
    confirmDeleteWord,
    handleSaveTheme,
    handleCancelTheme,
  };
}
