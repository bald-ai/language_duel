import { THEME_WORD_COUNT } from "@/lib/generate/constants";
import {
  CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  THEME_ANSWER_INPUT_MAX_LENGTH,
  THEME_MAX_WRONG_ANSWER_COUNT,
  THEME_MIN_WRONG_ANSWER_COUNT,
  THEME_NAME_MAX_LENGTH,
  THEME_NAME_MIN_LENGTH,
  THEME_PROMPT_MAX_LENGTH,
  THEME_USER_FEEDBACK_MAX_LENGTH,
  THEME_WORD_INPUT_MAX_LENGTH,
  THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
} from "@/lib/themes/constants";

const MAX_HISTORY_MESSAGES = 50;
const MAX_WORDS_ARRAY_ITEMS = 500;

type WordType = "nouns" | "verbs";
type FieldType = "word" | "answer" | "wrong";

type HistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export interface GenerateThemeRequest {
  type: "theme";
  themeName: string;
  themePrompt?: string;
  wordType?: WordType;
  history?: HistoryMessage[];
}

export interface RegenerateFieldRequest {
  type: "field";
  fieldType: FieldType;
  themeName: string;
  wordType?: WordType;
  currentWord: string;
  currentAnswer: string;
  currentWrongAnswers: string[];
  fieldIndex?: number;
  existingWords?: string[];
  rejectedWords?: string[];
  history?: HistoryMessage[];
  customInstructions?: string;
}

export interface RegenerateForWordRequest {
  type: "regenerate-for-word";
  themeName: string;
  wordType?: WordType;
  newWord: string;
}

export interface AddWordRequest {
  type: "add-word";
  themeName: string;
  wordType?: WordType;
  newWord: string;
  existingWords: string[];
}

export interface GenerateRandomWordsRequest {
  type: "generate-random-words";
  themeName: string;
  wordType?: WordType;
  count: number;
  existingWords: string[];
}

export type GenerateRequest =
  | GenerateThemeRequest
  | RegenerateFieldRequest
  | RegenerateForWordRequest
  | AddWordRequest
  | GenerateRandomWordsRequest;

type ParseResult =
  | { ok: true; data: GenerateRequest }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTrimmedString(params: {
  value: unknown;
  field: string;
  min?: number;
  max: number;
}): string {
  const { value, field, min = 0, max } = params;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string`);
  }

  const normalized = value.trim();
  if (normalized.length < min) {
    throw new Error(`${field} must be at least ${min} character${min === 1 ? "" : "s"}`);
  }
  if (normalized.length > max) {
    throw new Error(`${field} must be at most ${max} characters`);
  }
  return normalized;
}

function parseWordType(value: unknown): WordType | undefined {
  if (value === undefined) return undefined;
  if (value === "nouns" || value === "verbs") return value;
  throw new Error("wordType must be either \"nouns\" or \"verbs\"");
}

function parseHistory(value: unknown): HistoryMessage[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new Error("history must be an array");
  }
  if (value.length > MAX_HISTORY_MESSAGES) {
    throw new Error(`history must contain at most ${MAX_HISTORY_MESSAGES} messages`);
  }

  return value.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`history[${index}] must be an object`);
    }
    if (entry.role !== "user" && entry.role !== "assistant") {
      throw new Error(`history[${index}].role must be \"user\" or \"assistant\"`);
    }

    const maxLength =
      entry.role === "user"
        ? THEME_USER_FEEDBACK_MAX_LENGTH
        : THEME_USER_FEEDBACK_MAX_LENGTH * 2;
    const content = parseTrimmedString({
      value: entry.content,
      field: `history[${index}].content`,
      min: 1,
      max: maxLength,
    });
    return { role: entry.role, content };
  });
}

function parseStringArray(params: {
  value: unknown;
  field: string;
  maxItems?: number;
  minItems?: number;
  maxItemLength: number;
}): string[] {
  const {
    value,
    field,
    maxItems = MAX_WORDS_ARRAY_ITEMS,
    minItems = 0,
    maxItemLength,
  } = params;

  if (!Array.isArray(value)) {
    throw new Error(`${field} must be an array`);
  }
  if (value.length < minItems || value.length > maxItems) {
    throw new Error(`${field} must contain ${minItems}-${maxItems} items`);
  }

  return value.map((entry, index) =>
    parseTrimmedString({
      value: entry,
      field: `${field}[${index}]`,
      min: 1,
      max: maxItemLength,
    })
  );
}

function parseFieldIndex(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("fieldIndex must be a non-negative integer");
  }
  if (value >= THEME_MAX_WRONG_ANSWER_COUNT) {
    throw new Error(
      `fieldIndex must be less than ${THEME_MAX_WRONG_ANSWER_COUNT}`
    );
  }
  return value;
}

function parseCount(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value)
  ) {
    throw new Error("count must be an integer");
  }
  if (value < 1 || value > THEME_WORD_COUNT) {
    throw new Error(`count must be between 1 and ${THEME_WORD_COUNT}`);
  }
  return value;
}

function parseThemeName(value: unknown): string {
  return parseTrimmedString({
    value,
    field: "themeName",
    min: THEME_NAME_MIN_LENGTH,
    max: THEME_NAME_MAX_LENGTH,
  });
}

function parseThemePrompt(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const prompt = parseTrimmedString({
    value,
    field: "themePrompt",
    max: THEME_PROMPT_MAX_LENGTH,
  });
  return prompt || undefined;
}

function parseCustomInstructions(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const instructions = parseTrimmedString({
    value,
    field: "customInstructions",
    max: CUSTOM_INSTRUCTIONS_MAX_LENGTH,
  });
  return instructions || undefined;
}

function parseThemeRequest(body: Record<string, unknown>): GenerateThemeRequest {
  return {
    type: "theme",
    themeName: parseThemeName(body.themeName),
    themePrompt: parseThemePrompt(body.themePrompt),
    wordType: parseWordType(body.wordType),
    history: parseHistory(body.history),
  };
}

function parseFieldRequest(body: Record<string, unknown>): RegenerateFieldRequest {
  if (
    body.fieldType !== "word" &&
    body.fieldType !== "answer" &&
    body.fieldType !== "wrong"
  ) {
    throw new Error("fieldType must be \"word\", \"answer\", or \"wrong\"");
  }

  return {
    type: "field",
    fieldType: body.fieldType,
    themeName: parseThemeName(body.themeName),
    wordType: parseWordType(body.wordType),
    currentWord: parseTrimmedString({
      value: body.currentWord,
      field: "currentWord",
      min: 1,
      max: THEME_WORD_INPUT_MAX_LENGTH,
    }),
    currentAnswer: parseTrimmedString({
      value: body.currentAnswer,
      field: "currentAnswer",
      min: 1,
      max: THEME_ANSWER_INPUT_MAX_LENGTH,
    }),
    currentWrongAnswers: parseStringArray({
      value: body.currentWrongAnswers,
      field: "currentWrongAnswers",
      minItems: THEME_MIN_WRONG_ANSWER_COUNT,
      maxItems: THEME_MAX_WRONG_ANSWER_COUNT,
      maxItemLength: THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
    }),
    fieldIndex: parseFieldIndex(body.fieldIndex),
    existingWords:
      body.existingWords === undefined
        ? undefined
        : parseStringArray({
            value: body.existingWords,
            field: "existingWords",
            maxItemLength: THEME_WORD_INPUT_MAX_LENGTH,
          }),
    rejectedWords:
      body.rejectedWords === undefined
        ? undefined
        : parseStringArray({
            value: body.rejectedWords,
            field: "rejectedWords",
            maxItemLength: THEME_WORD_INPUT_MAX_LENGTH,
          }),
    history: parseHistory(body.history),
    customInstructions: parseCustomInstructions(body.customInstructions),
  };
}

function parseRegenerateForWordRequest(
  body: Record<string, unknown>
): RegenerateForWordRequest {
  return {
    type: "regenerate-for-word",
    themeName: parseThemeName(body.themeName),
    wordType: parseWordType(body.wordType),
    newWord: parseTrimmedString({
      value: body.newWord,
      field: "newWord",
      min: 1,
      max: THEME_WORD_INPUT_MAX_LENGTH,
    }),
  };
}

function parseAddWordRequest(body: Record<string, unknown>): AddWordRequest {
  return {
    type: "add-word",
    themeName: parseThemeName(body.themeName),
    wordType: parseWordType(body.wordType),
    newWord: parseTrimmedString({
      value: body.newWord,
      field: "newWord",
      min: 1,
      max: THEME_WORD_INPUT_MAX_LENGTH,
    }),
    existingWords: parseStringArray({
      value: body.existingWords,
      field: "existingWords",
      maxItemLength: THEME_WORD_INPUT_MAX_LENGTH,
    }),
  };
}

function parseGenerateRandomWordsRequest(
  body: Record<string, unknown>
): GenerateRandomWordsRequest {
  return {
    type: "generate-random-words",
    themeName: parseThemeName(body.themeName),
    wordType: parseWordType(body.wordType),
    count: parseCount(body.count),
    existingWords: parseStringArray({
      value: body.existingWords,
      field: "existingWords",
      maxItemLength: THEME_WORD_INPUT_MAX_LENGTH,
    }),
  };
}

export function parseGenerateRequest(payload: unknown): ParseResult {
  if (!isRecord(payload)) {
    return { ok: false, error: "Request body must be an object" };
  }

  if (typeof payload.type !== "string") {
    return { ok: false, error: "type is required" };
  }

  try {
    if (payload.type === "theme") {
      return { ok: true, data: parseThemeRequest(payload) };
    }
    if (payload.type === "field") {
      return { ok: true, data: parseFieldRequest(payload) };
    }
    if (payload.type === "regenerate-for-word") {
      return { ok: true, data: parseRegenerateForWordRequest(payload) };
    }
    if (payload.type === "add-word") {
      return { ok: true, data: parseAddWordRequest(payload) };
    }
    if (payload.type === "generate-random-words") {
      return { ok: true, data: parseGenerateRandomWordsRequest(payload) };
    }
    return { ok: false, error: "Invalid request type" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid generate request";
    return { ok: false, error: message };
  }
}
