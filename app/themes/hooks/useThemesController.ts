"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { hasMissingThemeTts } from "@/lib/themes/tts";
import { isSentenceTheme } from "@/lib/themes/themeContent";
import { VIEW_MODES, type ViewMode } from "../constants";
import { useThemeActions } from "./useThemeActions";
import { useThemeDetailController } from "./useThemeDetailController";
import { useThemeGenerationController } from "./useThemeGenerationController";
import { useThemeListController } from "./useThemeListController";
import { useThemeTtsController } from "./useThemeTtsController";
import { useThemeWordEditController } from "./useThemeWordEditController";
import { useSentenceThemeController } from "./useSentenceThemeController";
import type { DeleteConfirmState } from "./themeControllerTypes";
import type { ThemeWithOwner } from "@/convex/themes";
import { toast } from "sonner";

export function useThemesController() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODES.LIST);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [showContentTypeModal, setShowContentTypeModal] = useState(false);
  const themeActions = useThemeActions();

  const sentenceController = useSentenceThemeController({
    onAfterSave: () => setViewMode(VIEW_MODES.LIST),
    onAfterCancel: () => setViewMode(VIEW_MODES.LIST),
  });

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
    if (sentenceController.editField) {
      sentenceController.handleEditFieldCancel();
      return;
    }
    if (sentenceController.isReviewActive) {
      // Mirror the word pick-and-prune back behaviour: confirm before dropping
      // the freshly generated rounds.
      sentenceController.reviewProps.onCancel();
      return;
    }
    if (sentenceController.selectedState !== null) {
      // Mirror the word-theme back behaviour: go through the discard confirm so
      // a draft (~20 rounds) or saved-theme edit isn't wiped on a stray tap.
      sentenceController.handleCancel();
      return;
    }
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
  }, [detail, generation, router, sentenceController, viewMode, wordEdit.wordEditor]);

  // Route theme opens by content type: sentence themes go to the sentence
  // detail flow, word themes stay on the existing detail controller.
  const handleOpenTheme = useCallback(
    (theme: ThemeWithOwner) => {
      if (isSentenceTheme(theme)) {
        sentenceController.openSavedTheme(theme);
        setViewMode(VIEW_MODES.DETAIL);
        return;
      }
      detail.openTheme(theme);
    },
    [detail, sentenceController]
  );

  const handleGenerateNew = useCallback(() => {
    setShowContentTypeModal(true);
  }, []);

  const handlePickWordContentType = useCallback(() => {
    setShowContentTypeModal(false);
    generation.handleOpenGenerateModal();
  }, [generation]);

  const handlePickSentenceContentType = useCallback(() => {
    setShowContentTypeModal(false);
    // Stay on the list until the generation actually returns a draft (the
    // sentence controller flips view mode via the unsaved draft callback).
    // Switching to DETAIL up front leaves a blank page when the user cancels.
    sentenceController.openGenerateModal();
  }, [sentenceController]);

  const list = useThemeListController({
    deletingThemeId: themeActions.deletingThemeId,
    duplicatingThemeId: themeActions.duplicatingThemeId,
    onOpenTheme: handleOpenTheme,
    onDeleteTheme: detail.handleDeleteTheme,
    onDuplicateTheme: async (themeId: Id<"themes">) => {
      const result = await themeActions.duplicate(themeId);
      if (!result.ok) {
        toast.error(result.error || "Failed to duplicate theme");
      }
    },
    onGenerateNew: handleGenerateNew,
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

  // Sentence-theme prop bundles consumed by page.tsx
  const sentenceDetailProps = sentenceController.selectedTheme
    ? {
        theme: sentenceController.selectedTheme,
        localRounds: sentenceController.localRounds,
        onThemeNameChange: sentenceController.handleThemeNameChange,
        onDeleteRound: sentenceController.handleDeleteRound,
        onEditField: sentenceController.handleEditField,
        onToggleFreeWord: sentenceController.handleToggleFreeWord,
        onSave: sentenceController.handleSave,
        onCancel: sentenceController.handleCancel,
        isSaving: sentenceController.isSaving,
        onOpenAddRound: sentenceController.handleAddManualRound,
        onOpenGenerateMore: sentenceController.openGenerateMoreModal,
        visibility: sentenceController.selectedTheme.visibility || "private",
        onVisibilityChange: sentenceController.handleVisibilityChange,
        friendsCanEdit: sentenceController.selectedTheme.friendsCanEdit ?? false,
        onFriendsCanEditChange: sentenceController.handleFriendsCanEditChange,
        isGeneratingTTS: sentenceController.isGeneratingTTS,
        isTTSUpToDate: sentenceController.isTTSUpToDate,
        onGenerateTTS:
          sentenceController.selectedState?.kind === "saved"
            ? sentenceController.handleGenerateSentenceTTS
            : undefined,
        playingRoundKey: sentenceController.playingRoundKey,
        onPlaySentenceTTS: sentenceController.handlePlaySentenceTTS,
      }
    : null;

  const sentenceEditorProps = sentenceController.editField
    ? {
        themeName: sentenceController.selectedTheme?.name ?? "",
        roundIndex: sentenceController.editField.roundIndex,
        field: sentenceController.editField.field,
        distractorIndex: sentenceController.editField.distractorIndex,
        initialValue: sentenceController.editField.initialValue,
        onSave: sentenceController.handleEditFieldSave,
        onBack: sentenceController.handleEditFieldCancel,
      }
    : null;

  const sentenceGenerateModalProps = {
    isOpen: sentenceController.isGenerateModalOpen,
    isGenerating: sentenceController.isGenerating,
    error: sentenceController.generationError,
    onClose: sentenceController.closeGenerateModal,
    onGenerate: (input: {
      themeName: string;
      themePrompt: string;
      targetRoundCount: number;
    }) => sentenceController.generateAndReview(input),
  };

  const sentencePickAndPruneReviewProps = sentenceController.reviewProps;

  const sentenceReviewDiscardProps = {
    isOpen: sentenceController.reviewDiscardConfirm,
    reviewKind: sentenceController.reviewKind,
    onConfirm: sentenceController.confirmDiscardReview,
    onCancel: sentenceController.cancelDiscardReview,
  };

  const sentenceGenerateMoreModalProps = {
    isOpen: sentenceController.isGenerateMoreModalOpen,
    themeName: sentenceController.selectedTheme?.name ?? "",
    isGenerating: sentenceController.isGenerating,
    error: sentenceController.generationError,
    onClose: sentenceController.closeGenerateMoreModal,
    onGenerate: () => sentenceController.generateMoreAndReview(),
  };

  const addSentenceModalProps = sentenceController.addSentenceModalProps;

  const contentTypeModalProps = {
    isOpen: showContentTypeModal,
    onPickWord: handlePickWordContentType,
    onPickSentence: handlePickSentenceContentType,
    onClose: () => setShowContentTypeModal(false),
  };

  const sentenceDiscardConfirmProps = {
    isOpen: sentenceController.showDiscardConfirm,
    reviewKind: sentenceController.discardReviewKind,
    onConfirm: sentenceController.confirmDiscard,
    onCancel: sentenceController.cancelDiscard,
  };

  return {
    // View state + the two render gates page.tsx switches on.
    viewMode,
    selectedTheme: detail.selectedTheme,
    wordEditorState: wordEdit.wordEditor,
    // Word-theme prop bundles
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
    // Sentence-theme prop bundles
    isSentenceFlowActive: sentenceController.selectedTheme !== null,
    isSentenceReviewActive: sentenceController.isReviewActive,
    sentenceEditField: sentenceController.editField,
    sentenceDetailProps,
    sentenceEditorProps,
    sentenceGenerateModalProps,
    sentenceGenerateMoreModalProps,
    addSentenceModalProps,
    sentencePickAndPruneReviewProps,
    sentenceReviewDiscardProps,
    sentenceDiscardConfirmProps,
    contentTypeModalProps,
  };
}
