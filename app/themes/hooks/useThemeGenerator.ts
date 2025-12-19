import { useState, useCallback } from "react";
import { generateTheme, addWord, generateRandomWords, type WordType } from "@/lib/themes";
import type { WordEntry } from "@/lib/types";
import { DEFAULT_RANDOM_WORD_COUNT } from "../constants";

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
    wordType: "nouns",
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
      wordType: "nouns",
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
      });

      if (!result.success || !result.data) {
        const message = result.error || "Generation failed";
        setState((prev) => ({
          ...prev,
          isGenerating: false,
          error: message,
        }));
        throw new Error(message);
      }

      setState((prev) => ({ ...prev, isGenerating: false }));
      return result.data;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      setState((prev) => ({ ...prev, isGenerating: false, error: errorMsg }));
      throw new Error(errorMsg);
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

interface GenerateRandomState {
  isGenerating: boolean;
  error: string | null;
  count: number;
}

export function useGenerateRandom() {
  const [state, setState] = useState<GenerateRandomState>({
    isGenerating: false,
    error: null,
    count: DEFAULT_RANDOM_WORD_COUNT,
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
      error: null,
      count: DEFAULT_RANDOM_WORD_COUNT,
    });
  }, []);

  const generate = useCallback(
    async (
      themeName: string,
      wordType: WordType,
      existingWords: string[]
    ): Promise<WordEntry[] | null> => {
      setState((prev) => ({ ...prev, isGenerating: true, error: null }));

      try {
        const result = await generateRandomWords({
          themeName,
          wordType,
          count: state.count,
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
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        setState((prev) => ({ ...prev, isGenerating: false, error: errorMsg }));
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
