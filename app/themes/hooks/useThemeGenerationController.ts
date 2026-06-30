import { Dispatch, SetStateAction, useCallback, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/errors";
import type { WordEntry } from "@/lib/types";
import { isWordDuplicate } from "@/lib/themes/themeUiValidation";
import { normalizeThemeName } from "@/lib/themes/serverValidation";
import {
  LLM_ADD_WORD_CREDITS,
  LLM_GENERATE_MORE_WORDS_CREDITS,
  LLM_WORD_THEME_CREDITS,
} from "@/lib/credits/constants";
import { AI_CREDITS_EXHAUSTED_MESSAGE } from "@/lib/userFacingErrors";
import {
  GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
  PICK_AND_PRUNE_WORD_COUNT,
  VIEW_MODES,
  type ViewMode,
  type WordType,
} from "../constants";
import type { ThemeDetailTheme } from "../components/ThemeDetail";
import { createSaveRequestId } from "../lib/saveRequestId";
import { useThemeGenerator, type GenerationMode } from "./useThemeGenerator";
import { useAddWord } from "./useAddWord";
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

  const ensureLlmCredits = useCallback((cost: number, signInMessage: string) => {
    if (currentUser === undefined) {
      toast.error("Credits are still loading. Try again.");
      return false;
    }

    if (!currentUser) {
      toast.error(signInMessage);
      return false;
    }

    if (currentUser.llmCreditsRemaining < cost) {
      toast.error(AI_CREDITS_EXHAUSTED_MESSAGE);
      return false;
    }

    return true;
  }, [currentUser]);

  const handleOpenGenerateModal = useCallback(() => {
    if (!ensureLlmCredits(LLM_WORD_THEME_CREDITS, "Please sign in to generate themes.")) return;

    themeGenerator.reset();
    pickAndPrune.clear();
    setShowGenerateModal(true);
  }, [ensureLlmCredits, pickAndPrune, themeGenerator]);

  // One handler for both modes; `mode` selects the word count and where the
  // generated words land (detail draft vs. Pick & Prune review).
  const handleGenerateTheme = useCallback(
    async (mode: GenerationMode) => {
      if (!ensureLlmCredits(LLM_WORD_THEME_CREDITS, "Please sign in to generate themes.")) return;

      const themeName = themeGenerator.themeName;
      const wordType = themeGenerator.wordType;

      try {
        const words = await themeGenerator.generate(
          mode === "pick-and-prune"
            ? { wordCountOverride: PICK_AND_PRUNE_WORD_COUNT, mode }
            : { mode }
        );
        if (!words) return;

        if (mode === "pick-and-prune") {
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
          return;
        }

        // Direct generation is intentionally not exposed in the UI while we
        // test Pick & Prune as the default flow for all AI-generated theme
        // content. Keep this path for now so we can remove or restore it
        // deliberately later.
        const draft: NewThemeDraft = {
          name: normalizeThemeName(themeName),
          description: `Generated theme for: ${themeName}`,
          words,
          wordType,
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
        toast.error(getErrorMessage(error, "Generation failed"));
      }
    },
    [ensureLlmCredits, params, pickAndPrune, themeGenerator]
  );

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

  const openAddWord = useCallback(() => {
    if (!ensureLlmCredits(LLM_ADD_WORD_CREDITS, "Please sign in to add words.")) return;

    addWordHook.reset();
    setShowAddWordModal(true);
  }, [addWordHook, ensureLlmCredits]);

  const closeAddWord = useCallback(() => {
    setShowAddWordModal(false);
    addWordHook.reset();
  }, [addWordHook]);

  const handleAddWord = useCallback(async () => {
    if (!params.selectedTheme) return;

    if (isWordDuplicate(addWordHook.newWordInput, params.localWords)) {
      addWordHook.setError(`"${addWordHook.newWordInput.trim()}" already exists in this theme`);
      return;
    }

    if (!ensureLlmCredits(LLM_ADD_WORD_CREDITS, "Please sign in to add words.")) return;

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
  }, [addWordHook, ensureLlmCredits, params]);

  const openGenerateMore = useCallback(() => {
    if (!ensureLlmCredits(LLM_GENERATE_MORE_WORDS_CREDITS, "Please sign in to generate more words.")) return;

    generateMoreHook.reset();
    setShowGenerateMoreModal(true);
  }, [ensureLlmCredits, generateMoreHook]);

  const closeGenerateMore = useCallback(() => {
    setShowGenerateMoreModal(false);
    generateMoreHook.reset();
  }, [generateMoreHook]);

  // One handler for both modes; `mode` selects the word count and whether the
  // new words append to the theme directly or go through Pick & Prune review.
  const handleGenerateMore = useCallback(
    async (mode: GenerationMode) => {
      if (!params.selectedTheme) return;
      if (!ensureLlmCredits(LLM_GENERATE_MORE_WORDS_CREDITS, "Please sign in to generate more words.")) return;

      const existingWords = params.localWords.map((word) => word.word);

      if (mode === "pick-and-prune") {
        const newWords = await generateMoreHook.generate(
          params.selectedTheme.name,
          params.selectedWordType,
          existingWords,
          { countOverride: GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT, pickAndPrune: true }
        );

        if (newWords) {
          pickAndPrune.initialize({ kind: "existing-theme", words: newWords });
          generateMoreHook.reset();
          setShowGenerateMoreModal(false);
          params.setViewMode(VIEW_MODES.PICK_AND_PRUNE_REVIEW);
        }
        return;
      }

      // Direct generation is intentionally not exposed in the UI while we test
      // Pick & Prune as the default flow for all AI-generated theme content.
      // Keep this path for now so we can remove or restore it deliberately
      // later.
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
    },
    [ensureLlmCredits, generateMoreHook, params, pickAndPrune]
  );

  const generateModalProps = useMemo(
    () => ({
      isOpen: showGenerateModal,
      themeName: themeGenerator.themeName,
      themePrompt: themeGenerator.themePrompt,
      wordType: themeGenerator.wordType,
      generationMode: themeGenerator.generationMode,
      error: themeGenerator.error,
      onThemeNameChange: themeGenerator.setThemeName,
      onThemePromptChange: themeGenerator.setThemePrompt,
      onWordTypeChange: themeGenerator.setWordType,
      onGenerate: () => handleGenerateTheme("pick-and-prune"),
      onClose: handleCloseGenerateModal,
    }),
    [handleCloseGenerateModal, handleGenerateTheme, showGenerateModal, themeGenerator]
  );

  const addWordModalProps = useMemo(
    () => ({
      isOpen: showAddWordModal,
      newWordInput: addWordHook.newWordInput,
      isAdding: addWordHook.isAdding,
      error: addWordHook.error,
      onInputChange: addWordHook.setNewWordInput,
      onAdd: handleAddWord,
      onClose: closeAddWord,
    }),
    [addWordHook, closeAddWord, handleAddWord, showAddWordModal]
  );

  const generateMoreModalProps = useMemo(
    () => ({
      isOpen: showGenerateMoreModal,
      themeName: params.selectedTheme?.name ?? "",
      isGenerating: generateMoreHook.isGenerating,
      error: generateMoreHook.error,
      onGenerate: () => handleGenerateMore("pick-and-prune"),
      onClose: closeGenerateMore,
    }),
    [closeGenerateMore, generateMoreHook, handleGenerateMore, params.selectedTheme?.name, showGenerateMoreModal]
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
    handleOpenGenerateModal,
    requestDiscardPickAndPrune: pickAndPrune.requestDiscard,
    openAddWord,
    openGenerateMore,
    generateModalProps,
    addWordModalProps,
    generateMoreModalProps,
    pickAndPruneReviewProps,
    discardPickAndPruneProps,
  };
}
