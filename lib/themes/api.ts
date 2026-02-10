import type { WordEntry } from "@/lib/types";
import { getResponseErrorMessage } from "@/lib/api/errors";

export type WordType = "nouns" | "verbs";
export type FieldType = "word" | "answer" | "wrong";

type GenerateApiEnvelope = {
  success: boolean;
  data?: unknown;
  error?: string;
  prompt?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isWordEntry(value: unknown): value is WordEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.word === "string" &&
    typeof value.answer === "string" &&
    isStringArray(value.wrongAnswers)
  );
}

function isWordEntryArray(value: unknown): value is WordEntry[] {
  return Array.isArray(value) && value.every((item) => isWordEntry(item));
}

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
  customInstructions?: string;
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

function isGenerateFieldData(
  value: unknown
): value is NonNullable<GenerateFieldResult["data"]> {
  if (!isRecord(value)) return false;
  if (value.word !== undefined && typeof value.word !== "string") return false;
  if (value.answer !== undefined && typeof value.answer !== "string") return false;
  if (value.wrongAnswer !== undefined && typeof value.wrongAnswer !== "string") return false;
  if (value.wrongAnswers !== undefined && !isStringArray(value.wrongAnswers)) return false;

  return (
    value.word !== undefined ||
    value.answer !== undefined ||
    value.wrongAnswer !== undefined ||
    value.wrongAnswers !== undefined
  );
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

function isAnswerAndWrongsData(
  value: unknown
): value is NonNullable<RegenerateForWordResult["data"]> {
  if (!isRecord(value)) return false;
  return typeof value.answer === "string" && isStringArray(value.wrongAnswers);
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

function parseGenerateApiEnvelope(payload: unknown): GenerateApiEnvelope | null {
  if (!isRecord(payload)) return null;
  if (typeof payload.success !== "boolean") return null;

  const error =
    typeof payload.error === "string"
      ? payload.error
      : payload.error === undefined
        ? undefined
        : String(payload.error);

  const prompt =
    typeof payload.prompt === "string"
      ? payload.prompt
      : payload.prompt === undefined
        ? undefined
        : String(payload.prompt);

  return {
    success: payload.success,
    data: payload.data,
    error,
    prompt,
  };
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

  const payload = parseGenerateApiEnvelope(await response.json());
  if (!payload) {
    return { success: false, error: "Generation failed: invalid response format" };
  }

  if (!payload.success) {
    return { success: false, error: payload.error || "Generation failed" };
  }

  if (!isWordEntryArray(payload.data)) {
    return { success: false, error: "Generation failed: invalid response data" };
  }

  return { success: true, data: payload.data };
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
      customInstructions: params.customInstructions,
    }),
  });

  if (!response.ok) {
    const errorMsg = await getResponseErrorMessage(response);
    return { success: false, error: errorMsg };
  }

  const payload = parseGenerateApiEnvelope(await response.json());
  if (!payload) {
    return { success: false, error: "Generation failed: invalid response format" };
  }

  if (!payload.success) {
    return { success: false, error: payload.error || "Generation failed" };
  }

  if (!isGenerateFieldData(payload.data)) {
    return { success: false, error: "Generation failed: invalid response data" };
  }

  return {
    success: true,
    prompt: payload.prompt,
    data: payload.data,
  };
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

  const payload = parseGenerateApiEnvelope(await response.json());
  if (!payload) {
    return { success: false, error: "Regeneration failed: invalid response format" };
  }

  if (!payload.success) {
    return { success: false, error: payload.error || "Regeneration failed" };
  }

  if (!isAnswerAndWrongsData(payload.data)) {
    return { success: false, error: "Regeneration failed: invalid response data" };
  }

  return { success: true, data: payload.data };
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

  const payload = parseGenerateApiEnvelope(await response.json());
  if (!payload) {
    return { success: false, error: "Failed to generate word: invalid response format" };
  }

  if (!payload.success) {
    return { success: false, error: payload.error || "Failed to generate word" };
  }

  if (!isWordEntry(payload.data)) {
    return { success: false, error: "Failed to generate word: invalid response data" };
  }

  return { success: true, data: payload.data };
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

  const payload = parseGenerateApiEnvelope(await response.json());
  if (!payload) {
    return { success: false, error: "Failed to generate words: invalid response format" };
  }

  if (!payload.success) {
    return { success: false, error: payload.error || "Failed to generate words" };
  }

  if (!isWordEntryArray(payload.data)) {
    return { success: false, error: "Failed to generate words: invalid response data" };
  }

  return { success: true, data: payload.data };
}
