import { useState, useCallback } from "react";
import { generateTheme, type WordType } from "@/lib/themes/api";
import type { WordEntry } from "@/lib/types";
import {
  DEFAULT_GENERATED_WORDS_COUNT,
  DEFAULT_WORD_TYPE,
} from "../constants";

export type GenerationMode = "standard" | "pick-and-prune";

interface ThemeGeneratorState {
  generationMode: GenerationMode | null;
  error: string | null;
  themeName: string;
  themePrompt: string;
  wordType: WordType;
  wordCount: number;
}

export function useThemeGenerator() {
  const [state, setState] = useState<ThemeGeneratorState>({
    generationMode: null,
    error: null,
    themeName: "",
    themePrompt: "",
    wordType: DEFAULT_WORD_TYPE,
    wordCount: DEFAULT_GENERATED_WORDS_COUNT,
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

  const setWordCount = useCallback((wordCount: number) => {
    setState((prev) => ({ ...prev, wordCount }));
  }, []);

  const setError = useCallback((error: string | null) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const reset = useCallback(() => {
    setState({
      generationMode: null,
      error: null,
      themeName: "",
      themePrompt: "",
      wordType: DEFAULT_WORD_TYPE,
      wordCount: DEFAULT_GENERATED_WORDS_COUNT,
    });
  }, []);

  const generate = useCallback(async (options?: {
    wordCountOverride?: number;
    mode?: GenerationMode;
  }): Promise<WordEntry[] | null> => {
    if (!state.themeName.trim()) return null;

    const generationMode = options?.mode ?? "standard";
    const wordCount = options?.wordCountOverride ?? state.wordCount;
    setState((prev) => ({ ...prev, generationMode, error: null }));

    try {
      const result = await generateTheme({
        themeName: state.themeName,
        themePrompt: state.themePrompt.trim() || undefined,
        wordType: state.wordType,
        wordCount,
      });

      if (!result.success || !result.data) {
        setState((prev) => ({
          ...prev,
          generationMode: null,
          error: result.error || "Generation failed",
        }));
        return null;
      }

      setState((prev) => ({ ...prev, generationMode: null }));
      return result.data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setState((prev) => ({ ...prev, generationMode: null, error: errorMsg }));
      return null;
    }
  }, [state.themeName, state.themePrompt, state.wordType, state.wordCount]);

  const isGenerating = state.generationMode !== null;

  return {
    ...state,
    isGenerating,
    setThemeName,
    setThemePrompt,
    setWordType,
    setWordCount,
    setError,
    reset,
    generate,
  };
}
