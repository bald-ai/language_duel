import { useState, useCallback } from "react";
import { generateTheme, type WordType } from "@/lib/themes/api";
import type { WordEntry } from "@/lib/types";
import { normalizePlainErrorMessage } from "@/lib/userFacingErrors";
import {
  PICK_AND_PRUNE_WORD_COUNT,
  DEFAULT_WORD_TYPE,
} from "../constants";

interface ThemeGeneratorState {
  isGenerating: boolean;
  error: string | null;
  themeName: string;
  themePrompt: string;
  wordType: WordType;
}

export function useThemeGenerator() {
  const [state, setState] = useState<ThemeGeneratorState>({
    isGenerating: false,
    error: null,
    themeName: "",
    themePrompt: "",
    wordType: DEFAULT_WORD_TYPE,
  });

  const setThemeName = useCallback((name: string) => {
    setState((prev) => ({ ...prev, themeName: name }));
  }, []);

  const setThemePrompt = useCallback((prompt: string) => {
    setState((prev) => ({ ...prev, themePrompt: prompt }));
  }, []);

  const setWordType = useCallback((wordType: WordType) => {
    setState((prev) => ({ ...prev, wordType }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const reset = useCallback(() => {
    setState({
      isGenerating: false,
      error: null,
      themeName: "",
      themePrompt: "",
      wordType: DEFAULT_WORD_TYPE,
    });
  }, []);

  const generate = useCallback(async (): Promise<WordEntry[] | null> => {
    if (!state.themeName.trim()) return null;

    setState((prev) => ({ ...prev, isGenerating: true, error: null }));

    try {
      const result = await generateTheme({
        themeName: state.themeName,
        themePrompt: state.themePrompt.trim() || undefined,
        wordType: state.wordType,
        wordCount: PICK_AND_PRUNE_WORD_COUNT,
      });

      if (!result.success || !result.data) {
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          error: result.error || "Generation failed",
        }));
        return null;
      }

      setState((prev) => ({ ...prev, isGenerating: false }));
      return result.data;
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? normalizePlainErrorMessage(error.message, "Generation failed")
          : "Generation failed. Please try again.";
      setState((prev) => ({ ...prev, isGenerating: false, error: errorMsg }));
      return null;
    }
  }, [state.themeName, state.themePrompt, state.wordType]);

  return {
    ...state,
    setThemeName,
    setThemePrompt,
    setWordType,
    setError,
    reset,
    generate,
  };
}
