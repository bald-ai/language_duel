import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
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
import type {
  DeleteConfirmState,
  SelectedThemeState,
} from "./themeControllerTypes";
import type { useThemeActions } from "./useThemeActions";

type ThemeActions = ReturnType<typeof useThemeActions>;

type UseThemeDetailControllerParams = {
  setDeleteConfirm: Dispatch<SetStateAction<DeleteConfirmState | null>>;
  themeActions: ThemeActions;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
};

export function useThemeDetailController(
  params: UseThemeDetailControllerParams,
) {
  const [selectedThemeState, setSelectedThemeState] =
    useState<SelectedThemeState>(null);
  const [localWords, setLocalWords] = useState<WordEntry[]>([]);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [isUpdatingFriendsCanEdit, setIsUpdatingFriendsCanEdit] =
    useState(false);

  const updateVisibilityMutation = useMutation(
    api.themes.updateThemeVisibility,
  );
  const updateFriendsCanEditMutation = useMutation(
    api.themes.updateThemeFriendsCanEdit,
  );

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
    if (!selectedThemeState || selectedThemeState.kind === "unsaved")
      return null;
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

  const openTheme = useCallback(
    (theme: ThemeWithOwner) => {
      setSelectedThemeState({ kind: "saved", theme });
      const themeWords = isWordTheme(theme) ? theme.words : [];
      setLocalWords([...(themeWords ?? [])]);
      params.setViewMode(VIEW_MODES.DETAIL);
    },
    [params],
  );

  const handleThemeNameChange = useCallback((name: string) => {
    setSelectedThemeState((prev) => {
      if (!prev) return null;
      if (prev.kind === "unsaved")
        return { kind: "unsaved", draft: { ...prev.draft, name } };
      return { kind: "saved", theme: { ...prev.theme, name } };
    });
  }, []);

  const canChangeSharing =
    selectedTheme !== null && selectedTheme.isOwner !== false;

  const handleVisibilityChange = useCallback(
    async (visibility: "private" | "shared") => {
      if (!canChangeSharing) return;

      if (selectedThemeState?.kind === "unsaved") {
        setSelectedThemeState({
          kind: "unsaved",
          draft: { ...selectedThemeState.draft, visibility },
        });
        return;
      }

      await persistSavedThemeSharing({
        selection: selectedThemeState,
        setPending: setIsUpdatingVisibility,
        write: (themeId) => updateVisibilityMutation({ themeId, visibility }),
        applyLocalUpdate: () =>
          setSelectedThemeState((prev) => {
            if (!prev || prev.kind !== "saved") return prev;
            return { kind: "saved", theme: { ...prev.theme, visibility } };
          }),
        successMessage: `Theme is now ${visibility}`,
        failureMessage: "Failed to update visibility",
      });
    },
    [canChangeSharing, selectedThemeState, updateVisibilityMutation],
  );

  const handleFriendsCanEditChange = useCallback(
    async (friendsCanEdit: boolean) => {
      if (!canChangeSharing) return;

      if (selectedThemeState?.kind === "unsaved") {
        setSelectedThemeState({
          kind: "unsaved",
          draft: { ...selectedThemeState.draft, friendsCanEdit },
        });
        return;
      }

      await persistSavedThemeSharing({
        selection: selectedThemeState,
        setPending: setIsUpdatingFriendsCanEdit,
        write: (themeId) =>
          updateFriendsCanEditMutation({ themeId, friendsCanEdit }),
        applyLocalUpdate: () =>
          setSelectedThemeState((prev) => {
            if (!prev || prev.kind !== "saved") return prev;
            return { kind: "saved", theme: { ...prev.theme, friendsCanEdit } };
          }),
        successMessage: friendsCanEdit
          ? "Friends can now edit this theme"
          : "Theme is now view-only for friends",
        failureMessage: "Failed to update edit permissions",
      });
    },
    [canChangeSharing, selectedThemeState, updateFriendsCanEditMutation],
  );

  const handleDeleteTheme = useCallback(
    (themeId: Id<"themes">, themeName: string) => {
      params.setDeleteConfirm({ type: "theme", themeId, themeName });
    },
    [params],
  );

  const handleDeleteWord = useCallback(
    (index: number) => {
      if (selectedTheme && selectedTheme.canEdit === false) return;

      const word = localWords[index];
      if (!word) return;
      params.setDeleteConfirm({
        type: "word",
        wordIndex: index,
        wordName: word.word,
      });
    },
    [localWords, params, selectedTheme],
  );

  const confirmDeleteWord = useCallback(
    (deleteConfirm: DeleteConfirmState | null) => {
      if (deleteConfirm?.wordIndex === undefined) return;
      setLocalWords((prev) =>
        prev.filter((_, idx) => idx !== deleteConfirm.wordIndex),
      );
      params.setDeleteConfirm(null);
    },
    [params],
  );

  const handleSaveTheme = useCallback(async () => {
    if (!selectedTheme || selectedTheme.canEdit === false) return;
    if (params.themeActions.isCreating || params.themeActions.isUpdating)
      return;

    const saveErrorMessage = getThemeSaveErrorMessage(localWords);
    if (saveErrorMessage) {
      toast.error(saveErrorMessage);
      return;
    }

    const saved = await persistThemeChanges(
      selectedThemeState,
      selectedTheme,
      localWords,
      params.themeActions,
    );
    applyThemeSaveResult(saved, () => {
      setSelectedThemeState(null);
      params.setViewMode(VIEW_MODES.LIST);
      setLocalWords([]);
    });
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

type ThemeSaveOutcome = {
  result: Awaited<ReturnType<ThemeActions["update"]>>;
  failureMessage: string;
  successMessage?: string;
};

async function persistThemeChanges(
  selection: SelectedThemeState,
  theme: ThemeDetailTheme,
  words: WordEntry[],
  actions: ThemeActions,
): Promise<ThemeSaveOutcome | null> {
  if (selection?.kind === "unsaved") {
    const draft = selection.draft;
    return {
      result: await actions.create(
        theme.name,
        draft.description,
        words,
        draft.wordType,
        draft.saveRequestId,
        theme.visibility,
        theme.friendsCanEdit ?? false,
      ),
      failureMessage: "Failed to create theme",
      successMessage: "Theme created successfully",
    };
  }
  if (selection?.kind !== "saved") return null;
  return {
    result: await actions.update(selection.theme._id, theme.name, words),
    failureMessage: "Failed to save theme",
  };
}

function applyThemeSaveResult(
  saved: ThemeSaveOutcome | null,
  onSaved: () => void,
) {
  if (!saved) return;
  if (!saved.result.ok) {
    toast.error(saved.result.error || saved.failureMessage);
    return;
  }
  onSaved();
  if (saved.successMessage) toast.success(saved.successMessage);
}

async function persistSavedThemeSharing({
  selection,
  setPending,
  write,
  applyLocalUpdate,
  successMessage,
  failureMessage,
}: {
  selection: SelectedThemeState;
  setPending: Dispatch<SetStateAction<boolean>>;
  write: (themeId: Id<"themes">) => Promise<unknown>;
  applyLocalUpdate: () => void;
  successMessage: string;
  failureMessage: string;
}) {
  setPending(true);
  try {
    if (selection?.kind !== "saved") return;
    await write(selection.theme._id);
    applyLocalUpdate();
    toast.success(successMessage);
  } catch (error) {
    toast.error(getErrorMessage(error, failureMessage));
  } finally {
    setPending(false);
  }
}
