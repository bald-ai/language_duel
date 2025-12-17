import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  buildAddWordPrompt,
  buildFieldSystemPrompt,
  buildGenerateRandomWordsPrompt,
  buildRegenerateForWordPrompt,
  buildThemeSystemPrompt,
  buildVerbThemeSystemPrompt,
} from "@/lib/generate/prompts";
import {
  answerAndWrongsSchema,
  answerSchema,
  createRandomWordsSchema,
  themeSchema,
  wordSchema,
  wrongAnswerSchema,
} from "@/lib/generate/schemas";

export const runtime = 'nodejs';

const OPENAI_MODEL = "gpt-5.1-2025-11-13" as const;
const OPENAI_REASONING_EFFORT = "low" as const;

const RANDOM_WORDS_MIN_COUNT = 1;
const RANDOM_WORDS_MAX_COUNT = 10;

type WordWithChoices = { word: string; answer: string; wrongAnswers: string[] };
type AnswerOnly = { answer: string };
type WrongAnswerOnly = { wrongAnswer: string };
type FieldGeneratedData = WordWithChoices | AnswerOnly | WrongAnswerOnly;

interface GenerateThemeRequest {
  type: "theme";
  themeName: string;
  themePrompt?: string; // Optional additional specification for word generation
  wordType?: "nouns" | "verbs"; // Type of words to generate
  history?: { role: "user" | "assistant"; content: string }[];
}

interface RegenerateFieldRequest {
  type: "field";
  fieldType: "word" | "answer" | "wrong";
  themeName: string;
  wordType?: "nouns" | "verbs"; // Type of words in the theme
  currentWord: string;
  currentAnswer: string;
  currentWrongAnswers: string[];
  fieldIndex?: number; // For wrong answers, which one (0-5)
  existingWords?: string[]; // All other words in the theme to avoid duplicates
  rejectedWords?: string[]; // Previously rejected suggestions to avoid repeating
  history?: { role: "user" | "assistant"; content: string }[];
}

interface RegenerateForWordRequest {
  type: "regenerate-for-word";
  themeName: string;
  wordType?: "nouns" | "verbs"; // Type of words in the theme
  newWord: string; // The manually edited English word
}

interface AddWordRequest {
  type: "add-word";
  themeName: string;
  wordType?: "nouns" | "verbs"; // Type of words in the theme
  newWord: string; // The English word to add
  existingWords: string[]; // All existing words in the theme to avoid duplicates
}

interface GenerateRandomWordsRequest {
  type: "generate-random-words";
  themeName: string;
  wordType?: "nouns" | "verbs"; // Type of words in the theme
  count: number; // Number of words to generate (1-10)
  existingWords: string[]; // All existing words in the theme to avoid duplicates
}

type GenerateRequest = GenerateThemeRequest | RegenerateFieldRequest | RegenerateForWordRequest | AddWordRequest | GenerateRandomWordsRequest;

type ChatMessage = OpenAI.Chat.ChatCompletionMessageParam;
type JsonSchema = Record<string, unknown>;

function buildMessages(params: {
  systemPrompt: string;
  userMessage: string;
  history?: { role: "user" | "assistant"; content: string }[];
}): ChatMessage[] {
  const { systemPrompt, userMessage, history } = params;
  return [
    { role: "system", content: systemPrompt },
    ...(history || []).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    })),
    { role: "user", content: userMessage },
  ];
}

function toResponsesInput(messages: ChatMessage[]) {
  return messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content as string,
  }));
}

async function callOpenAIJson<T>(
  openai: OpenAI,
  params: {
    messages: ChatMessage[];
    schemaName: string;
    schema: JsonSchema;
  }
): Promise<T> {
  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    reasoning: { effort: OPENAI_REASONING_EFFORT },
    input: toResponsesInput(params.messages),
    text: {
      format: {
        type: "json_schema",
        name: params.schemaName,
        schema: params.schema,
        strict: true,
      },
    },
  });

  const content = response.output_text;
  if (!content) throw new Error("No content in response");
  return JSON.parse(content) as T;
}

export async function POST(request: NextRequest) {
  // Debug logging
  console.log("POST /api/generate started");
  console.log("OPEN_AI_API_KEY exists:", !!process.env.OPEN_AI_API_KEY);
  console.log("OPEN_AI_API_KEY length:", process.env.OPEN_AI_API_KEY?.length);

  const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_API_KEY,
    baseURL: "https://api.openai.com/v1",
  });
  console.log("OpenAI baseURL:", openai.baseURL);

  try {
    const body: GenerateRequest = await request.json();
    console.log("Request type:", body.type);
    console.log("Making OpenAI request...");

    if (body.type === "theme") {
      // Generate full theme - select prompt based on wordType
      const systemPrompt = body.wordType === "verbs"
        ? buildVerbThemeSystemPrompt(body.themeName, body.themePrompt)
        : buildThemeSystemPrompt(body.themeName, body.themePrompt);
      
      const userMessage = body.wordType === "verbs"
        ? `Generate 20 Spanish verbs for the theme "${body.themeName}".`
        : `Generate 20 Spanish vocabulary words for the theme "${body.themeName}".`;
      
      const messages = buildMessages({
        systemPrompt,
        userMessage,
        history: body.history,
      });

      const parsed = await callOpenAIJson<{ words: Array<{ word: string; answer: string; wrongAnswers: string[] }> }>(
        openai,
        {
          messages,
          schemaName: "theme_words",
          schema: themeSchema,
        }
      );
      return NextResponse.json({
        success: true,
        data: parsed.words,
        prompt: systemPrompt, // Return for debugging
      });
    }

    if (body.type === "field") {
      const { fieldType, themeName, wordType, currentWord, currentAnswer, currentWrongAnswers, fieldIndex, existingWords, rejectedWords, history } = body;
      
      const systemPrompt = buildFieldSystemPrompt(
        fieldType,
        themeName,
        currentWord,
        currentAnswer,
        currentWrongAnswers,
        fieldIndex,
        existingWords,
        rejectedWords,
        wordType || "nouns"
      );

      // Choose schema based on field type
      let schema;
      let schemaName;
      if (fieldType === "word") {
        schema = wordSchema;
        schemaName = "new_word";
      } else if (fieldType === "answer") {
        schema = answerSchema;
        schemaName = "new_answer";
      } else {
        schema = wrongAnswerSchema;
        schemaName = "new_wrong_answer";
      }

      const messages = buildMessages({
        systemPrompt,
        userMessage: `Generate the new ${fieldType === "wrong" ? "wrong answer" : fieldType}.`,
        history,
      });

      const parsed = await callOpenAIJson<FieldGeneratedData>(openai, {
        messages,
        schemaName,
        schema: schema as JsonSchema,
      });
      return NextResponse.json({
        success: true,
        data: parsed,
        prompt: systemPrompt, // Return for debugging
      });
    }

    if (body.type === "regenerate-for-word") {
      const { themeName, wordType, newWord } = body;
      
      const systemPrompt = buildRegenerateForWordPrompt(themeName, newWord, wordType || "nouns");

      const messages = buildMessages({
        systemPrompt,
        userMessage: `Generate the Spanish translation and 6 wrong answers for "${newWord}".`,
      });

      const parsed = await callOpenAIJson<{ answer: string; wrongAnswers: string[] }>(openai, {
        messages,
        schemaName: "answer_and_wrongs",
        schema: answerAndWrongsSchema,
      });
      return NextResponse.json({
        success: true,
        data: parsed,
        prompt: systemPrompt,
      });
    }

    if (body.type === "add-word") {
      const { themeName, wordType, newWord, existingWords } = body;
      
      const systemPrompt = buildAddWordPrompt(themeName, newWord, existingWords, wordType || "nouns");

      const messages = buildMessages({
        systemPrompt,
        userMessage: `Generate the Spanish translation and 6 wrong answers for "${newWord}".`,
      });

      const parsed = await callOpenAIJson<{ answer: string; wrongAnswers: string[] }>(openai, {
        messages,
        schemaName: "answer_and_wrongs",
        schema: answerAndWrongsSchema,
      });
      return NextResponse.json({
        success: true,
        data: {
          word: newWord,
          answer: parsed.answer,
          wrongAnswers: parsed.wrongAnswers,
        },
        prompt: systemPrompt,
      });
    }

    if (body.type === "generate-random-words") {
      const { themeName, wordType, count, existingWords } = body;
      
      // Validate count
      const validCount = Math.min(
        Math.max(Math.floor(count), RANDOM_WORDS_MIN_COUNT),
        RANDOM_WORDS_MAX_COUNT
      );
      
      const systemPrompt = buildGenerateRandomWordsPrompt(themeName, validCount, existingWords, wordType || "nouns");

      const userMessage = wordType === "verbs"
        ? `Generate ${validCount} new Spanish verbs for the theme "${themeName}".`
        : `Generate ${validCount} new Spanish vocabulary words for the theme "${themeName}".`;

      const messages = buildMessages({
        systemPrompt,
        userMessage,
      });

      const parsed = await callOpenAIJson<{ words: Array<{ word: string; answer: string; wrongAnswers: string[] }> }>(
        openai,
        {
          messages,
          schemaName: "random_words",
          schema: createRandomWordsSchema(validCount),
        }
      );
      return NextResponse.json({
        success: true,
        data: parsed.words,
        prompt: systemPrompt,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid request type" }, { status: 400 });
  } catch (error) {
    console.error("Generate API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
