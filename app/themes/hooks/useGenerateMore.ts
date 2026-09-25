import { useCallback, useState } from "react";
import { generateMoreWords, type WordType } from "@/lib/themes/api";
import type { WordEntry } from "@/lib/types";
import { normalizePlainErrorMessage } from "@/lib/userFacingErrors";
import { GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT } from "../constants";

interface GenerateMoreState {
  isGenerating: boolean;
  error: string | null;
}

export function useGenerateMore() {
  const [state, setState] = useState<GenerateMoreState>({
    isGenerating: false,
    error: null,
  });

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      error: null,
    });
  }, []);

  const generate = useCallback(
    async (
      themeName: string,
      wordType: WordType,
      existingWords: string[]
    ): Promise<WordEntry[] | null> => {
      setState((prev) => ({
        ...prev,
        isGenerating: true,
        error: null,
      }));

      try {
        const result = await generateMoreWords({
          themeName,
          wordType,
          count: GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,
          existingWords,
        });

        if (!result.success || !result.data) {
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            error: result.error || "Failed to generate words",
          }));
          return null;
        }

        setState((prev) => ({ ...prev, isGenerating: false }));
        return result.data;
      } catch (error) {
        const errorMsg =
          error instanceof Error
            ? normalizePlainErrorMessage(error.message, "Failed to generate words")
            : "Failed to generate words. Please try again.";
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          error: errorMsg,
        }));
        return null;
      }
    },
    []
  );

  return {
    ...state,
    setError,
    reset,
    generate,
  };
}
