import type { WordEntry } from "@/lib/types";
import { getResponseErrorMessage } from "@/lib/api/errors";

export type WordType = "nouns" | "verbs";
export type FieldType = "word" | "answer" | "wrong";

export interface GenerateThemeParams {
  themeName: string;
  themePrompt?: string;
  wordType: WordType;
}

export interface GenerateThemeResult {
  success: boolean;
  data?: WordEntry[];
  error?: string;
}

/**
 * Generate a new theme with words via AI.
 */
export async function generateTheme(params: GenerateThemeParams): Promise<GenerateThemeResult> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "theme",
      themeName: params.themeName,
      themePrompt: params.themePrompt || undefined,
      wordType: params.wordType,
    }),
  });

  if (!response.ok) {
    const errorMsg = await getResponseErrorMessage(response);
    return { success: false, error: errorMsg };
  }

  const data = await response.json();
  if (!data.success) {
    return { success: false, error: data.error || "Generation failed" };
  }

  return { success: true, data: data.data };
}

export interface GenerateFieldParams {
  fieldType: FieldType;
  themeName: string;
  wordType: WordType;
  currentWord: string;
  currentAnswer: string;
  currentWrongAnswers: string[];
  fieldIndex?: number;
  existingWords?: string[];
  rejectedWords?: string[];
  history?: { role: "user" | "assistant"; content: string }[];
}

export interface GenerateFieldResult {
  success: boolean;
  prompt?: string;
  data?: {
    word?: string;
    answer?: string;
    wrongAnswer?: string;
    wrongAnswers?: string[];
  };
  error?: string;
}

/**
 * Generate/regenerate a single field (word, answer, or wrong answer).
 */
export async function generateField(params: GenerateFieldParams): Promise<GenerateFieldResult> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "field",
      fieldType: params.fieldType,
      themeName: params.themeName,
      wordType: params.wordType,
      currentWord: params.currentWord,
      currentAnswer: params.currentAnswer,
      currentWrongAnswers: params.currentWrongAnswers,
      fieldIndex: params.fieldIndex,
      existingWords: params.existingWords,
      rejectedWords: params.rejectedWords,
      history: params.history,
    }),
  });

  if (!response.ok) {
    const errorMsg = await getResponseErrorMessage(response);
    return { success: false, error: errorMsg };
  }

  const data = await response.json();
  if (!data.success) {
    return { success: false, error: data.error || "Generation failed" };
  }

  return {
    success: true,
    prompt: data.prompt,
    data: data.data,
  };
}

export interface RegenerateForWordParams {
  themeName: string;
  wordType: WordType;
  newWord: string;
}

export interface RegenerateForWordResult {
  success: boolean;
  data?: {
    answer: string;
    wrongAnswers: string[];
  };
  error?: string;
}

/**
 * Regenerate answer and wrong answers for a manually edited word.
 */
export async function regenerateForWord(params: RegenerateForWordParams): Promise<RegenerateForWordResult> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "regenerate-for-word",
      themeName: params.themeName,
      wordType: params.wordType,
      newWord: params.newWord,
    }),
  });

  if (!response.ok) {
    const errorMsg = await getResponseErrorMessage(response);
    return { success: false, error: errorMsg };
  }

  const data = await response.json();
  if (!data.success) {
    return { success: false, error: data.error || "Regeneration failed" };
  }

  return { success: true, data: data.data };
}

export interface AddWordParams {
  themeName: string;
  wordType: WordType;
  newWord: string;
  existingWords: string[];
}

export interface AddWordResult {
  success: boolean;
  data?: WordEntry;
  error?: string;
}

/**
 * Add a new word to a theme (generates answer and wrong answers).
 */
export async function addWord(params: AddWordParams): Promise<AddWordResult> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "add-word",
      themeName: params.themeName,
      wordType: params.wordType,
      newWord: params.newWord,
      existingWords: params.existingWords,
    }),
  });

  if (!response.ok) {
    const errorMsg = await getResponseErrorMessage(response);
    return { success: false, error: errorMsg };
  }

  const data = await response.json();
  if (!data.success) {
    return { success: false, error: data.error || "Failed to generate word" };
  }

  return { success: true, data: data.data };
}

export interface GenerateRandomWordsParams {
  themeName: string;
  wordType: WordType;
  count: number;
  existingWords: string[];
}

export interface GenerateRandomWordsResult {
  success: boolean;
  data?: WordEntry[];
  error?: string;
}

/**
 * Generate random words for a theme.
 */
export async function generateRandomWords(params: GenerateRandomWordsParams): Promise<GenerateRandomWordsResult> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "generate-random-words",
      themeName: params.themeName,
      wordType: params.wordType,
      count: params.count,
      existingWords: params.existingWords,
    }),
  });

  if (!response.ok) {
    const errorMsg = await getResponseErrorMessage(response);
    return { success: false, error: errorMsg };
  }

  const data = await response.json();
  if (!data.success) {
    return { success: false, error: data.error || "Failed to generate words" };
  }

  return { success: true, data: data.data };
}
