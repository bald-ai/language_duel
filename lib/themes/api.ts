import type { WordEntry } from "@/lib/types";
import { getResponseErrorMessage } from "@/lib/api/errors";
import { isRecord } from "@/lib/typeGuards";
import type { GenerateRequest } from "@/lib/generate/requestValidation";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";
export type { WordType } from "@/lib/themes/wordTypes";

export type FieldType = "word" | "answer" | "wrong";

type GenerateApiEnvelope = {
  success: boolean;
  data?: unknown;
  error?: string;
  prompt?: string;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isAnswerAndWrongsData(
  value: unknown
): value is { answer: string; wrongAnswers: string[] } {
  if (!isRecord(value)) return false;
  return typeof value.answer === "string" && isStringArray(value.wrongAnswers);
}

// A word entry is an answer-and-wrongs payload that also carries its word.
function isWordEntry(value: unknown): value is WordEntry {
  return isAnswerAndWrongsData(value) && typeof (value as { word?: unknown }).word === "string";
}

function isWordEntryArray(value: unknown): value is WordEntry[] {
  return Array.isArray(value) && value.every((item) => isWordEntry(item));
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

export type GenerateThemeParams = Omit<Extract<GenerateRequest, { type: "theme" }>, "type">;

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

export type GenerateFieldParams = Omit<Extract<GenerateRequest, { type: "field" }>, "type">;

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

export type RegenerateForWordParams = Omit<
  Extract<GenerateRequest, { type: "regenerate-for-word" }>,
  "type"
>;

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

export type AddWordParams = Omit<Extract<GenerateRequest, { type: "add-word" }>, "type">;

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

export type GenerateMoreWordsParams = Omit<
  Extract<GenerateRequest, { type: "generate-more-words" }>,
  "type"
>;

export interface GenerateMoreWordsResult {
  success: boolean;
  data?: WordEntry[];
  error?: string;
}

export async function generateMoreWords(params: GenerateMoreWordsParams): Promise<GenerateMoreWordsResult> {
  const result = await callGenerateApi(
    {
      type: "generate-more-words",
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

// ============================================================================
// Sentence Theme Generation API
// ============================================================================

function isSentenceRoundInput(value: unknown): value is SentenceRoundInput {
  if (!isRecord(value)) return false;
  if (typeof value.englishPrompt !== "string") return false;
  if (typeof value.spanishSentence !== "string") return false;
  if (!Array.isArray(value.wordMeanings)) return false;
  if (!value.wordMeanings.every((entry) => typeof entry === "string")) return false;
  if (
    value.freeWordPositions !== undefined &&
    (!Array.isArray(value.freeWordPositions) ||
      !value.freeWordPositions.every((entry) => typeof entry === "number"))
  ) {
    return false;
  }
  if (!Array.isArray(value.distractors)) return false;
  return value.distractors.every((entry) => typeof entry === "string");
}

function isSentenceRoundInputArray(value: unknown): value is SentenceRoundInput[] {
  return Array.isArray(value) && value.every(isSentenceRoundInput);
}

export type GenerateSentenceThemeParams = Omit<
  Extract<GenerateRequest, { type: "sentence-theme" }>,
  "type"
>;

export interface GenerateSentenceThemeResult {
  success: boolean;
  data?: SentenceRoundInput[];
  error?: string;
}

export async function generateSentenceTheme(
  params: GenerateSentenceThemeParams
): Promise<GenerateSentenceThemeResult> {
  const result = await callGenerateApi(
    {
      type: "sentence-theme",
      themeName: params.themeName,
      themePrompt: params.themePrompt || undefined,
      roundCount: params.roundCount,
    },
    isSentenceRoundInputArray,
    "SentenceRoundInput[]",
    "Sentence generation failed"
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
}

export type GenerateMoreSentenceRoundsParams = Omit<
  Extract<GenerateRequest, { type: "generate-more-sentence-rounds" }>,
  "type"
>;

export interface GenerateMoreSentenceRoundsResult {
  success: boolean;
  data?: SentenceRoundInput[];
  error?: string;
}

export async function generateMoreSentenceRounds(
  params: GenerateMoreSentenceRoundsParams
): Promise<GenerateMoreSentenceRoundsResult> {
  const result = await callGenerateApi(
    {
      type: "generate-more-sentence-rounds",
      themeName: params.themeName,
      roundCount: params.roundCount,
      existingSpanishSentences: params.existingSpanishSentences,
    },
    isSentenceRoundInputArray,
    "SentenceRoundInput[]",
    "Failed to generate sentence rounds"
  );

  if (!result.success) return result;
  return { success: true, data: result.data };
}
