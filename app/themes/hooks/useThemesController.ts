"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { WordEntry } from "@/lib/types";
import {
  checkThemeForDuplicateWrongAnswers,
  checkThemeForDuplicateWords,
  isWordDuplicate,
  checkThemeForWrongMatchingAnswer,
} from "@/lib/themes";
import { VIEW_MODES, FIELD_TYPES, type ViewMode, type FieldType } from "../constants";
import {
  useThemeGenerator,
  useAddWord,
  useGenerateRandom,
  useWordEditor,
  useThemeActions,
} from "./index";

interface DeleteConfirmState {
  type: "theme" | "word";
  themeId?: Id<"themes">;
  themeName?: string;
  wordIndex?: number;
  wordName?: string;
}

interface ThemeWithStatus extends Doc<"themes"> {
  hasDuplicateWords: boolean;
  hasDuplicateWrongAnswers: boolean;
}

export function useThemesController() {
  const router = useRouter();

  // Convex queries
  const rawThemesQuery = useQuery(api.themes.getThemes);

  // Custom hooks
  const themeGenerator = useThemeGenerator();
  const addWordHook = useAddWord();
  const generateRandomHook = useGenerateRandom();
  const wordEditor = useWordEditor();
  const themeActions = useThemeActions();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODES.LIST);
  const [selectedTheme, setSelectedTheme] = useState<Doc<"themes"> | null>(null);
  const [localWords, setLocalWords] = useState<WordEntry[]>([]);

  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [showGenerateRandomModal, setShowGenerateRandomModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

  // Pre-compute validation flags for themes
  const themes: ThemeWithStatus[] = useMemo(() => {
    const rawThemes = rawThemesQuery || [];
    return rawThemes.map((t) => ({
      ...t,
      hasDuplicateWords: checkThemeForDuplicateWords(t.words),
      hasDuplicateWrongAnswers: checkThemeForDuplicateWrongAnswers(t.words),
    }));
  }, [rawThemesQuery]);

  // Navigation
  const goBack = useCallback(() => {
    if (viewMode === VIEW_MODES.EDIT_WORD) {
      setViewMode(VIEW_MODES.DETAIL);
      wordEditor.reset();
    } else if (viewMode === VIEW_MODES.DETAIL) {
      setViewMode(VIEW_MODES.LIST);
      setSelectedTheme(null);
      setLocalWords([]);
    } else {
      router.push("/");
    }
  }, [viewMode, wordEditor, router]);

  // Theme actions
  const openTheme = useCallback((theme: Doc<"themes">) => {
    setSelectedTheme(theme);
    setLocalWords([...theme.words]);
    setViewMode(VIEW_MODES.DETAIL);
  }, []);

  const handleDeleteTheme = useCallback((themeId: Id<"themes">, themeName: string) => {
    setDeleteConfirm({ type: "theme", themeId, themeName });
  }, []);

  const confirmDeleteTheme = useCallback(async () => {
    if (!deleteConfirm?.themeId) return;
    const result = await themeActions.remove(deleteConfirm.themeId);
    if (!result.ok) {
      alert(result.error || "Failed to delete theme");
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, themeActions]);

  const handleDuplicateTheme = useCallback(
    async (themeId: Id<"themes">) => {
      const result = await themeActions.duplicate(themeId);
      if (!result.ok) {
        alert(result.error || "Failed to duplicate theme");
      }
    },
    [themeActions]
  );

  const handleGenerateNewTheme = useCallback(async () => {
    const words = await themeGenerator.generate();
    if (words) {
      const result = await themeActions.create(
        themeGenerator.themeName,
        `Generated theme for: ${themeGenerator.themeName}`,
        words,
        themeGenerator.wordType
      );
      if (result.ok) {
        setShowGenerateModal(false);
        themeGenerator.reset();
      } else {
        alert(result.error || "Failed to create theme");
      }
    }
  }, [themeGenerator, themeActions]);

  const handleCloseGenerateModal = useCallback(() => {
    setShowGenerateModal(false);
    themeGenerator.reset();
  }, [themeGenerator]);

  // Theme detail actions
  const handleThemeNameChange = useCallback((name: string) => {
    setSelectedTheme((prev) => (prev ? { ...prev, name } : null));
  }, []);

  const handleDeleteWord = useCallback(
    (index: number) => {
      const word = localWords[index];
      setDeleteConfirm({ type: "word", wordIndex: index, wordName: word.word });
    },
    [localWords]
  );

  const confirmDeleteWord = useCallback(() => {
    if (deleteConfirm?.wordIndex === undefined) return;
    setLocalWords((prev) => prev.filter((_, idx) => idx !== deleteConfirm.wordIndex));
    setDeleteConfirm(null);
  }, [deleteConfirm]);

  const handleEditWord = useCallback(
    (wordIndex: number, field: FieldType, wrongIndex?: number) => {
      const word = localWords[wordIndex];
      let value = "";
      if (field === FIELD_TYPES.WORD) value = word.word;
      else if (field === FIELD_TYPES.ANSWER) value = word.answer;
      else value = word.wrongAnswers[wrongIndex ?? 0];

      wordEditor.startEdit(wordIndex, field, value, wrongIndex);
      setViewMode(VIEW_MODES.EDIT_WORD);
    },
    [localWords, wordEditor]
  );

  const handleSaveTheme = useCallback(async () => {
    if (!selectedTheme) return;

    if (checkThemeForDuplicateWords(localWords)) {
      alert(
        "Cannot save: This theme has duplicate words. Please fix the duplicate words (marked with red !) before saving."
      );
      return;
    }

    if (checkThemeForDuplicateWrongAnswers(localWords)) {
      alert(
        "Cannot save: This theme has duplicate wrong answers. Please fix the duplicate wrong answers (marked with orange ⚠) before saving."
      );
      return;
    }

    if (checkThemeForWrongMatchingAnswer(localWords)) {
      alert(
        "Cannot save: One or more wrong answers match the correct answer. Please ensure all choices are unique (marked with orange ⚠)."
      );
      return;
    }

    const result = await themeActions.update(selectedTheme._id, selectedTheme.name, localWords);
    if (result.ok) {
      setViewMode(VIEW_MODES.LIST);
      setSelectedTheme(null);
      setLocalWords([]);
    } else {
      alert(result.error || "Failed to save theme");
    }
  }, [selectedTheme, localWords, themeActions]);

  const handleCancelTheme = useCallback(() => {
    setViewMode(VIEW_MODES.LIST);
    setSelectedTheme(null);
    setLocalWords([]);
  }, []);

  // Add word actions
  const handleAddWord = useCallback(async () => {
    if (!selectedTheme) return;

    // Check for duplicate
    if (isWordDuplicate(addWordHook.newWordInput, localWords)) {
      addWordHook.setError(`"${addWordHook.newWordInput.trim()}" already exists in this theme`);
      return;
    }

    const existingWords = localWords.map((w) => w.word);
    const newWord = await addWordHook.add(
      selectedTheme.name,
      selectedTheme.wordType || "nouns",
      existingWords
    );

    if (newWord) {
      setLocalWords((prev) => [...prev, newWord]);
      addWordHook.reset();
      setShowAddWordModal(false); // Close modal on success
    }
  }, [selectedTheme, localWords, addWordHook]);

  // Generate random words actions
  const handleGenerateRandom = useCallback(async () => {
    if (!selectedTheme) return;

    const existingWords = localWords.map((w) => w.word);
    const newWords = await generateRandomHook.generate(
      selectedTheme.name,
      selectedTheme.wordType || "nouns",
      existingWords
    );

    if (newWords) {
      setLocalWords((prev) => [...prev, ...newWords]);
      generateRandomHook.reset();
      setShowGenerateRandomModal(false); // Close modal on success
    }
  }, [selectedTheme, localWords, generateRandomHook]);

  // Word editor actions
  const handleGenerate = useCallback(async () => {
    if (wordEditor.editingWordIndex === null || !selectedTheme) return;

    const word = localWords[wordEditor.editingWordIndex];
    const existingWords = localWords
      .filter((_, idx) => idx !== wordEditor.editingWordIndex)
      .map((w) => w.word);

    try {
      await wordEditor.generate(
        selectedTheme.name,
        selectedTheme.wordType || "nouns",
        word,
        existingWords
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Generation failed");
    }
  }, [wordEditor, selectedTheme, localWords]);

  const handleRegenerate = useCallback(async () => {
    if (wordEditor.editingWordIndex === null || !selectedTheme) return;

    const word = localWords[wordEditor.editingWordIndex];
    const existingWords = localWords
      .filter((_, idx) => idx !== wordEditor.editingWordIndex)
      .map((w) => w.word);

    try {
      await wordEditor.regenerate(
        selectedTheme.name,
        selectedTheme.wordType || "nouns",
        word,
        existingWords
      );
    } catch (error) {
      alert(error instanceof Error ? error.message : "Regeneration failed");
    }
  }, [wordEditor, selectedTheme, localWords]);

  const handleAcceptGenerated = useCallback(() => {
    if (wordEditor.editingWordIndex === null || !wordEditor.editingField) return;

    setLocalWords((prev) => {
      const updatedWords = [...prev];
      const word = { ...updatedWords[wordEditor.editingWordIndex!] };

      if (wordEditor.editingField === FIELD_TYPES.WORD) {
        if (wordEditor.generatedWordData) {
          updatedWords[wordEditor.editingWordIndex!] = wordEditor.generatedWordData;
        }
      } else if (wordEditor.editingField === FIELD_TYPES.ANSWER) {
        word.answer = wordEditor.generatedValue;
        updatedWords[wordEditor.editingWordIndex!] = word;
      } else {
        word.wrongAnswers = [...word.wrongAnswers];
        word.wrongAnswers[wordEditor.editingWrongIndex] = wordEditor.generatedValue;
        updatedWords[wordEditor.editingWordIndex!] = word;
      }

      return updatedWords;
    });

    setViewMode(VIEW_MODES.DETAIL);
    wordEditor.reset();
  }, [wordEditor]);

  const handleSaveManual = useCallback(() => {
    if (wordEditor.editingWordIndex === null || !wordEditor.editingField) return;

    // If editing word field and value changed, show regeneration prompt
    if (
      wordEditor.editingField === FIELD_TYPES.WORD &&
      wordEditor.manualValue.trim() !== wordEditor.oldValue.trim()
    ) {
      wordEditor.showRegenerateConfirm(wordEditor.manualValue);
      return;
    }

    // For other fields, save directly
    setLocalWords((prev) => {
      const updatedWords = [...prev];
      const word = { ...updatedWords[wordEditor.editingWordIndex!] };

      if (wordEditor.editingField === FIELD_TYPES.WORD) {
        word.word = wordEditor.manualValue;
      } else if (wordEditor.editingField === FIELD_TYPES.ANSWER) {
        word.answer = wordEditor.manualValue;
      } else {
        word.wrongAnswers = [...word.wrongAnswers];
        word.wrongAnswers[wordEditor.editingWrongIndex] = wordEditor.manualValue;
      }

      updatedWords[wordEditor.editingWordIndex!] = word;
      return updatedWords;
    });

    setViewMode(VIEW_MODES.DETAIL);
    wordEditor.reset();
  }, [wordEditor]);

  const handleRegenerateSkip = useCallback(() => {
    if (wordEditor.editingWordIndex === null) return;

    setLocalWords((prev) => {
      const updatedWords = [...prev];
      const word = { ...updatedWords[wordEditor.editingWordIndex!] };
      word.word = wordEditor.pendingManualWord;
      updatedWords[wordEditor.editingWordIndex!] = word;
      return updatedWords;
    });

    wordEditor.hideRegenerateConfirm();
    setViewMode(VIEW_MODES.DETAIL);
    wordEditor.reset();
  }, [wordEditor]);

  const handleRegenerateConfirm = useCallback(async () => {
    if (wordEditor.editingWordIndex === null || !selectedTheme) return;

    try {
      const result = await wordEditor.regenerateAnswersForWord(
        selectedTheme.name,
        selectedTheme.wordType || "nouns"
      );

      if (result) {
        setLocalWords((prev) => {
          const updatedWords = [...prev];
          updatedWords[wordEditor.editingWordIndex!] = {
            word: wordEditor.pendingManualWord,
            answer: result.answer,
            wrongAnswers: result.wrongAnswers,
          };
          return updatedWords;
        });

        wordEditor.hideRegenerateConfirm();
        setViewMode(VIEW_MODES.DETAIL);
        wordEditor.reset();
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : "Regeneration failed");
    }
  }, [wordEditor, selectedTheme]);

  return {
    // View state
    viewMode,
    selectedTheme,
    localWords,
    themes,

    // Modal state
    showGenerateModal,
    setShowGenerateModal,
    deleteConfirm,
    setDeleteConfirm,

    // Navigation
    goBack,

    // Theme list props
    listProps: {
      themes,
      deletingThemeId: themeActions.deletingThemeId,
      duplicatingThemeId: themeActions.duplicatingThemeId,
      onOpenTheme: openTheme,
      onDeleteTheme: handleDeleteTheme,
      onDuplicateTheme: handleDuplicateTheme,
      onGenerateNew: () => setShowGenerateModal(true),
      onBack: goBack,
    },

    // Generate modal props
    generateModalProps: {
      isOpen: showGenerateModal,
      themeName: themeGenerator.themeName,
      themePrompt: themeGenerator.themePrompt,
      wordType: themeGenerator.wordType,
      isGenerating: themeGenerator.isGenerating,
      error: themeGenerator.error,
      onThemeNameChange: themeGenerator.setThemeName,
      onThemePromptChange: themeGenerator.setThemePrompt,
      onWordTypeChange: themeGenerator.setWordType,
      onGenerate: handleGenerateNewTheme,
      onClose: handleCloseGenerateModal,
    },

    // Theme detail props
    detailProps: {
      theme: selectedTheme!,
      localWords,
      onThemeNameChange: handleThemeNameChange,
      onDeleteWord: handleDeleteWord,
      onEditWord: handleEditWord,
      onSave: handleSaveTheme,
      onCancel: handleCancelTheme,
      showAddWordModal,
      onShowAddWordModal: setShowAddWordModal,
      addWordState: {
        newWordInput: addWordHook.newWordInput,
        isAdding: addWordHook.isAdding,
        error: addWordHook.error,
      },
      onAddWordInputChange: addWordHook.setNewWordInput,
      onAddWord: handleAddWord,
      onAddWordReset: addWordHook.reset,
      showGenerateRandomModal,
      onShowGenerateRandomModal: setShowGenerateRandomModal,
      generateRandomState: {
        count: generateRandomHook.count,
        isGenerating: generateRandomHook.isGenerating,
        error: generateRandomHook.error,
      },
      onRandomCountChange: generateRandomHook.setCount,
      onGenerateRandom: handleGenerateRandom,
      onGenerateRandomReset: generateRandomHook.reset,
    },

    // Word editor props
    wordEditorProps: {
      editingField: wordEditor.editingField!,
      editingWrongIndex: wordEditor.editingWrongIndex,
      editMode: wordEditor.editMode,
      oldValue: wordEditor.oldValue,
      generatedValue: wordEditor.generatedValue,
      manualValue: wordEditor.manualValue,
      currentPrompt: wordEditor.currentPrompt,
      userFeedback: wordEditor.userFeedback,
      isGenerating: wordEditor.isGenerating,
      isRegenerating: wordEditor.isRegenerating,
      showRegenerateModal: wordEditor.showRegenerateModal,
      pendingManualWord: wordEditor.pendingManualWord,
      onGenerate: handleGenerate,
      onGoToManual: wordEditor.goToManual,
      onManualValueChange: wordEditor.setManualValue,
      onUserFeedbackChange: wordEditor.setUserFeedback,
      onAcceptGenerated: handleAcceptGenerated,
      onRegenerate: handleRegenerate,
      onSaveManual: handleSaveManual,
      onRegenerateConfirm: handleRegenerateConfirm,
      onRegenerateSkip: handleRegenerateSkip,
      onRegenerateCancel: wordEditor.hideRegenerateConfirm,
      onBack: goBack,
    },

    // Delete confirm props
    deleteConfirmProps: {
      isOpen: deleteConfirm !== null,
      itemName: deleteConfirm?.themeName || deleteConfirm?.wordName || "",
      itemType: (deleteConfirm?.type || "word") as "theme" | "word",
      onConfirm: deleteConfirm?.type === "theme" ? confirmDeleteTheme : confirmDeleteWord,
      onCancel: () => setDeleteConfirm(null),
    },

    // Word editor state for conditional rendering
    wordEditorState: wordEditor,
  };
}

