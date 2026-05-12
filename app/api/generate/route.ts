import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import {
  buildAddWordPrompt,
  buildFieldSystemPrompt,
  buildGenerateRandomWordsUserMessage,
  buildGenerateThemeUserMessage,
  buildGenerateRandomWordsPrompt,
  buildRegenerateForWordPrompt,
  buildThemeSystemPrompt,
} from "@/lib/generate/prompts";
import {
  answerAndWrongsSchema,
  answerSchema,
  buildThemeSchema,
  createRandomWordsSchema,
  wordSchema,
  wrongAnswerSchema,
} from "@/lib/generate/schemas";
import { WRONG_ANSWER_COUNT } from "@/lib/generate/constants";
import { LLM_SMALL_ACTION_CREDITS, LLM_THEME_CREDITS } from "@/lib/credits/constants";
import {
  parseGenerateRequest,
  type GenerateRequest,
} from "@/lib/generate/requestValidation";
import { ApiRouteError, resolveApiError } from "@/lib/api/serverErrors";
import {
  collectThemeIssues,
  formatThemeValidationIssue,
  type ThemeWordInput,
} from "@/lib/themes/serverValidation";
import { getDefaultWordType } from "@/lib/themes/wordTypes";
import { normalizeForComparison } from "@/lib/stringUtils";
import {
  THEME_ANSWER_INPUT_MAX_LENGTH,
  THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
} from "@/lib/themes/constants";

export const runtime = "nodejs";

const OPENAI_MODEL = "gpt-5.4-2026-03-05" as const;
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
    throw new ApiRouteError("CONFIG_ERROR", "Convex URL not configured", 500);
  }

  const authResult = await auth();
  if (!authResult.userId) {
    throw new ApiRouteError("AUTH_FAILED", "Unauthorized", 401);
  }

  const token = await authResult.getToken({ template: "convex" });
  if (!token) {
    throw new ApiRouteError("AUTH_FAILED", "Unauthorized", 401);
  }

  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(token);
  return client;
}

async function ensureLlmCreditsAvailable(cost: number) {
  const client = await getAuthedConvexClient();
  const currentUser = await client.query(api.users.getCurrentUser, {});
  if (!currentUser) {
    throw new ApiRouteError("AUTH_FAILED", "Unauthorized", 401);
  }
  if (currentUser.llmCreditsRemaining < cost) {
    throw new ApiRouteError("CREDITS_EXHAUSTED", "LLM credits exhausted", 402);
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

function creditFailureResponse(error: unknown) {
  const resolved = resolveApiError(error, {
    defaultCode: "CREDITS_EXHAUSTED",
    defaultStatus: 402,
    defaultMessage: "Credit check failed",
  });

  return NextResponse.json(
    { success: false, error: resolved.message, code: resolved.code },
    { status: resolved.status }
  );
}

function validateGeneratedTheme(words: ThemeWordInput[]): string[] {
  return collectThemeIssues(words).map((issue) => formatThemeValidationIssue(issue));
}

function validateGeneratedWordEntry(
  entry: ThemeWordInput,
  wordLabel?: string
): string[] {
  return collectThemeIssues([entry]).map((issue) =>
    formatThemeValidationIssue(issue, wordLabel ? { wordLabel } : undefined)
  );
}

function validateGeneratedAnswer(
  currentWord: string,
  generatedAnswer: string,
  currentWrongAnswers: string[]
): string[] {
  const issues: string[] = [];
  const label = `Word "${currentWord}"`;
  const trimmedAnswer = generatedAnswer.trim();

  if (trimmedAnswer.length < 1) {
    issues.push(`${label}: answer must be at least 1 character`);
  } else if (trimmedAnswer.length > THEME_ANSWER_INPUT_MAX_LENGTH) {
    issues.push(`${label}: answer must be at most ${THEME_ANSWER_INPUT_MAX_LENGTH} characters`);
  }

  const comparableAnswer = normalizeForComparison(generatedAnswer);
  if (comparableAnswer !== "") {
    const matchingWrongAnswer = currentWrongAnswers.find(
      (wrongAnswer) => normalizeForComparison(wrongAnswer) === comparableAnswer
    );
    if (matchingWrongAnswer) {
      issues.push(
        `${label}: generated answer "${generatedAnswer}" matches wrong answer "${matchingWrongAnswer}" after normalization.`
      );
    }
  }

  return issues;
}

function validateGeneratedWrongAnswer(
  currentWord: string,
  currentAnswer: string,
  currentWrongAnswers: string[],
  fieldIndex: number,
  generatedWrong: string
): string[] {
  const issues: string[] = [];
  const trimmedWrong = generatedWrong.trim();

  if (trimmedWrong.length < 1) {
    issues.push(`Word "${currentWord}": wrong answer ${fieldIndex + 1} must be at least 1 character`);
  } else if (trimmedWrong.length > THEME_WRONG_ANSWER_INPUT_MAX_LENGTH) {
    issues.push(
      `Word "${currentWord}": wrong answer ${fieldIndex + 1} must be at most ${THEME_WRONG_ANSWER_INPUT_MAX_LENGTH} characters`
    );
  }

  const comparableWrong = normalizeForComparison(generatedWrong);
  const comparableAnswer = normalizeForComparison(currentAnswer);
  if (trimmedWrong !== "" && comparableWrong === comparableAnswer && comparableAnswer !== "") {
    issues.push(
      `Word "${currentWord}": wrong answer "${generatedWrong}" matches the correct answer "${currentAnswer}" after normalization.`
    );
  }

  const duplicateWrong = currentWrongAnswers.find(
    (wrongAnswer, index) =>
      index !== fieldIndex &&
      normalizeForComparison(wrongAnswer) === comparableWrong &&
      comparableWrong !== ""
  );
  if (duplicateWrong) {
    issues.push(
      `Word "${currentWord}": wrong answers "${duplicateWrong}" and "${generatedWrong}" are duplicates after normalization.`
    );
  }

  return issues;
}

function validateGeneratedWordsAgainstExisting(
  generatedWords: string[],
  existingWords: string[],
  matchPhrase: "an existing word" | "a previously rejected word" = "an existing word"
): string[] {
  const existingByComparable = new Map<string, string>();
  existingWords.forEach((word) => {
    const comparableWord = normalizeForComparison(word);
    if (comparableWord !== "" && !existingByComparable.has(comparableWord)) {
      existingByComparable.set(comparableWord, word);
    }
  });

  return generatedWords.flatMap((word, index) => {
    const matchingExistingWord = existingByComparable.get(normalizeForComparison(word));
    if (!matchingExistingWord) return [];
    return [
      `Word ${index + 1}: generated word "${word}" duplicates ${matchPhrase} "${matchingExistingWord}" after normalization.`,
    ];
  });
}

function buildGenerationValidationError(validationIssues: string[]): string {
  if (validationIssues.length === 0) {
    return "Failed to generate valid content. Please try again.";
  }

  return `Failed to generate valid content. ${validationIssues[0]}`;
}

function validationFailureResponse(params: {
  validationIssues: string[];
  prompt: string;
  status: 400 | 502;
}) {
  return NextResponse.json(
    {
      success: false,
      error: buildGenerationValidationError(params.validationIssues),
      prompt: params.prompt,
      validationIssues: params.validationIssues,
    },
    { status: params.status }
  );
}

function buildRetryMessages(params: {
  systemPrompt: string;
  userMessage: string;
  history?: { role: "user" | "assistant"; content: string }[];
  parsed: unknown;
  validationIssues: string[];
  retryInstruction: string;
}): ChatMessage[] {
  const issueLines = params.validationIssues.join("\n- ");
  return [
    ...buildMessages({
      systemPrompt: params.systemPrompt,
      userMessage: params.userMessage,
      history: params.history,
    }),
    { role: "assistant", content: JSON.stringify(params.parsed) },
    {
      role: "user",
      content: `${params.retryInstruction}\n- ${issueLines}`,
    },
  ];
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
      return creditFailureResponse(error);
    }

    let addWordSystemPrompt: string | undefined;
    if (body.type === "add-word") {
      addWordSystemPrompt = buildAddWordPrompt(
        body.themeName,
        body.newWord,
        body.existingWords,
        body.wordType || getDefaultWordType()
      );
      const duplicateWordIssues = validateGeneratedWordsAgainstExisting(
        [body.newWord],
        body.existingWords,
        "an existing word"
      );
      if (duplicateWordIssues.length > 0) {
        return validationFailureResponse({
          validationIssues: duplicateWordIssues,
          prompt: addWordSystemPrompt,
          status: 400,
        });
      }
    }

    const openai = new OpenAI({
      apiKey: process.env.OPEN_AI_API_KEY,
      baseURL: "https://api.openai.com/v1",
    });

    if (body.type === "theme") {
      const wordCount = body.wordCount;
      const wordType = body.wordType || getDefaultWordType();
      const systemPrompt = buildThemeSystemPrompt(
        body.themeName,
        wordCount,
        body.themePrompt,
        wordType
      );
      const firstUserMessage = buildGenerateThemeUserMessage(
        body.themeName,
        wordCount,
        wordType
      );

      const baseMessages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...(body.history || []).map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: firstUserMessage },
      ];

      let parsed = await callOpenAIJson<{ words: ThemeWordInput[] }>(openai, {
        messages: baseMessages,
        schemaName: "theme_words",
        schema: buildThemeSchema(wordCount),
      });

      let validationIssues = validateGeneratedTheme(parsed.words);

      if (validationIssues.length > 0) {
        const issueLines = validationIssues.join("\n- ");
        const retryMessages: ChatMessage[] = [
          { role: "system", content: systemPrompt },
          ...(body.history || []).map((h) => ({
            role: h.role as "user" | "assistant",
            content: h.content,
          })),
          { role: "user", content: firstUserMessage },
          { role: "assistant", content: JSON.stringify(parsed) },
          {
            role: "user",
            content: `The previous result is invalid. Regenerate the full theme and fix these issues:\n- ${issueLines}`,
          },
        ];

        parsed = await callOpenAIJson<{ words: ThemeWordInput[] }>(openai, {
          messages: retryMessages,
          schemaName: "theme_words_retry",
          schema: buildThemeSchema(wordCount),
        });
        validationIssues = validateGeneratedTheme(parsed.words);
      }

      if (validationIssues.length > 0) {
        return validationFailureResponse({
          validationIssues,
          prompt: systemPrompt,
          status: 502,
        });
      }

      try {
        await consumeLlmCredits(convexClient, creditCost);
      } catch (error) {
        return creditFailureResponse(error);
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
        wordType || getDefaultWordType(),
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

      let parsed = await callOpenAIJson<FieldGeneratedData>(openai, {
        messages,
        schemaName,
        schema: schema as JsonSchema,
      });

      const validateFieldOutput = (data: FieldGeneratedData) => {
        if (fieldType === "word") {
          const generatedWord = data as WordWithChoices;
          return [
            ...validateGeneratedWordEntry(generatedWord),
            ...validateGeneratedWordsAgainstExisting(
              [generatedWord.word],
              existingWords || [],
              "an existing word"
            ),
            ...validateGeneratedWordsAgainstExisting(
              [generatedWord.word],
              rejectedWords || [],
              "a previously rejected word"
            ),
          ];
        }
        if (fieldType === "answer") {
          return validateGeneratedAnswer(
            currentWord,
            (data as AnswerOnly).answer,
            currentWrongAnswers
          );
        }
        return validateGeneratedWrongAnswer(
          currentWord,
          currentAnswer,
          currentWrongAnswers,
          fieldIndex as number,
          (data as WrongAnswerOnly).wrongAnswer
        );
      };

      let validationIssues = validateFieldOutput(parsed);
      if (validationIssues.length > 0) {
        parsed = await callOpenAIJson<FieldGeneratedData>(openai, {
          messages: buildRetryMessages({
            systemPrompt,
            userMessage: `Generate the new ${fieldType === "wrong" ? "wrong answer" : fieldType}.`,
            history,
            parsed,
            validationIssues,
            retryInstruction: `The previous result is invalid. Regenerate the ${fieldType === "wrong" ? "wrong answer" : fieldType} and fix these issues:`,
          }),
          schemaName,
          schema: schema as JsonSchema,
        });
        validationIssues = validateFieldOutput(parsed);
      }

      if (validationIssues.length > 0) {
        return validationFailureResponse({
          validationIssues,
          prompt: systemPrompt,
          status: 502,
        });
      }
      try {
        await consumeLlmCredits(convexClient, creditCost);
      } catch (error) {
        return creditFailureResponse(error);
      }
      return NextResponse.json({
        success: true,
        data: parsed,
        prompt: systemPrompt, // Return for debugging
      });
    }

    if (body.type === "regenerate-for-word") {
      const { themeName, wordType, newWord } = body;

      const systemPrompt = buildRegenerateForWordPrompt(
        themeName,
        newWord,
        wordType || getDefaultWordType()
      );

      const wordLabel = `Word "${newWord}"`;
      const messages = buildMessages({
        systemPrompt,
        userMessage: `Generate the Spanish translation and ${WRONG_ANSWER_COUNT} wrong answers for "${newWord}".`,
      });

      let parsed = await callOpenAIJson<{ answer: string; wrongAnswers: string[] }>(openai, {
        messages,
        schemaName: "answer_and_wrongs",
        schema: answerAndWrongsSchema,
      });
      let validationIssues = validateGeneratedWordEntry(
        {
          word: newWord,
          answer: parsed.answer,
          wrongAnswers: parsed.wrongAnswers,
        },
        wordLabel
      );

      if (validationIssues.length > 0) {
        parsed = await callOpenAIJson<{ answer: string; wrongAnswers: string[] }>(openai, {
          messages: buildRetryMessages({
            systemPrompt,
            userMessage: `Generate the Spanish translation and ${WRONG_ANSWER_COUNT} wrong answers for "${newWord}".`,
            parsed,
            validationIssues,
            retryInstruction:
              "The previous result is invalid. Regenerate the answer and wrong answers and fix these issues:",
          }),
          schemaName: "answer_and_wrongs",
          schema: answerAndWrongsSchema,
        });
        validationIssues = validateGeneratedWordEntry(
          {
            word: newWord,
            answer: parsed.answer,
            wrongAnswers: parsed.wrongAnswers,
          },
          wordLabel
        );
      }

      if (validationIssues.length > 0) {
        return validationFailureResponse({
          validationIssues,
          prompt: systemPrompt,
          status: 502,
        });
      }
      try {
        await consumeLlmCredits(convexClient, creditCost);
      } catch (error) {
        return creditFailureResponse(error);
      }
      return NextResponse.json({
        success: true,
        data: parsed,
        prompt: systemPrompt,
      });
    }

    if (body.type === "add-word") {
      const { newWord } = body;
      const systemPrompt = addWordSystemPrompt!;
      const wordLabel = `Word "${newWord}"`;

      const messages = buildMessages({
        systemPrompt,
        userMessage: `Generate the Spanish translation and ${WRONG_ANSWER_COUNT} wrong answers for "${newWord}".`,
      });

      let parsed = await callOpenAIJson<{ answer: string; wrongAnswers: string[] }>(openai, {
        messages,
        schemaName: "answer_and_wrongs",
        schema: answerAndWrongsSchema,
      });
      let validationIssues = validateGeneratedWordEntry(
        {
          word: newWord,
          answer: parsed.answer,
          wrongAnswers: parsed.wrongAnswers,
        },
        wordLabel
      );

      if (validationIssues.length > 0) {
        parsed = await callOpenAIJson<{ answer: string; wrongAnswers: string[] }>(openai, {
          messages: buildRetryMessages({
            systemPrompt,
            userMessage: `Generate the Spanish translation and ${WRONG_ANSWER_COUNT} wrong answers for "${newWord}".`,
            parsed,
            validationIssues,
            retryInstruction:
              "The previous result is invalid. Regenerate the answer and wrong answers and fix these issues:",
          }),
          schemaName: "answer_and_wrongs",
          schema: answerAndWrongsSchema,
        });
        validationIssues = validateGeneratedWordEntry(
          {
            word: newWord,
            answer: parsed.answer,
            wrongAnswers: parsed.wrongAnswers,
          },
          wordLabel
        );
      }

      if (validationIssues.length > 0) {
        return validationFailureResponse({
          validationIssues,
          prompt: systemPrompt,
          status: 502,
        });
      }
      try {
        await consumeLlmCredits(convexClient, creditCost);
      } catch (error) {
        return creditFailureResponse(error);
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

      const resolvedWordType = wordType || getDefaultWordType();
      const systemPrompt = buildGenerateRandomWordsPrompt(
        themeName,
        validCount,
        existingWords,
        resolvedWordType
      );
      const userMessage = buildGenerateRandomWordsUserMessage(
        themeName,
        validCount,
        resolvedWordType
      );

      const messages = buildMessages({
        systemPrompt,
        userMessage,
      });

      let parsed = await callOpenAIJson<{ words: Array<{ word: string; answer: string; wrongAnswers: string[] }> }>(
        openai,
        {
          messages,
          schemaName: "random_words",
          schema: createRandomWordsSchema(validCount),
        }
      );
      let validationIssues = [
        ...validateGeneratedTheme(parsed.words),
        ...validateGeneratedWordsAgainstExisting(
          parsed.words.map((word) => word.word),
          existingWords,
          "an existing word"
        ),
      ];

      if (validationIssues.length > 0) {
        parsed = await callOpenAIJson<{ words: Array<{ word: string; answer: string; wrongAnswers: string[] }> }>(
          openai,
          {
            messages: buildRetryMessages({
              systemPrompt,
              userMessage,
              parsed,
              validationIssues,
              retryInstruction:
                "The previous result is invalid. Regenerate all random words and fix these issues:",
            }),
            schemaName: "random_words",
            schema: createRandomWordsSchema(validCount),
          }
        );
        validationIssues = [
          ...validateGeneratedTheme(parsed.words),
          ...validateGeneratedWordsAgainstExisting(
            parsed.words.map((word) => word.word),
            existingWords,
            "an existing word"
          ),
        ];
      }

      if (validationIssues.length > 0) {
        return validationFailureResponse({
          validationIssues,
          prompt: systemPrompt,
          status: 502,
        });
      }
      try {
        await consumeLlmCredits(convexClient, creditCost);
      } catch (error) {
        return creditFailureResponse(error);
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
