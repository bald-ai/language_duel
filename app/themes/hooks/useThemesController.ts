"use client";

import { useCallback, useMemo, useState } from "react";
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
      generation.pickAndPrune.requestDiscard();
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
  }, [detail, generation.pickAndPrune, router, viewMode, wordEdit.wordEditor]);

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

  const detailProps = useMemo(
    () => ({
      theme: detail.selectedTheme!,
      localWords: detail.localWords,
      onThemeNameChange: detail.handleThemeNameChange,
      onDeleteWord: detail.handleDeleteWord,
      onEditWord: wordEdit.handleEditWord,
      onSave: detail.handleSaveTheme,
      onCancel: detail.handleCancelTheme,
      isSaving: themeActions.isCreating || themeActions.isUpdating,
      onToggleArchive: list.handleToggleArchive,
      isArchived: list.showArchived,
      showAddWordModal: generation.showAddWordModal,
      onShowAddWordModal: generation.setShowAddWordModal,
      addWordState: {
        newWordInput: generation.addWordHook.newWordInput,
        isAdding: generation.addWordHook.isAdding,
        error: generation.addWordHook.error,
      },
      onAddWordInputChange: generation.addWordHook.setNewWordInput,
      onAddWord: generation.handleAddWord,
      onAddWordReset: generation.addWordHook.reset,
      showGenerateRandomModal: generation.showGenerateRandomModal,
      onShowGenerateRandomModal: generation.setShowGenerateRandomModal,
      generateRandomState: {
        count: generation.generateRandomHook.count,
        isGenerating: generation.generateRandomHook.isGenerating,
        generationMode: generation.generateRandomHook.generationMode,
        error: generation.generateRandomHook.error,
      },
      onRandomCountChange: generation.generateRandomHook.setCount,
      onGenerateRandom: generation.handleGenerateRandom,
      onGenerateRandomPickAndPrune: generation.handleGenerateRandomPickAndPrune,
      onGenerateRandomReset: generation.generateRandomHook.reset,
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
    }),
    [detail, generation, list, themeActions.isCreating, themeActions.isUpdating, tts, wordEdit.handleEditWord]
  );

  return {
    viewMode,
    selectedTheme: detail.selectedTheme,
    localWords: detail.localWords,
    themes: list.themes,
    showGenerateModal: generation.showGenerateModal,
    setShowGenerateModal: generation.setShowGenerateModal,
    deleteConfirm,
    setDeleteConfirm,
    goBack,
    listProps: list.listProps,
    friendFilterModalProps: list.friendFilterModalProps,
    generateModalProps: {
      ...generation.generateModalProps,
      onGenerate: generation.generateModalProps.onGenerate,
      onGeneratePickAndPrune: generation.generateModalProps.onGeneratePickAndPrune,
    },
    pickAndPruneReviewProps: generation.pickAndPruneReviewProps,
    detailProps,
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
    wordEditorState: wordEdit.wordEditor,
  };
}
