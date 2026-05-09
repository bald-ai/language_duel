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

function isAnswerAndWrongsData(
  value: unknown
): value is { answer: string; wrongAnswers: string[] } {
  if (!isRecord(value)) return false;
  return typeof value.answer === "string" && isStringArray(value.wrongAnswers);
}

function isGenerateFieldData(
  value: unknown
): value is { word?: string; answer?: string; wrongAnswer?: string; wrongAnswers?: string[] } {
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

type TypeGuard<T> = (value: unknown) => value is T;

async function callGenerateApi<T>(
  body: Record<string, unknown>,
  validate: TypeGuard<T>,
  expectedShape: string,
  errorPrefix: string
): Promise<{ success: true; data: T; prompt?: string } | { success: false; error: string }> {
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorMsg = await getResponseErrorMessage(response);
    return { success: false, error: errorMsg };
  }

  const payload = parseGenerateApiEnvelope(await response.json());
  if (!payload) {
    return { success: false, error: `${errorPrefix}: invalid response format` };
  }

  if (!payload.success) {
    return { success: false, error: payload.error || errorPrefix };
  }

  if (!validate(payload.data)) {
    return { success: false, error: `${errorPrefix}: expected ${expectedShape}` };
  }

  return { success: true, data: payload.data, prompt: payload.prompt };
}

export interface GenerateThemeParams {
  themeName: string;
  themePrompt?: string;
  wordType: WordType;
  wordCount: number;
}

export interface GenerateThemeResult {
  success: boolean;
  data?: WordEntry[];
  error?: string;
}

export async function generateTheme(params: GenerateThemeParams): Promise<GenerateThemeResult> {
  const result = await callGenerateApi(
    {
      type: "theme",
      themeName: params.themeName,
      themePrompt: params.themePrompt || undefined,
      wordCount: params.wordCount,
      wordType: params.wordType,
    },
    isWordEntryArray,
    "WordEntry[]",
    "Generation failed"
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
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

export async function generateField(params: GenerateFieldParams): Promise<GenerateFieldResult> {
  const result = await callGenerateApi(
    {
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
    },
    isGenerateFieldData,
    "word, answer, or wrongAnswers",
    "Generation failed"
  );

  if (!result.success) return { success: false, error: result.error };
  return { success: true, prompt: result.prompt, data: result.data };
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

export async function regenerateForWord(params: RegenerateForWordParams): Promise<RegenerateForWordResult> {
  const result = await callGenerateApi(
    {
      type: "regenerate-for-word",
      themeName: params.themeName,
      wordType: params.wordType,
      newWord: params.newWord,
    },
    isAnswerAndWrongsData,
    "answer and wrongAnswers",
    "Regeneration failed"
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
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

export async function addWord(params: AddWordParams): Promise<AddWordResult> {
  const result = await callGenerateApi(
    {
      type: "add-word",
      themeName: params.themeName,
      wordType: params.wordType,
      newWord: params.newWord,
      existingWords: params.existingWords,
    },
    isWordEntry,
    "WordEntry",
    "Failed to generate word"
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
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

export async function generateRandomWords(params: GenerateRandomWordsParams): Promise<GenerateRandomWordsResult> {
  const result = await callGenerateApi(
    {
      type: "generate-random-words",
      themeName: params.themeName,
      wordType: params.wordType,
      count: params.count,
      existingWords: params.existingWords,
    },
    isWordEntryArray,
    "WordEntry[]",
    "Failed to generate words"
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
}