import { useState, useCallback } from "react";
import { addWord, type WordType } from "@/lib/themes/api";
import type { WordEntry } from "@/lib/types";

interface AddWordState {
  isAdding: boolean;
  error: string | null;
  newWordInput: string;
}

export function useAddWord() {
  const [state, setState] = useState<AddWordState>({
    isAdding: false,
    error: null,
    newWordInput: "",
  });

  const setNewWordInput = useCallback((input: string) => {
    setState((prev) => ({ ...prev, newWordInput: input, error: null }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isAdding: false,
      error: null,
      newWordInput: "",
    });
  }, []);

  const add = useCallback(
    async (
      themeName: string,
      wordType: WordType,
      existingWords: string[]
    ): Promise<WordEntry | null> => {
      const trimmedWord = state.newWordInput.trim();
      if (!trimmedWord) return null;

      setState((prev) => ({ ...prev, isAdding: true, error: null }));

      try {
        const result = await addWord({
          themeName,
          wordType,
          newWord: trimmedWord,
          existingWords,
        });

        if (!result.success || !result.data) {
          setState((prev) => ({
            ...prev,
            isAdding: false,
            error: result.error || "Failed to add word",
          }));
          return null;
        }

        setState((prev) => ({ ...prev, isAdding: false }));
        return result.data;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({ ...prev, isAdding: false, error: errorMsg }));
        return null;
      }
    },
    [state.newWordInput]
  );

  return {
    ...state,
    setNewWordInput,
    setError,
    reset,
    add,
  };
}
