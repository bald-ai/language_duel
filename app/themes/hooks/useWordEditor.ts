import { useState, useCallback } from "react";
import { generateField, regenerateForWord, type WordType, type FieldType } from "@/lib/themes";
import type { WordEntry } from "@/lib/types";
import { EDIT_MODES, type EditMode } from "../constants";

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

interface WordEditorState {
  editingWordIndex: number | null;
  editingField: FieldType | null;
  editingWrongIndex: number;
  editMode: EditMode;
  manualValue: string;
  generatedValue: string;
  generatedWordData: WordEntry | null;
  oldValue: string;
  conversationHistory: ConversationMessage[];
  currentPrompt: string;
  userFeedback: string;
  rejectedWords: string[];
  isGenerating: boolean;
  isRegenerating: boolean;
  showRegenerateModal: boolean;
  pendingManualWord: string;
}

const initialState: WordEditorState = {
  editingWordIndex: null,
  editingField: null,
  editingWrongIndex: 0,
  editMode: EDIT_MODES.CHOICE,
  manualValue: "",
  generatedValue: "",
  generatedWordData: null,
  oldValue: "",
  conversationHistory: [],
  currentPrompt: "Prompt will be generated...",
  userFeedback: "",
  rejectedWords: [],
  isGenerating: false,
  isRegenerating: false,
  showRegenerateModal: false,
  pendingManualWord: "",
};

export function useWordEditor() {
  const [state, setState] = useState<WordEditorState>(initialState);

  const startEdit = useCallback(
    (
      wordIndex: number,
      field: FieldType,
      currentValue: string,
      wrongIndex?: number
    ) => {
      setState({
        ...initialState,
        editingWordIndex: wordIndex,
        editingField: field,
        editingWrongIndex: wrongIndex ?? 0,
        oldValue: currentValue,
        // For answer field, go directly to manual edit mode
        editMode: field === "answer" ? EDIT_MODES.MANUAL : EDIT_MODES.CHOICE,
        manualValue: field === "answer" ? currentValue : "",
      });
    },
    []
  );

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const setEditMode = useCallback((mode: EditMode) => {
    setState((prev) => ({ ...prev, editMode: mode }));
  }, []);

  const setManualValue = useCallback((value: string) => {
    setState((prev) => ({ ...prev, manualValue: value }));
  }, []);

  const setUserFeedback = useCallback((feedback: string) => {
    setState((prev) => ({ ...prev, userFeedback: feedback }));
  }, []);

  const goToManual = useCallback(() => {
    setState((prev) => ({
      ...prev,
      manualValue: prev.oldValue,
      editMode: EDIT_MODES.MANUAL,
    }));
  }, []);

  const showRegenerateConfirm = useCallback((pendingWord: string) => {
    setState((prev) => ({
      ...prev,
      showRegenerateModal: true,
      pendingManualWord: pendingWord,
    }));
  }, []);

  const hideRegenerateConfirm = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showRegenerateModal: false,
      pendingManualWord: "",
    }));
  }, []);

  const generate = useCallback(
    async (
      themeName: string,
      wordType: WordType,
      word: WordEntry,
      existingWords: string[],
      overrideRejectedWords?: string[]
    ): Promise<boolean> => {
      if (state.editingWordIndex === null || !state.editingField) return false;

      setState((prev) => ({ ...prev, isGenerating: true }));

      const currentRejectedWords = overrideRejectedWords ?? state.rejectedWords;

      try {
        const result = await generateField({
          fieldType: state.editingField,
          themeName,
          wordType,
          currentWord: word.word,
          currentAnswer: word.answer,
          currentWrongAnswers: word.wrongAnswers,
          fieldIndex: state.editingWrongIndex,
          existingWords: state.editingField === "word" ? existingWords : undefined,
          rejectedWords: state.editingField === "word" ? currentRejectedWords : undefined,
          history: state.conversationHistory,
        });

        if (!result.success || !result.data) {
          setState((prev) => ({ ...prev, isGenerating: false }));
          throw new Error(result.error || "Generation failed");
        }

        let newValue = "";
        let wordData: WordEntry | null = null;

        if (state.editingField === "word" && result.data.word) {
          newValue = result.data.word;
          wordData = {
            word: result.data.word,
            answer: result.data.answer || word.answer,
            wrongAnswers: result.data.wrongAnswers || word.wrongAnswers,
          };
        } else if (state.editingField === "answer" && result.data.answer) {
          newValue = result.data.answer;
        } else if (result.data.wrongAnswer) {
          newValue = result.data.wrongAnswer;
        }

        setState((prev) => ({
          ...prev,
          isGenerating: false,
          generatedValue: newValue,
          generatedWordData: wordData,
          currentPrompt: result.prompt || prev.currentPrompt,
          editMode: EDIT_MODES.GENERATE,
          conversationHistory: [
            ...prev.conversationHistory,
            { role: "assistant" as const, content: `Generated: ${newValue}` },
          ],
        }));

        return true;
      } catch (error) {
        setState((prev) => ({ ...prev, isGenerating: false }));
        throw error;
      }
    },
    [state.editingWordIndex, state.editingField, state.editingWrongIndex, state.conversationHistory, state.rejectedWords]
  );

  const regenerate = useCallback(
    async (
      themeName: string,
      wordType: WordType,
      word: WordEntry,
      existingWords: string[]
    ): Promise<boolean> => {
      let updatedRejectedWords = state.rejectedWords;

      // For word regeneration, track the rejected word
      if (state.editingField === "word" && state.generatedValue) {
        updatedRejectedWords = [...state.rejectedWords, state.generatedValue];
        setState((prev) => ({ ...prev, rejectedWords: updatedRejectedWords }));
      }

      // Add user feedback to history (for non-word fields)
      if (state.editingField !== "word") {
        const feedback = state.userFeedback.trim() || "Please generate a different option";
        setState((prev) => ({
          ...prev,
          conversationHistory: [
            ...prev.conversationHistory,
            { role: "user" as const, content: feedback },
          ],
          userFeedback: "",
        }));
      }

      return generate(themeName, wordType, word, existingWords, updatedRejectedWords);
    },
    [state.editingField, state.generatedValue, state.rejectedWords, state.userFeedback, generate]
  );

  const regenerateAnswersForWord = useCallback(
    async (
      themeName: string,
      wordType: WordType
    ): Promise<{ answer: string; wrongAnswers: string[] } | null> => {
      setState((prev) => ({ ...prev, isRegenerating: true }));

      try {
        const result = await regenerateForWord({
          themeName,
          wordType,
          newWord: state.pendingManualWord,
        });

        setState((prev) => ({ ...prev, isRegenerating: false }));

        if (!result.success || !result.data) {
          throw new Error(result.error || "Regeneration failed");
        }

        return result.data;
      } catch (error) {
        setState((prev) => ({ ...prev, isRegenerating: false }));
        throw error;
      }
    },
    [state.pendingManualWord]
  );

  return {
    ...state,
    startEdit,
    reset,
    setEditMode,
    setManualValue,
    setUserFeedback,
    goToManual,
    showRegenerateConfirm,
    hideRegenerateConfirm,
    generate,
    regenerate,
    regenerateAnswersForWord,
  };
}

