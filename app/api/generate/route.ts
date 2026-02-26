import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
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
import { THEME_WORD_COUNT, WRONG_ANSWER_COUNT } from "@/lib/generate/constants";
import { LLM_SMALL_ACTION_CREDITS, LLM_THEME_CREDITS } from "@/lib/credits/constants";
import {
  parseGenerateRequest,
  type GenerateRequest,
} from "@/lib/generate/requestValidation";

export const runtime = 'nodejs';

const OPENAI_MODEL = "gpt-5.1-2025-11-13" as const;
const OPENAI_REASONING_EFFORT = "low" as const;

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL || "";

type WordWithChoices = { word: string; answer: string; wrongAnswers: string[] };
type AnswerOnly = { answer: string };
type WrongAnswerOnly = { wrongAnswer: string };
type FieldGeneratedData = WordWithChoices | AnswerOnly | WrongAnswerOnly;

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

async function getAuthedConvexClient() {
  if (!CONVEX_URL) {
    throw new Error("Convex URL not configured");
  }

  const authResult = await auth();
  if (!authResult.userId) {
    throw new Error("Unauthorized");
  }

  const token = await authResult.getToken({ template: "convex" });
  if (!token) {
    throw new Error("Unauthorized");
  }

  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(token);
  return client;
}

async function ensureLlmCreditsAvailable(cost: number) {
  const client = await getAuthedConvexClient();
  const currentUser = await client.query(api.users.getCurrentUser, {});
  if (!currentUser) {
    throw new Error("Unauthorized");
  }
  if (currentUser.llmCreditsRemaining < cost) {
    throw new Error("LLM credits exhausted");
  }
  return client;
}

async function consumeLlmCredits(client: ConvexHttpClient, cost: number) {
  await client.mutation(api.users.consumeCredits, {
    creditType: "llm",
    cost,
  });
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
    max_output_tokens: 30000,
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
  try {
    const rawBody = await request.json().catch(() => null);
    const parsedRequest = parseGenerateRequest(rawBody);
    if (!parsedRequest.ok) {
      return NextResponse.json(
        { success: false, error: parsedRequest.error },
        { status: 400 }
      );
    }
    const body: GenerateRequest = parsedRequest.data;

    const creditCost = body.type === "theme" ? LLM_THEME_CREDITS : LLM_SMALL_ACTION_CREDITS;
    let convexClient: ConvexHttpClient;
    try {
      convexClient = await ensureLlmCreditsAvailable(creditCost);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Credit check failed";
      const status = message === "Unauthorized" ? 401 : message === "Convex URL not configured" ? 500 : 402;
      return NextResponse.json({ success: false, error: message }, { status });
    }

    const openai = new OpenAI({
      apiKey: process.env.OPEN_AI_API_KEY,
      baseURL: "https://api.openai.com/v1",
    });

    if (body.type === "theme") {
      // Generate full theme - select prompt based on wordType
      const systemPrompt = body.wordType === "verbs"
        ? buildVerbThemeSystemPrompt(body.themeName, body.themePrompt)
        : buildThemeSystemPrompt(body.themeName, body.themePrompt);

      const userMessage = body.wordType === "verbs"
        ? `Generate ${THEME_WORD_COUNT} Spanish verbs for the theme "${body.themeName}".`
        : `Generate ${THEME_WORD_COUNT} Spanish vocabulary words for the theme "${body.themeName}".`;

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
      try {
        await consumeLlmCredits(convexClient, creditCost);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Credit check failed";
        const status = message === "Unauthorized" ? 401 : message === "Convex URL not configured" ? 500 : 402;
        return NextResponse.json({ success: false, error: message }, { status });
      }
      return NextResponse.json({
        success: true,
        data: parsed.words,
        prompt: systemPrompt, // Return for debugging
      });
    }

    if (body.type === "field") {
      const { fieldType, themeName, wordType, currentWord, currentAnswer, currentWrongAnswers, fieldIndex, existingWords, rejectedWords, history, customInstructions } = body;

      const systemPrompt = buildFieldSystemPrompt(
        fieldType,
        themeName,
        currentWord,
        currentAnswer,
        currentWrongAnswers,
        fieldIndex,
        existingWords,
        rejectedWords,
        wordType || "nouns",
        customInstructions
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
      try {
        await consumeLlmCredits(convexClient, creditCost);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Credit check failed";
        const status = message === "Unauthorized" ? 401 : message === "Convex URL not configured" ? 500 : 402;
        return NextResponse.json({ success: false, error: message }, { status });
      }
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
        userMessage: `Generate the Spanish translation and ${WRONG_ANSWER_COUNT} wrong answers for "${newWord}".`,
      });

      const parsed = await callOpenAIJson<{ answer: string; wrongAnswers: string[] }>(openai, {
        messages,
        schemaName: "answer_and_wrongs",
        schema: answerAndWrongsSchema,
      });
      try {
        await consumeLlmCredits(convexClient, creditCost);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Credit check failed";
        const status = message === "Unauthorized" ? 401 : message === "Convex URL not configured" ? 500 : 402;
        return NextResponse.json({ success: false, error: message }, { status });
      }
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
        userMessage: `Generate the Spanish translation and ${WRONG_ANSWER_COUNT} wrong answers for "${newWord}".`,
      });

      const parsed = await callOpenAIJson<{ answer: string; wrongAnswers: string[] }>(openai, {
        messages,
        schemaName: "answer_and_wrongs",
        schema: answerAndWrongsSchema,
      });
      try {
        await consumeLlmCredits(convexClient, creditCost);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Credit check failed";
        const status = message === "Unauthorized" ? 401 : message === "Convex URL not configured" ? 500 : 402;
        return NextResponse.json({ success: false, error: message }, { status });
      }
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

      const validCount = count;

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
      try {
        await consumeLlmCredits(convexClient, creditCost);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Credit check failed";
        const status = message === "Unauthorized" ? 401 : message === "Convex URL not configured" ? 500 : 402;
        return NextResponse.json({ success: false, error: message }, { status });
      }
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
