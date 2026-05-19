import { Dispatch, SetStateAction, useCallback, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { WordEntry } from "@/lib/types";
import { isWordDuplicate } from "@/lib/themes/themeUiValidation";
import { normalizeThemeName } from "@/lib/themes/serverValidation";
import { LLM_THEME_CREDITS } from "@/lib/credits/constants";
import {
  GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
  PICK_AND_PRUNE_WORD_COUNT,
  VIEW_MODES,
  type ViewMode,
  type WordType,
} from "../constants";
import type { ThemeDetailTheme } from "../components/ThemeDetail";
import { createSaveRequestId } from "../lib/saveRequestId";
import { useThemeGenerator, useAddWord } from "./useThemeGenerator";
import { useGenerateMore } from "./useGenerateMore";
import { usePickAndPrune } from "./usePickAndPrune";
import type { NewThemeDraft, SelectedThemeState } from "./themeControllerTypes";

type UseThemeGenerationControllerParams = {
  selectedTheme: ThemeDetailTheme | null;
  selectedWordType: WordType;
  localWords: WordEntry[];
  setLocalWords: Dispatch<SetStateAction<WordEntry[]>>;
  setSelectedThemeState: Dispatch<SetStateAction<SelectedThemeState>>;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
};

export function useThemeGenerationController(params: UseThemeGenerationControllerParams) {
  const themeGenerator = useThemeGenerator();
  const pickAndPrune = usePickAndPrune();
  const addWordHook = useAddWord();
  const generateMoreHook = useGenerateMore();
  const currentUser = useQuery(api.users.getCurrentUser);

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [showGenerateMoreModal, setShowGenerateMoreModal] = useState(false);

  const handleOpenGenerateModal = useCallback(() => {
    if (currentUser === undefined) {
      toast.error("Credits are still loading. Try again.");
      return;
    }

    if (!currentUser) {
      toast.error("Please sign in to generate themes.");
      return;
    }

    if (currentUser.llmCreditsRemaining < LLM_THEME_CREDITS) {
      toast.error("LLM credits exhausted");
      return;
    }

    themeGenerator.reset();
    pickAndPrune.clear();
    setShowGenerateModal(true);
  }, [currentUser, pickAndPrune, themeGenerator]);

  const handleGenerateNewTheme = useCallback(async () => {
    try {
      const words = await themeGenerator.generate({ mode: "standard" });
      if (!words) return;

      const draft: NewThemeDraft = {
        name: normalizeThemeName(themeGenerator.themeName),
        description: `Generated theme for: ${themeGenerator.themeName}`,
        words,
        wordType: themeGenerator.wordType,
        visibility: "private",
        friendsCanEdit: false,
        saveRequestId: createSaveRequestId(),
      };

      params.setSelectedThemeState({ kind: "unsaved", draft });
      params.setLocalWords([...words]);
      params.setViewMode(VIEW_MODES.DETAIL);
      setShowGenerateModal(false);
      themeGenerator.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      toast.error(message);
    }
  }, [params, themeGenerator]);

  const handleGeneratePickAndPruneTheme = useCallback(async () => {
    const themeName = themeGenerator.themeName;
    const wordType = themeGenerator.wordType;

    try {
      const words = await themeGenerator.generate({
        wordCountOverride: PICK_AND_PRUNE_WORD_COUNT,
        mode: "pick-and-prune",
      });
      if (!words) return;

      pickAndPrune.initialize({
        name: normalizeThemeName(themeName),
        description: `Generated theme for: ${themeName}`,
        wordType,
        visibility: "private",
        friendsCanEdit: false,
        words,
      });
      setShowGenerateModal(false);
      themeGenerator.reset();
      params.setViewMode(VIEW_MODES.PICK_AND_PRUNE_REVIEW);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      toast.error(message);
    }
  }, [params, pickAndPrune, themeGenerator]);

  const handleCloseGenerateModal = useCallback(() => {
    setShowGenerateModal(false);
    themeGenerator.reset();
  }, [themeGenerator]);

  const handleContinuePickAndPrune = useCallback(() => {
    if (!pickAndPrune.draft) return;

    const keptWords = pickAndPrune.getActiveWordEntries();
    if (keptWords.length === 0) return;

    if (pickAndPrune.draft.kind === "existing-theme") {
      params.setLocalWords((previousWords) => [...previousWords, ...keptWords]);
      params.setViewMode(VIEW_MODES.DETAIL);
      pickAndPrune.clear();
      return;
    }

    const draft: NewThemeDraft = {
      name: pickAndPrune.draft.name,
      description: pickAndPrune.draft.description,
      wordType: pickAndPrune.draft.wordType,
      visibility: pickAndPrune.draft.visibility,
      friendsCanEdit: pickAndPrune.draft.friendsCanEdit,
      saveRequestId: pickAndPrune.draft.saveRequestId,
      words: keptWords,
    };

    params.setSelectedThemeState({ kind: "unsaved", draft });
    params.setLocalWords(keptWords);
    params.setViewMode(VIEW_MODES.DETAIL);
    pickAndPrune.clear();
  }, [params, pickAndPrune]);

  const handleConfirmDiscardPickAndPrune = useCallback(() => {
    const isExistingThemeReview = pickAndPrune.draft?.kind === "existing-theme";
    pickAndPrune.clear();
    if (isExistingThemeReview) {
      params.setViewMode(VIEW_MODES.DETAIL);
      return;
    }

    params.setSelectedThemeState(null);
    params.setLocalWords([]);
    params.setViewMode(VIEW_MODES.LIST);
  }, [params, pickAndPrune]);

  const handleAddWord = useCallback(async () => {
    if (!params.selectedTheme) return;

    if (isWordDuplicate(addWordHook.newWordInput, params.localWords)) {
      addWordHook.setError(`"${addWordHook.newWordInput.trim()}" already exists in this theme`);
      return;
    }

    const existingWords = params.localWords.map((word) => word.word);
    const newWord = await addWordHook.add(
      params.selectedTheme.name,
      params.selectedWordType,
      existingWords
    );

    if (newWord) {
      params.setLocalWords((prev) => [...prev, newWord]);
      addWordHook.reset();
      setShowAddWordModal(false);
    }
  }, [addWordHook, params]);

  const handleGenerateMore = useCallback(async () => {
    if (!params.selectedTheme) return;

    const existingWords = params.localWords.map((word) => word.word);
    const newWords = await generateMoreHook.generate(
      params.selectedTheme.name,
      params.selectedWordType,
      existingWords
    );

    if (newWords) {
      params.setLocalWords((prev) => [...prev, ...newWords]);
      generateMoreHook.reset();
      setShowGenerateMoreModal(false);
    }
  }, [generateMoreHook, params]);

  const handleGenerateMorePickAndPrune = useCallback(async () => {
    if (!params.selectedTheme) return;

    const existingWords = params.localWords.map((word) => word.word);
    const newWords = await generateMoreHook.generate(
      params.selectedTheme.name,
      params.selectedWordType,
      existingWords,
      {
        countOverride: GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
        pickAndPrune: true,
      }
    );

    if (newWords) {
      pickAndPrune.initialize({
        kind: "existing-theme",
        words: newWords,
      });
      generateMoreHook.reset();
      setShowGenerateMoreModal(false);
      params.setViewMode(VIEW_MODES.PICK_AND_PRUNE_REVIEW);
    }
  }, [generateMoreHook, params, pickAndPrune]);

  const generateModalProps = useMemo(
    () => ({
      isOpen: showGenerateModal,
      themeName: themeGenerator.themeName,
      themePrompt: themeGenerator.themePrompt,
      wordType: themeGenerator.wordType,
      wordCount: themeGenerator.wordCount,
      generationMode: themeGenerator.generationMode,
      error: themeGenerator.error,
      onThemeNameChange: themeGenerator.setThemeName,
      onThemePromptChange: themeGenerator.setThemePrompt,
      onWordTypeChange: themeGenerator.setWordType,
      onWordCountChange: themeGenerator.setWordCount,
      onGenerate: handleGenerateNewTheme,
      onGeneratePickAndPrune: handleGeneratePickAndPruneTheme,
      onClose: handleCloseGenerateModal,
    }),
    [handleCloseGenerateModal, handleGenerateNewTheme, handleGeneratePickAndPruneTheme, showGenerateModal, themeGenerator]
  );

  const reviewKind: "new-theme" | "existing-theme" =
    pickAndPrune.draft?.kind === "existing-theme" ? "existing-theme" : "new-theme";

  const pickAndPruneReviewProps = useMemo(
    () => ({
      reviewKind,
      activeWords: pickAndPrune.activeWords,
      removedWords: pickAndPrune.removedWords,
      removedOpen: pickAndPrune.removedOpen,
      onRemovedOpenChange: pickAndPrune.setRemovedOpen,
      onRemove: pickAndPrune.removeWord,
      onRestore: pickAndPrune.restoreWord,
      onContinue: handleContinuePickAndPrune,
      onCancel: pickAndPrune.requestDiscard,
    }),
    [handleContinuePickAndPrune, pickAndPrune, reviewKind]
  );

  const discardPickAndPruneProps = useMemo(
    () => ({
      isOpen: pickAndPrune.showDiscardConfirm,
      reviewKind,
      onConfirm: handleConfirmDiscardPickAndPrune,
      onCancel: pickAndPrune.cancelDiscard,
    }),
    [handleConfirmDiscardPickAndPrune, pickAndPrune, reviewKind]
  );

  return {
    showGenerateModal,
    setShowGenerateModal,
    showAddWordModal,
    setShowAddWordModal,
    showGenerateMoreModal,
    setShowGenerateMoreModal,
    addWordHook,
    generateMoreHook,
    pickAndPrune,
    handleOpenGenerateModal,
    handleAddWord,
    handleGenerateMore,
    handleGenerateMorePickAndPrune,
    generateModalProps,
    pickAndPruneReviewProps,
    discardPickAndPruneProps,
  };
}
