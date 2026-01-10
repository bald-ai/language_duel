"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { WordEntry } from "@/lib/types";
import type { ThemeWithOwner } from "@/convex/themes";
import {
  checkThemeForDuplicateWrongAnswers,
  checkThemeForDuplicateWords,
  isWordDuplicate,
  checkThemeForWrongMatchingAnswer,
} from "@/lib/themes";
import { buildFieldSummary } from "@/lib/generate/prompts";
import { LLM_THEME_CREDITS } from "@/lib/credits/constants";
import { VIEW_MODES, FIELD_TYPES, type ViewMode, type FieldType } from "../constants";
import {
  useThemeGenerator,
  useAddWord,
  useGenerateRandom,
  useWordEditor,
  useThemeActions,
} from "./index";
import { toast } from "sonner";

interface DeleteConfirmState {
  type: "theme" | "word";
  themeId?: Id<"themes">;
  themeName?: string;
  wordIndex?: number;
  wordName?: string;
}

export function useThemesController() {
  const router = useRouter();

  // Friend filter state
  const [selectedFriendFilter, setSelectedFriendFilter] = useState<Id<"users"> | null>(null);
  const [myThemesOnly, setMyThemesOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [isUpdatingVisibility, setIsUpdatingVisibility] = useState(false);
  const [isUpdatingFriendsCanEdit, setIsUpdatingFriendsCanEdit] = useState(false);

  // Convex queries - build query args based on filter state
  const queryArgs = useMemo(() => {
    if (showArchived) return { archivedOnly: true };
    if (myThemesOnly) return { myThemesOnly: true };
    if (selectedFriendFilter) return { filterByFriendId: selectedFriendFilter };
    return {};
  }, [myThemesOnly, selectedFriendFilter, showArchived]);

  const rawThemesQuery = useQuery(api.themes.getThemes, queryArgs);
  const friends = useQuery(api.friends.getFriends);
  const currentUser = useQuery(api.users.getCurrentUser);

  // Mutations
  const updateVisibilityMutation = useMutation(api.themes.updateThemeVisibility);
  const updateFriendsCanEditMutation = useMutation(api.themes.updateThemeFriendsCanEdit);
  const toggleArchiveMutation = useMutation(api.themes.toggleThemeArchive);

  // Custom hooks
  const themeGenerator = useThemeGenerator();
  const addWordHook = useAddWord();
  const generateRandomHook = useGenerateRandom();
  const wordEditor = useWordEditor();
  const themeActions = useThemeActions();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>(VIEW_MODES.LIST);
  const [selectedTheme, setSelectedTheme] = useState<ThemeWithOwner | null>(null);
  const [localWords, setLocalWords] = useState<WordEntry[]>([]);
  // Track pending (unsaved) theme data - only set for newly generated themes
  const [pendingThemeData, setPendingThemeData] = useState<{
    themeName: string;
    description: string;
    wordType: "nouns" | "verbs";
  } | null>(null);

  // Modal state
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [showGenerateRandomModal, setShowGenerateRandomModal] = useState(false);
  const [showFriendFilterModal, setShowFriendFilterModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);

  const rawThemes = useMemo(() => rawThemesQuery || [], [rawThemesQuery]);

  const themes = rawThemes;

  // Get selected friend details for display
  const selectedFriend = useMemo(() => {
    if (!selectedFriendFilter || !friends) return null;
    return friends.find((f) => f.friendId === selectedFriendFilter) || null;
  }, [selectedFriendFilter, friends]);

  // Visibility change handler
  const handleVisibilityChange = useCallback(
    async (visibility: "private" | "shared") => {
      if (!selectedTheme || selectedTheme.isOwner === false) return;

      setIsUpdatingVisibility(true);
      try {
        await updateVisibilityMutation({
          themeId: selectedTheme._id,
          visibility,
        });
        setSelectedTheme((prev) => (prev ? { ...prev, visibility } : null));
        toast.success(`Theme is now ${visibility}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update visibility";
        toast.error(message);
      } finally {
        setIsUpdatingVisibility(false);
      }
    },
    [selectedTheme, updateVisibilityMutation]
  );

  // Friends can edit change handler
  const handleFriendsCanEditChange = useCallback(
    async (friendsCanEdit: boolean) => {
      if (!selectedTheme || selectedTheme.isOwner === false) return;

      setIsUpdatingFriendsCanEdit(true);
      try {
        await updateFriendsCanEditMutation({
          themeId: selectedTheme._id,
          friendsCanEdit,
        });
        setSelectedTheme((prev) => (prev ? { ...prev, friendsCanEdit } : null));
        toast.success(friendsCanEdit ? "Friends can now edit this theme" : "Theme is now view-only for friends");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update edit permissions";
        toast.error(message);
      } finally {
        setIsUpdatingFriendsCanEdit(false);
      }
    },
    [selectedTheme, updateFriendsCanEditMutation]
  );

  // Friend filter handlers
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

  // Archive actions
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

  const openTheme = useCallback((theme: ThemeWithOwner) => {
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
      toast.error(result.error || "Failed to delete theme");
    }
    setDeleteConfirm(null);
  }, [deleteConfirm, themeActions]);

  const handleDuplicateTheme = useCallback(
    async (themeId: Id<"themes">) => {
      const result = await themeActions.duplicate(themeId);
      if (!result.ok) {
        toast.error(result.error || "Failed to duplicate theme");
      }
    },
    [themeActions]
  );

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
    setShowGenerateModal(true);
  }, [currentUser, themeGenerator]);

  const handleGenerateNewTheme = useCallback(async () => {
    try {
      const words = await themeGenerator.generate();
      if (!words) return;

      // Store pending theme data without persisting to database
      // Theme will only be saved when user explicitly clicks Save
      const pendingData = {
        themeName: themeGenerator.themeName,
        description: `Generated theme for: ${themeGenerator.themeName}`,
        wordType: themeGenerator.wordType,
      };
      setPendingThemeData(pendingData);

      // Build temporary theme object for local editing
      // Using empty string as _id to mark this as unsaved
      const newTheme: ThemeWithOwner = {
        _id: "" as Id<"themes">,
        _creationTime: Date.now(),
        name: themeGenerator.themeName.toUpperCase(),
        description: pendingData.description,
        words,
        wordType: themeGenerator.wordType,
        createdAt: Date.now(),
        visibility: "private",
        isOwner: true,
        canEdit: true,
      };

      // Open for review but don't persist yet
      setSelectedTheme(newTheme);
      setLocalWords([...words]);
      setViewMode(VIEW_MODES.DETAIL);
      setShowGenerateModal(false);
      themeGenerator.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Generation failed";
      toast.error(message);
      themeGenerator.setError(null);
    }
  }, [themeGenerator]);

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
      if (selectedTheme && selectedTheme.canEdit === false) return;

      const word = localWords[index];
      setDeleteConfirm({ type: "word", wordIndex: index, wordName: word.word });
    },
    [selectedTheme, localWords]
  );

  const confirmDeleteWord = useCallback(() => {
    if (deleteConfirm?.wordIndex === undefined) return;
    setLocalWords((prev) => prev.filter((_, idx) => idx !== deleteConfirm.wordIndex));
    setDeleteConfirm(null);
  }, [deleteConfirm]);

  const handleEditWord = useCallback(
    (wordIndex: number, field: FieldType, wrongIndex?: number) => {
      // Only allow editing if user has edit permission
      if (selectedTheme && selectedTheme.canEdit === false) return;

      const word = localWords[wordIndex];
      let value = "";
      if (field === FIELD_TYPES.WORD) value = word.word;
      else if (field === FIELD_TYPES.ANSWER) value = word.answer;
      else value = word.wrongAnswers[wrongIndex ?? 0];

      wordEditor.startEdit(wordIndex, field, value, wrongIndex);
      setViewMode(VIEW_MODES.EDIT_WORD);
    },
    [localWords, selectedTheme, wordEditor]
  );

  const handleSaveTheme = useCallback(async () => {
    if (!selectedTheme || selectedTheme.canEdit === false) return;

    if (checkThemeForDuplicateWords(localWords)) {
      toast.error(
        "Cannot save: This theme has duplicate words. Please fix the duplicate words (marked with red !) before saving."
      );
      return;
    }

    if (checkThemeForDuplicateWrongAnswers(localWords)) {
      toast.error(
        "Cannot save: This theme has duplicate wrong answers. Please fix the duplicate wrong answers (marked with orange ⚠) before saving."
      );
      return;
    }

    if (checkThemeForWrongMatchingAnswer(localWords)) {
      toast.error(
        "Cannot save: One or more wrong answers match the correct answer. Please ensure all choices are unique (marked with orange ⚠)."
      );
      return;
    }

    // Check if this is a pending (unsaved) theme
    const isPendingTheme = pendingThemeData !== null && selectedTheme._id === "";

    if (isPendingTheme) {
      // Create new theme in database
      const result = await themeActions.create(
        selectedTheme.name,
        pendingThemeData.description,
        localWords,
        pendingThemeData.wordType
      );
      if (result.ok) {
        setPendingThemeData(null);
        setViewMode(VIEW_MODES.LIST);
        setSelectedTheme(null);
        setLocalWords([]);
        toast.success("Theme created successfully");
      } else {
        toast.error(result.error || "Failed to create theme");
      }
    } else {
      // Update existing theme
      const result = await themeActions.update(selectedTheme._id, selectedTheme.name, localWords);
      if (result.ok) {
        setViewMode(VIEW_MODES.LIST);
        setSelectedTheme(null);
        setLocalWords([]);
      } else {
        toast.error(result.error || "Failed to save theme");
      }
    }
  }, [selectedTheme, localWords, themeActions, pendingThemeData]);

  const handleCancelTheme = useCallback(() => {
    // For pending themes, simply discard local state - nothing was persisted
    // For existing themes, just navigate back without any database changes
    setPendingThemeData(null);
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
      toast.error(error instanceof Error ? error.message : "Generation failed");
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
      toast.error(error instanceof Error ? error.message : "Regeneration failed");
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
      toast.error(error instanceof Error ? error.message : "Regeneration failed");
    }
  }, [wordEditor, selectedTheme]);

  const listProps = useMemo(
    () => ({
      themes,
      deletingThemeId: themeActions.deletingThemeId,
      duplicatingThemeId: themeActions.duplicatingThemeId,
      onOpenTheme: openTheme,
      onDeleteTheme: handleDeleteTheme,
      onDuplicateTheme: handleDuplicateTheme,
      onGenerateNew: handleOpenGenerateModal,
      onBack: goBack,
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
      themeActions.deletingThemeId,
      themeActions.duplicatingThemeId,
      openTheme,
      handleDeleteTheme,
      handleDuplicateTheme,
      handleOpenGenerateModal,
      goBack,
      selectedFriend,
      myThemesOnly,
      handleClearFriendFilter,
      showArchived,
      handleToggleArchive,
    ]
  );

  const detailProps = useMemo(
    () => ({
      theme: selectedTheme!,
      localWords,
      onThemeNameChange: handleThemeNameChange,
      onDeleteWord: handleDeleteWord,
      onEditWord: handleEditWord,
      onSave: handleSaveTheme,
      onCancel: handleCancelTheme,
      onToggleArchive: handleToggleArchive,
      isArchived: showArchived,
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
      visibility: selectedTheme?.visibility || "private",
      isUpdatingVisibility,
      onVisibilityChange: handleVisibilityChange,
      friendsCanEdit: selectedTheme?.friendsCanEdit || false,
      isUpdatingFriendsCanEdit,
      onFriendsCanEditChange: handleFriendsCanEditChange,
    }),
    [
      selectedTheme,
      localWords,
      handleThemeNameChange,
      handleDeleteWord,
      handleEditWord,
      handleSaveTheme,
      handleCancelTheme,
      handleToggleArchive,
      showArchived,
      showAddWordModal,
      setShowAddWordModal,
      addWordHook.newWordInput,
      addWordHook.isAdding,
      addWordHook.error,
      addWordHook.setNewWordInput,
      handleAddWord,
      addWordHook.reset,
      showGenerateRandomModal,
      setShowGenerateRandomModal,
      generateRandomHook.count,
      generateRandomHook.isGenerating,
      generateRandomHook.error,
      generateRandomHook.setCount,
      handleGenerateRandom,
      generateRandomHook.reset,
      isUpdatingVisibility,
      handleVisibilityChange,
      isUpdatingFriendsCanEdit,
      handleFriendsCanEditChange,
    ]
  );

  const wordEditorPromptSummary = useMemo(() => {
    if (wordEditor.editingField && selectedTheme && wordEditor.editingWordIndex !== null) {
      return buildFieldSummary(
        wordEditor.editingField,
        selectedTheme.name,
        localWords[wordEditor.editingWordIndex]?.word || "",
        selectedTheme.wordType || "nouns",
        wordEditor.editingWrongIndex
      );
    }

    return "";
  }, [
    wordEditor.editingField,
    wordEditor.editingWordIndex,
    wordEditor.editingWrongIndex,
    selectedTheme,
    localWords,
  ]);

  const wordEditorProps = useMemo(
    () => ({
      editingField: wordEditor.editingField!,
      editingWrongIndex: wordEditor.editingWrongIndex,
      editMode: wordEditor.editMode,
      oldValue: wordEditor.oldValue,
      generatedValue: wordEditor.generatedValue,
      manualValue: wordEditor.manualValue,
      currentPrompt: wordEditor.currentPrompt,
      userFeedback: wordEditor.userFeedback,
      promptSummary: wordEditorPromptSummary,
      customInstructions: wordEditor.customInstructions,
      isGenerating: wordEditor.isGenerating,
      isRegenerating: wordEditor.isRegenerating,
      showRegenerateModal: wordEditor.showRegenerateModal,
      pendingManualWord: wordEditor.pendingManualWord,
      onGenerate: handleGenerate,
      onGoToManual: wordEditor.goToManual,
      onManualValueChange: wordEditor.setManualValue,
      onUserFeedbackChange: wordEditor.setUserFeedback,
      onCustomInstructionsChange: wordEditor.setCustomInstructions,
      onAcceptGenerated: handleAcceptGenerated,
      onRegenerate: handleRegenerate,
      onSaveManual: handleSaveManual,
      onRegenerateConfirm: handleRegenerateConfirm,
      onRegenerateSkip: handleRegenerateSkip,
      onRegenerateCancel: wordEditor.hideRegenerateConfirm,
      onBack: goBack,
    }),
    [
      wordEditor.editingField,
      wordEditor.editingWrongIndex,
      wordEditor.editMode,
      wordEditor.oldValue,
      wordEditor.generatedValue,
      wordEditor.manualValue,
      wordEditor.currentPrompt,
      wordEditor.userFeedback,
      wordEditorPromptSummary,
      wordEditor.customInstructions,
      wordEditor.isGenerating,
      wordEditor.isRegenerating,
      wordEditor.showRegenerateModal,
      wordEditor.pendingManualWord,
      handleGenerate,
      wordEditor.goToManual,
      wordEditor.setManualValue,
      wordEditor.setUserFeedback,
      wordEditor.setCustomInstructions,
      handleAcceptGenerated,
      handleRegenerate,
      handleSaveManual,
      handleRegenerateConfirm,
      handleRegenerateSkip,
      wordEditor.hideRegenerateConfirm,
      goBack,
    ]
  );

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
    listProps,

    // Friend filter modal props
    friendFilterModalProps: {
      isOpen: showFriendFilterModal,
      friends: friends ?? [],
      onSelectFriend: handleSetFriendFilter,
      onShowAll: handleClearFriendFilter,
      onShowMyThemes: handleShowMyThemes,
      onClose: () => setShowFriendFilterModal(false),
    },

    // Generate modal props
    generateModalProps: {
      isOpen: showGenerateModal,
      themeName: themeGenerator.themeName,
      themePrompt: themeGenerator.themePrompt,
      wordType: themeGenerator.wordType,
      isGenerating: themeGenerator.isGenerating,
      onThemeNameChange: themeGenerator.setThemeName,
      onThemePromptChange: themeGenerator.setThemePrompt,
      onWordTypeChange: themeGenerator.setWordType,
      onGenerate: handleGenerateNewTheme,
      onClose: handleCloseGenerateModal,
    },

    // Theme detail props
    detailProps,

    // Word editor props
    wordEditorProps,

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


