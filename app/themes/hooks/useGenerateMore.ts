import { useCallback, useState } from "react";
import { generateMoreWords, type WordType } from "@/lib/themes/api";
import type { WordEntry } from "@/lib/types";
import { normalizePlainErrorMessage } from "@/lib/userFacingErrors";
import { DEFAULT_GENERATE_MORE_WORD_COUNT } from "../constants";

interface GenerateMoreState {
  isGenerating: boolean;
  pickAndPrune: boolean;
  error: string | null;
  count: number;
}

export function useGenerateMore() {
  const [state, setState] = useState<GenerateMoreState>({
    isGenerating: false,
    pickAndPrune: false,
    error: null,
    count: DEFAULT_GENERATE_MORE_WORD_COUNT,
  });

  const setCount = useCallback((count: number) => {
    setState((prev) => ({ ...prev, count }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      pickAndPrune: false,
      error: null,
      count: DEFAULT_GENERATE_MORE_WORD_COUNT,
    });
  }, []);

  const generate = useCallback(
    async (
      themeName: string,
      wordType: WordType,
      existingWords: string[],
      options: { countOverride?: number; pickAndPrune?: boolean } = {}
    ): Promise<WordEntry[] | null> => {
      setState((prev) => ({
        ...prev,
        isGenerating: true,
        pickAndPrune: options.pickAndPrune ?? false,
        error: null,
      }));

      try {
        const result = await generateMoreWords({
          themeName,
          wordType,
          count: options.countOverride ?? state.count,
          existingWords,
        });

        if (!result.success || !result.data) {
          setState((prev) => ({
            ...prev,
            isGenerating: false,
            pickAndPrune: false,
            error: result.error || "Failed to generate words",
          }));
          return null;
        }

        setState((prev) => ({ ...prev, isGenerating: false, pickAndPrune: false }));
        return result.data;
      } catch (error) {
        const errorMsg =
          error instanceof Error
            ? normalizePlainErrorMessage(error.message, "Failed to generate words")
            : "Failed to generate words. Please try again.";
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          pickAndPrune: false,
          error: errorMsg,
        }));
        return null;
      }
    },
    [state.count]
  );

  return {
    ...state,
    setCount,
    setError,
    reset,
    generate,
  };
}
