import { useState, useCallback, useRef } from "react";
import { generateField, regenerateForWord, type WordType, type FieldType, type GenerateFieldParams, type GenerateFieldResult } from "@/lib/themes/api";
import type { WordEntry } from "@/lib/types";
import { EDIT_MODES, type EditMode } from "../constants";
import {
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  THEME_ANSWER_INPUT_MAX_LENGTH,
  THEME_USER_FEEDBACK_MAX_LENGTH,
  THEME_WORD_INPUT_MAX_LENGTH,
  THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
} from "@/lib/themes/constants";

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
  customInstructions: string;
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
  customInstructions: "",
  rejectedWords: [],
  isGenerating: false,
  isRegenerating: false,
  showRegenerateModal: false,
  pendingManualWord: "",
};

function projectGeneratedField(
  result: Extract<GenerateFieldResult, { success: true }>
): { newValue: string; wordData: WordEntry | null } {
  switch (result.fieldType) {
    case "word": return { newValue: result.data.word, wordData: result.data };
    case "answer": return { newValue: result.data.answer, wordData: null };
    case "wrong": return { newValue: result.data.wrongAnswer, wordData: null };
  }
}

interface WordEditorGenerationContext {
  themeName: string;
  wordType: WordType;
  word: WordEntry;
  existingWords: string[];
  overrides?: { rejectedWords?: string[]; history?: ConversationMessage[] };
}

function buildFieldGenerationRequest(
  state: Pick<WordEditorState, "editingWrongIndex" | "rejectedWords" | "conversationHistory" | "customInstructions">,
  field: FieldType,
  { themeName, wordType, word, existingWords, overrides }: WordEditorGenerationContext
): GenerateFieldParams {
  const currentRejectedWords = overrides?.rejectedWords ?? state.rejectedWords;
  return {
    fieldType: field,
    themeName,
    wordType,
    currentWord: word.word,
    currentAnswer: word.answer,
    currentWrongAnswers: word.wrongAnswers,
    fieldIndex: state.editingWrongIndex,
    existingWords: field === "word" ? existingWords : undefined,
    rejectedWords: field === "word" ? currentRejectedWords : undefined,
    history: overrides?.history ?? state.conversationHistory,
    customInstructions: state.customInstructions,
  };
}

function requireGeneratedField(result: GenerateFieldResult): Extract<GenerateFieldResult, { success: true }> {
  if (!result.success) throw new Error(result.error);
  return result;
}

export function useWordEditor() {
  const [state, setState] = useState<WordEditorState>(initialState);
  // A response belongs to the edit that launched it, even if another field opens.
  const editSessionRef = useRef(0);

  const startEdit = useCallback(
    (
      wordIndex: number,
      field: FieldType,
      currentValue: string,
      wrongIndex?: number
    ) => {
      editSessionRef.current += 1;
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
    editSessionRef.current += 1;
    setState(initialState);
  }, []);

  const setManualValue = useCallback((value: string) => {
    setState((prev) => {
      const maxLength =
        prev.editingField === "word"
          ? THEME_WORD_INPUT_MAX_LENGTH
          : prev.editingField === "answer"
            ? THEME_ANSWER_INPUT_MAX_LENGTH
            : THEME_WRONG_ANSWER_INPUT_MAX_LENGTH;

      if (value.length > maxLength) {
        return prev;
      }

      return { ...prev, manualValue: value };
    });
  }, []);

  const setUserFeedback = useCallback((feedback: string) => {
    setState((prev) =>
      feedback.length <= THEME_USER_FEEDBACK_MAX_LENGTH
        ? { ...prev, userFeedback: feedback }
        : prev
    );
  }, []);

  const setCustomInstructions = useCallback((instructions: string) => {
    setState((prev) =>
      instructions.length <= CUSTOM_INSTRUCTIONS_MAX_LENGTH
        ? { ...prev, customInstructions: instructions }
        : prev
    );
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
      overrides?: { rejectedWords?: string[]; history?: ConversationMessage[] }
    ): Promise<boolean> => {
      if (state.editingWordIndex === null || !state.editingField) return false;

      const editSession = editSessionRef.current;
      setState((prev) => ({ ...prev, isGenerating: true }));

      try {
        const result = await generateField(buildFieldGenerationRequest({
          editingWrongIndex: state.editingWrongIndex,
          rejectedWords: state.rejectedWords,
          conversationHistory: state.conversationHistory,
          customInstructions: state.customInstructions,
        }, state.editingField, {
          themeName, wordType, word, existingWords, overrides,
        }));

        if (editSession !== editSessionRef.current) return false;
        const generatedData = requireGeneratedField(result);
        const { newValue, wordData } = projectGeneratedField(generatedData);

        setState((prev) => ({
          ...prev,
          isGenerating: false,
          generatedValue: newValue,
          generatedWordData: wordData,
          currentPrompt: generatedData.prompt || prev.currentPrompt,
          editMode: EDIT_MODES.GENERATE,
          conversationHistory: [
            ...prev.conversationHistory,
            { role: "assistant" as const, content: `Generated: ${newValue}` },
          ],
        }));

        return true;
      } catch (error) {
        if (editSession !== editSessionRef.current) return false;
        setState((prev) => ({ ...prev, isGenerating: false }));
        throw error;
      }
    },
    [state.editingWordIndex, state.editingField, state.editingWrongIndex, state.conversationHistory, state.rejectedWords, state.customInstructions]
  );

  const regenerate = useCallback(
    async (
      themeName: string,
      wordType: WordType,
      word: WordEntry,
      existingWords: string[]
    ): Promise<boolean> => {
      let updatedRejectedWords = state.rejectedWords;
      let updatedHistory = state.conversationHistory;

      // For word regeneration, track the rejected word
      if (state.editingField === "word" && state.generatedValue) {
        updatedRejectedWords = [...state.rejectedWords, state.generatedValue];
        setState((prev) => ({ ...prev, rejectedWords: updatedRejectedWords }));
      }

      // Add user feedback to history (for non-word fields)
      if (state.editingField !== "word") {
        const feedback = state.userFeedback.trim() || "Please generate a different option";
        updatedHistory = [...state.conversationHistory, { role: "user", content: feedback }];
        setState((prev) => ({ ...prev, conversationHistory: updatedHistory, userFeedback: "" }));
      }

      return generate(themeName, wordType, word, existingWords, {
        rejectedWords: updatedRejectedWords,
        history: updatedHistory,
      });
    },
    [state.editingField, state.generatedValue, state.rejectedWords, state.userFeedback, state.conversationHistory, generate]
  );

  const regenerateAnswersForWord = useCallback(
    async (
      themeName: string,
      wordType: WordType
    ): Promise<{ answer: string; wrongAnswers: string[] } | null> => {
      const editSession = editSessionRef.current;
      setState((prev) => ({ ...prev, isRegenerating: true }));

      try {
        const result = await regenerateForWord({
          themeName,
          wordType,
          newWord: state.pendingManualWord,
        });

        if (editSession !== editSessionRef.current) return null;
        setState((prev) => ({ ...prev, isRegenerating: false }));

        if (!result.success || !result.data) {
          throw new Error(result.error || "Regeneration failed");
        }

        return result.data;
      } catch (error) {
        if (editSession !== editSessionRef.current) return null;
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
    setManualValue,
    setUserFeedback,
    setCustomInstructions,
    goToManual,
    showRegenerateConfirm,
    hideRegenerateConfirm,
    generate,
    regenerate,
    regenerateAnswersForWord,
  };
}
