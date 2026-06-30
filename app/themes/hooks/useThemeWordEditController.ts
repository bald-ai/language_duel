import { Dispatch, SetStateAction, useCallback, useMemo } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { getErrorMessage } from "@/lib/errors";
import { buildFieldSummary } from "@/lib/generate/prompts";
import type { WordEntry } from "@/lib/types";
import {
  LLM_FIELD_REGEN_CREDITS,
  LLM_SINGLE_WORD_REGEN_CREDITS,
} from "@/lib/credits/constants";
import { AI_CREDITS_EXHAUSTED_MESSAGE } from "@/lib/userFacingErrors";
import {
  applyGeneratedWordEdit,
  applyManualWordEdit,
  applyRegeneratedManualWord,
  getWordFieldValue,
} from "@/lib/themes/wordEditing";
import { FIELD_TYPES, VIEW_MODES, type FieldType, type ViewMode, type WordType } from "../constants";
import type { ThemeDetailTheme } from "../components/ThemeDetail";
import { useWordEditor } from "./useWordEditor";

type UseThemeWordEditControllerParams = {
  selectedTheme: ThemeDetailTheme | null;
  selectedWordType: WordType;
  localWords: WordEntry[];
  setLocalWords: Dispatch<SetStateAction<WordEntry[]>>;
  setViewMode: Dispatch<SetStateAction<ViewMode>>;
  onBack?: () => void;
};

export function useThemeWordEditController(params: UseThemeWordEditControllerParams) {
  const wordEditor = useWordEditor();
  const currentUser = useQuery(api.users.getCurrentUser);

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

  const handleEditWord = useCallback(
    (wordIndex: number, field: FieldType, wrongIndex?: number) => {
      if (params.selectedTheme && params.selectedTheme.canEdit === false) return;

      const word = params.localWords[wordIndex];
      if (!word) return;

      wordEditor.startEdit(wordIndex, field, getWordFieldValue(word, field, wrongIndex), wrongIndex);
      params.setViewMode(VIEW_MODES.EDIT_WORD);
    },
    [params, wordEditor]
  );

  const handleGenerate = useCallback(async () => {
    if (wordEditor.editingWordIndex === null || !params.selectedTheme) return;
    if (!ensureLlmCredits(LLM_FIELD_REGEN_CREDITS, "Please sign in to regenerate fields.")) return;

    const word = params.localWords[wordEditor.editingWordIndex];
    const existingWords = params.localWords
      .filter((_, idx) => idx !== wordEditor.editingWordIndex)
      .map((entry) => entry.word);

    try {
      await wordEditor.generate(
        params.selectedTheme.name,
        params.selectedWordType,
        word,
        existingWords
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Generation failed"));
    }
  }, [ensureLlmCredits, params, wordEditor]);

  const handleRegenerate = useCallback(async () => {
    if (wordEditor.editingWordIndex === null || !params.selectedTheme) return;
    if (!ensureLlmCredits(LLM_FIELD_REGEN_CREDITS, "Please sign in to regenerate fields.")) return;

    const word = params.localWords[wordEditor.editingWordIndex];
    const existingWords = params.localWords
      .filter((_, idx) => idx !== wordEditor.editingWordIndex)
      .map((entry) => entry.word);

    try {
      await wordEditor.regenerate(
        params.selectedTheme.name,
        params.selectedWordType,
        word,
        existingWords
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Regeneration failed"));
    }
  }, [ensureLlmCredits, params, wordEditor]);

  const handleAcceptGenerated = useCallback(() => {
    const { editingWordIndex, editingField } = wordEditor;
    if (editingWordIndex === null || !editingField) return;

    params.setLocalWords((prev) => {
      const updatedWords = [...prev];
      const previousWord = updatedWords[editingWordIndex];
      if (!previousWord) return prev;

      updatedWords[editingWordIndex] = applyGeneratedWordEdit({
        previousWord,
        field: editingField,
        generatedValue: wordEditor.generatedValue,
        generatedWordData: wordEditor.generatedWordData,
        wrongIndex: wordEditor.editingWrongIndex,
      });
      return updatedWords;
    });

    params.setViewMode(VIEW_MODES.DETAIL);
    wordEditor.reset();
  }, [params, wordEditor]);

  const handleSaveManual = useCallback(() => {
    const { editingWordIndex, editingField } = wordEditor;
    if (editingWordIndex === null || !editingField) return;

    if (
      editingField === FIELD_TYPES.WORD &&
      wordEditor.manualValue.trim() !== wordEditor.oldValue.trim()
    ) {
      wordEditor.showRegenerateConfirm(wordEditor.manualValue);
      return;
    }

    params.setLocalWords((prev) => {
      const updatedWords = [...prev];
      const previousWord = updatedWords[editingWordIndex];
      if (!previousWord) return prev;

      updatedWords[editingWordIndex] = applyManualWordEdit({
        previousWord,
        field: editingField,
        manualValue: wordEditor.manualValue,
        wrongIndex: wordEditor.editingWrongIndex,
      });
      return updatedWords;
    });

    params.setViewMode(VIEW_MODES.DETAIL);
    wordEditor.reset();
  }, [params, wordEditor]);

  const handleRegenerateSkip = useCallback(() => {
    const { editingWordIndex } = wordEditor;
    if (editingWordIndex === null) return;

    params.setLocalWords((prev) => {
      const updatedWords = [...prev];
      const previousWord = updatedWords[editingWordIndex];
      if (!previousWord) return prev;

      updatedWords[editingWordIndex] = applyManualWordEdit({
        previousWord,
        field: FIELD_TYPES.WORD,
        manualValue: wordEditor.pendingManualWord,
        wrongIndex: wordEditor.editingWrongIndex,
      });
      return updatedWords;
    });

    wordEditor.hideRegenerateConfirm();
    params.setViewMode(VIEW_MODES.DETAIL);
    wordEditor.reset();
  }, [params, wordEditor]);

  const handleRegenerateConfirm = useCallback(async () => {
    const { editingWordIndex } = wordEditor;
    if (editingWordIndex === null || !params.selectedTheme) return;
    if (!ensureLlmCredits(LLM_SINGLE_WORD_REGEN_CREDITS, "Please sign in to regenerate words.")) return;

    try {
      const result = await wordEditor.regenerateAnswersForWord(
        params.selectedTheme.name,
        params.selectedWordType
      );

      if (result) {
        params.setLocalWords((prev) => {
          const updatedWords = [...prev];
          const previousWord = updatedWords[editingWordIndex];
          if (!previousWord) return prev;

          updatedWords[editingWordIndex] = applyRegeneratedManualWord({
            previousWord,
            pendingWord: wordEditor.pendingManualWord,
            answer: result.answer,
            wrongAnswers: result.wrongAnswers,
          });
          return updatedWords;
        });

        wordEditor.hideRegenerateConfirm();
        params.setViewMode(VIEW_MODES.DETAIL);
        wordEditor.reset();
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Regeneration failed"));
    }
  }, [ensureLlmCredits, params, wordEditor]);

  const wordEditorPromptSummary = useMemo(() => {
    if (wordEditor.editingField && params.selectedTheme && wordEditor.editingWordIndex !== null) {
      return buildFieldSummary(
        wordEditor.editingField,
        params.selectedTheme.name,
        params.localWords[wordEditor.editingWordIndex]?.word || "",
        params.selectedWordType,
        wordEditor.editingWrongIndex
      );
    }

    return "";
  }, [
    wordEditor.editingField,
    wordEditor.editingWordIndex,
    wordEditor.editingWrongIndex,
    params.selectedTheme,
    params.selectedWordType,
    params.localWords,
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
      onBack: params.onBack ?? (() => undefined),
    }),
    [
      wordEditor,
      wordEditorPromptSummary,
      handleGenerate,
      handleAcceptGenerated,
      handleRegenerate,
      handleSaveManual,
      handleRegenerateConfirm,
      handleRegenerateSkip,
      params.onBack,
    ]
  );

  return {
    wordEditor,
    wordEditorProps,
    handleEditWord,
  };
}
