"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { hasMissingThemeTts } from "@/lib/themes/tts";
import { VIEW_MODES, type ViewMode } from "../constants";
import { useThemeActions } from "./useThemeActions";
import { useThemeDetailController } from "./useThemeDetailController";
import { useThemeGenerationController } from "./useThemeGenerationController";
import { useThemeListController } from "./useThemeListController";
import { useThemeTtsController } from "./useThemeTtsController";
import { useThemeWordEditController } from "./useThemeWordEditController";
import type { DeleteConfirmState } from "./themeControllerTypes";
import { toast } from "sonner";

export function useThemesController() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODES.LIST);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const themeActions = useThemeActions();

  const detail = useThemeDetailController({
    setDeleteConfirm,
    themeActions,
    setViewMode,
  });

  const generation = useThemeGenerationController({
    selectedTheme: detail.selectedTheme,
    selectedWordType: detail.selectedWordType,
    localWords: detail.localWords,
    setLocalWords: detail.setLocalWords,
    setSelectedThemeState: detail.setSelectedThemeState,
    setViewMode,
  });

  const wordEdit = useThemeWordEditController({
    selectedTheme: detail.selectedTheme,
    selectedWordType: detail.selectedWordType,
    localWords: detail.localWords,
    setLocalWords: detail.setLocalWords,
    setViewMode,
  });

  const goBack = useCallback(() => {
    if (viewMode === VIEW_MODES.EDIT_WORD) {
      setViewMode(VIEW_MODES.DETAIL);
      wordEdit.wordEditor.reset();
    } else if (viewMode === VIEW_MODES.PICK_AND_PRUNE_REVIEW) {
      generation.requestDiscardPickAndPrune();
    } else if (viewMode === VIEW_MODES.DETAIL) {
      setViewMode(VIEW_MODES.LIST);
      detail.resetSelection();
    } else {
      if (typeof window !== "undefined" && window.history.length > 1) {
        router.back();
      } else {
        router.push("/");
      }
    }
  }, [detail, generation, router, viewMode, wordEdit.wordEditor]);

  const list = useThemeListController({
    deletingThemeId: themeActions.deletingThemeId,
    duplicatingThemeId: themeActions.duplicatingThemeId,
    onOpenTheme: detail.openTheme,
    onDeleteTheme: detail.handleDeleteTheme,
    onDuplicateTheme: async (themeId: Id<"themes">) => {
      const result = await themeActions.duplicate(themeId);
      if (!result.ok) {
        toast.error(result.error || "Failed to duplicate theme");
      }
    },
    onGenerateNew: generation.handleOpenGenerateModal,
    onBack: goBack,
  });

  const tts = useThemeTtsController({
    selectedTheme: detail.selectedTheme,
    selectedThemeState: detail.selectedThemeState,
    setSelectedThemeState: detail.setSelectedThemeState,
    setLocalWords: detail.setLocalWords,
    hasUnsavedThemeChanges: detail.hasUnsavedThemeChanges,
  });

  const confirmDeleteTheme = useCallback(async () => {
    if (!deleteConfirm?.themeId) return;
    const result = await themeActions.remove(deleteConfirm.themeId);
    if (!result.ok) {
      toast.error(result.error || "Failed to delete theme");
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, themeActions]);

  const detailProps = {
    theme: detail.selectedTheme!,
    localWords: detail.localWords,
    onThemeNameChange: detail.handleThemeNameChange,
    onDeleteWord: detail.handleDeleteWord,
    onEditWord: wordEdit.handleEditWord,
    onSave: detail.handleSaveTheme,
    onCancel: detail.handleCancelTheme,
    isSaving: themeActions.isCreating || themeActions.isUpdating,
    onOpenAddWord: generation.openAddWord,
    onOpenGenerateMore: generation.openGenerateMore,
    visibility: detail.selectedTheme?.visibility || "private",
    isUpdatingVisibility: detail.isUpdatingVisibility,
    onVisibilityChange: detail.handleVisibilityChange,
    friendsCanEdit: detail.selectedTheme?.friendsCanEdit || false,
    isUpdatingFriendsCanEdit: detail.isUpdatingFriendsCanEdit,
    onFriendsCanEditChange: detail.handleFriendsCanEditChange,
    isGeneratingTTS: tts.isGeneratingTTS,
    isTTSUpToDate: !hasMissingThemeTts(detail.localWords),
    onGenerateTTS: tts.handleGenerateThemeTTS,
    playingWordKey: tts.playingWordKey,
    onPlayWordTTS: tts.handlePlayThemeWordTTS,
  };

  return {
    // View state + the two render gates page.tsx switches on.
    viewMode,
    selectedTheme: detail.selectedTheme,
    wordEditorState: wordEdit.wordEditor,
    // Prop bundles, one per rendered surface.
    listProps: list.listProps,
    friendFilterModalProps: list.friendFilterModalProps,
    generateModalProps: generation.generateModalProps,
    pickAndPruneReviewProps: generation.pickAndPruneReviewProps,
    detailProps,
    addWordModalProps: generation.addWordModalProps,
    generateMoreModalProps: generation.generateMoreModalProps,
    wordEditorProps: {
      ...wordEdit.wordEditorProps,
      onBack: goBack,
    },
    deleteConfirmProps: {
      isOpen: deleteConfirm !== null,
      itemName: deleteConfirm?.themeName || deleteConfirm?.wordName || "",
      itemType: (deleteConfirm?.type || "word") as "theme" | "word",
      onConfirm: deleteConfirm?.type === "theme"
        ? confirmDeleteTheme
        : () => detail.confirmDeleteWord(deleteConfirm),
      onCancel: () => setDeleteConfirm(null),
    },
    discardPickAndPruneProps: generation.discardPickAndPruneProps,
  };
}
