import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  buildAddWordPrompt,
  buildFieldSystemPrompt,
  buildGenerateMoreSentenceRoundsPrompt,
  buildGenerateMoreSentenceRoundsUserMessage,
  buildGenerateMoreWordsPrompt,
  buildGenerateMoreWordsUserMessage,
  buildGenerateThemeUserMessage,
  buildRegenerateForWordPrompt,
  buildSentenceThemeSystemPrompt,
  buildSentenceThemeUserMessage,
  buildThemeSystemPrompt,
} from "@/lib/generate/prompts";
import {
  answerAndWrongsSchema,
  answerSchema,
  buildGenerateMoreSentenceRoundsSchema,
  buildSentenceThemeSchema,
  buildThemeSchema,
  createGenerateMoreWordsSchema,
  wordSchema,
  wrongAnswerSchema,
} from "@/lib/generate/schemas";
import { WRONG_ANSWER_COUNT } from "@/lib/generate/constants";
import {
  LLM_ADD_WORD_CREDITS,
  LLM_FIELD_REGEN_CREDITS,
  LLM_GENERATE_MORE_SENTENCES_CREDITS,
  LLM_GENERATE_MORE_WORDS_CREDITS,
  LLM_SENTENCE_THEME_CREDITS,
  LLM_SINGLE_WORD_REGEN_CREDITS,
  LLM_WORD_THEME_CREDITS,
} from "@/lib/credits/constants";
import { type GenerateRequest } from "@/lib/generate/requestValidation";
import { ApiRouteError } from "@/lib/api/serverErrors";
import { getAuthedConvexClient } from "@/lib/api/convexClient";
import type { WordType } from "@/lib/themes/wordTypes";
import type { ThemeWordInput } from "@/lib/themes/serverValidation";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";
import {
  collectSentenceRoundIssues,
  formatSentenceRoundIssue,
  validateGeneratedSentenceRoundsAgainstExisting,
} from "@/lib/themes/sentenceValidation";
import {
  buildMessages,
  buildRetryMessages,
  callOpenAIJson,
  createOpenAIClient,
  type JsonSchema,
} from "./openaiAdapter";
import {
  creditFailureResponse,
  generationSuccessResponse,
  validationFailureResponse,
} from "./responses";
import {
  validateGeneratedAnswer,
  validateGeneratedTheme,
  validateGeneratedWordEntry,
  validateGeneratedWordsAgainstExisting,
  validateGeneratedWrongAnswer,
} from "@/lib/generate/semanticValidation";

type OpenAIClient = ReturnType<typeof createOpenAIClient>;

type WordWithChoices = { word: string; answer: string; wrongAnswers: string[] };
type AnswerOnly = { answer: string };
type WrongAnswerOnly = { wrongAnswer: string };
type FieldGeneratedData = WordWithChoices | AnswerOnly | WrongAnswerOnly;
type AnswerAndWrongs = { answer: string; wrongAnswers: string[] };

/**
 * One generate→validate→retry-once→validate pipeline, shared by every request
 * type. Each request `type` only builds a `GenerationSpec` describing its prompt,
 * schema, validation, and how to shape the success payload.
 */
type GenerationSpec<T> = {
  systemPrompt: string;
  userMessage: string;
  history?: { role: "user" | "assistant"; content: string }[];
  schemaName: string;
  schema: JsonSchema;
  validate: (parsed: T) => string[];
  toResponseData: (parsed: T) => unknown;
  retryInstruction: string;
};

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
  await client.mutation(api.credits.consumeCredits, {
    creditType: "llm",
    cost,
  });
}

async function consumeCreditsOrReturnFailure(client: ConvexHttpClient, cost: number) {
  try {
    await consumeLlmCredits(client, cost);
    return null;
  } catch (error) {
    return creditFailureResponse(error);
  }
}

async function runGeneration<T>(
  openai: OpenAIClient,
  spec: GenerationSpec<T>
): Promise<{ parsed: T; issues: string[] }> {
  let parsed = await callOpenAIJson<T>(openai, {
    messages: buildMessages({
      systemPrompt: spec.systemPrompt,
      userMessage: spec.userMessage,
      history: spec.history,
    }),
    schemaName: spec.schemaName,
    schema: spec.schema,
  });

  let issues = spec.validate(parsed);
  if (issues.length > 0) {
    parsed = await callOpenAIJson<T>(openai, {
      messages: buildRetryMessages({
        systemPrompt: spec.systemPrompt,
        userMessage: spec.userMessage,
        history: spec.history,
        parsed,
        validationIssues: issues,
        retryInstruction: spec.retryInstruction,
      }),
      schemaName: spec.schemaName,
      schema: spec.schema,
    });
    issues = spec.validate(parsed);
  }

  return { parsed, issues };
}

async function generateAndRespond<T>(
  openai: OpenAIClient,
  convexClient: ConvexHttpClient,
  creditCost: number,
  spec: GenerationSpec<T>
) {
  const { parsed, issues } = await runGeneration(openai, spec);
  if (issues.length > 0) {
    return validationFailureResponse({
      validationIssues: issues,
      prompt: spec.systemPrompt,
      status: 502,
    });
  }

  const creditFailure = await consumeCreditsOrReturnFailure(convexClient, creditCost);
  if (creditFailure) return creditFailure;
  return generationSuccessResponse(spec.toResponseData(parsed), spec.systemPrompt);
}

/** Shared spec for the two single-word flows (`add-word`, `regenerate-for-word`). */
function buildWordEntrySpec(params: {
  systemPrompt: string;
  newWord: string;
  wordType: WordType;
  toResponseData: (parsed: AnswerAndWrongs) => unknown;
}): GenerationSpec<AnswerAndWrongs> {
  const { systemPrompt, newWord, wordType, toResponseData } = params;
  const wordLabel = `Word "${newWord}"`;
  return {
    systemPrompt,
    userMessage: `Generate the Spanish translation and ${WRONG_ANSWER_COUNT} wrong answers for "${newWord}".`,
    schemaName: "answer_and_wrongs",
    schema: answerAndWrongsSchema,
    validate: (parsed) =>
      validateGeneratedWordEntry(
        { word: newWord, answer: parsed.answer, wrongAnswers: parsed.wrongAnswers },
        wordType,
        wordLabel
      ),
    toResponseData,
    retryInstruction:
      "The previous result is invalid. Regenerate the answer and wrong answers and fix these issues:",
  };
}

function buildFieldSpec(
  body: Extract<GenerateRequest, { type: "field" }>
): GenerationSpec<FieldGeneratedData> {
  const {
    fieldType,
    themeName,
    wordType,
    currentWord,
    currentAnswer,
    currentWrongAnswers,
    fieldIndex,
    existingWords,
    rejectedWords,
    history,
    customInstructions,
  } = body;

  const systemPrompt = buildFieldSystemPrompt(
    fieldType,
    themeName,
    currentWord,
    currentAnswer,
    currentWrongAnswers,
    wordType,
    fieldIndex,
    existingWords,
    rejectedWords,
    customInstructions
  );

  let schema: JsonSchema;
  let schemaName: string;
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

  const fieldNoun = fieldType === "wrong" ? "wrong answer" : fieldType;

  return {
    systemPrompt,
    userMessage: `Generate the new ${fieldNoun}.`,
    history,
    schemaName,
    schema,
    validate: (data) => {
      if (fieldType === "word") {
        const generatedWord = data as WordWithChoices;
        return [
          ...validateGeneratedWordEntry(generatedWord, wordType),
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
          currentWrongAnswers,
          wordType
        );
      }
      return validateGeneratedWrongAnswer(
        currentWord,
        currentAnswer,
        currentWrongAnswers,
        fieldIndex as number,
        (data as WrongAnswerOnly).wrongAnswer,
        wordType
      );
    },
    toResponseData: (data) => data,
    retryInstruction: `The previous result is invalid. Regenerate the ${fieldNoun} and fix these issues:`,
  };
}

function buildThemeSpec(
  body: Extract<GenerateRequest, { type: "theme" }>
): GenerationSpec<{ words: ThemeWordInput[] }> {
  return {
    systemPrompt: buildThemeSystemPrompt(
      body.themeName,
      body.wordCount,
      body.wordType,
      body.themePrompt
    ),
    userMessage: buildGenerateThemeUserMessage(body.themeName, body.wordCount, body.wordType),
    history: body.history,
    schemaName: "theme_words",
    schema: buildThemeSchema(body.wordCount),
    validate: (parsed) => validateGeneratedTheme(parsed.words, body.wordType),
    toResponseData: (parsed) => parsed.words,
    retryInstruction:
      "The previous result is invalid. Regenerate the full theme and fix these issues:",
  };
}

function buildRegenerateForWordSpec(
  body: Extract<GenerateRequest, { type: "regenerate-for-word" }>
): GenerationSpec<AnswerAndWrongs> {
  return buildWordEntrySpec({
    systemPrompt: buildRegenerateForWordPrompt(body.themeName, body.newWord, body.wordType),
    newWord: body.newWord,
    wordType: body.wordType,
    toResponseData: (parsed) => parsed,
  });
}

function buildAddWordSpec(
  body: Extract<GenerateRequest, { type: "add-word" }>,
  systemPrompt: string
): GenerationSpec<AnswerAndWrongs> {
  return buildWordEntrySpec({
    systemPrompt,
    newWord: body.newWord,
    wordType: body.wordType,
    toResponseData: (parsed) => ({
      word: body.newWord,
      answer: parsed.answer,
      wrongAnswers: parsed.wrongAnswers,
    }),
  });
}

function buildSentenceThemeSpec(
  body: Extract<GenerateRequest, { type: "sentence-theme" }>
): GenerationSpec<{ rounds: SentenceRoundInput[] }> {
  return {
    systemPrompt: buildSentenceThemeSystemPrompt(body.themeName, body.roundCount, body.themePrompt),
    userMessage: buildSentenceThemeUserMessage(body.themeName, body.roundCount),
    history: body.history,
    schemaName: "sentence_theme_rounds",
    schema: buildSentenceThemeSchema(body.roundCount),
    validate: (parsed) =>
      collectSentenceRoundIssues(parsed.rounds, { requireWordMeanings: true }).map(
        formatSentenceRoundIssue
      ),
    toResponseData: (parsed) => parsed.rounds,
    retryInstruction:
      "The previous result is invalid. Regenerate all sentence rounds and fix these issues:",
  };
}

function buildGenerateMoreSentenceRoundsSpec(
  body: Extract<GenerateRequest, { type: "generate-more-sentence-rounds" }>
): GenerationSpec<{ rounds: SentenceRoundInput[] }> {
  return {
    systemPrompt: buildGenerateMoreSentenceRoundsPrompt(
      body.themeName,
      body.roundCount,
      body.existingSpanishSentences
    ),
    userMessage: buildGenerateMoreSentenceRoundsUserMessage(body.themeName, body.roundCount),
    schemaName: "more_sentence_rounds",
    schema: buildGenerateMoreSentenceRoundsSchema(body.roundCount),
    validate: (parsed) => {
      const existingRounds = body.existingSpanishSentences.map((sentence) => ({
        englishPrompt: "(existing)",
        spanishSentence: sentence,
        distractors: ["x", "y", "z"],
      }));
      return [
        ...collectSentenceRoundIssues(parsed.rounds, { requireWordMeanings: true }).map(
          formatSentenceRoundIssue
        ),
        ...validateGeneratedSentenceRoundsAgainstExisting(parsed.rounds, existingRounds),
      ];
    },
    toResponseData: (parsed) => parsed.rounds,
    retryInstruction:
      "The previous result is invalid. Regenerate all sentence rounds and fix these issues:",
  };
}

function buildGenerateMoreSpec(
  body: Extract<GenerateRequest, { type: "generate-more-words" }>
): GenerationSpec<{ words: WordWithChoices[] }> {
  return {
    systemPrompt: buildGenerateMoreWordsPrompt(
      body.themeName,
      body.count,
      body.existingWords,
      body.wordType
    ),
    userMessage: buildGenerateMoreWordsUserMessage(body.themeName, body.count, body.wordType),
    schemaName: "more_words",
    schema: createGenerateMoreWordsSchema(body.count),
    validate: (parsed) => [
      ...validateGeneratedTheme(parsed.words, body.wordType),
      ...validateGeneratedWordsAgainstExisting(
        parsed.words.map((word) => word.word),
        body.existingWords,
        "an existing word"
      ),
    ],
    toResponseData: (parsed) => parsed.words,
    retryInstruction:
      "The previous result is invalid. Regenerate all more-words and fix these issues:",
  };
}

export function getGenerateRequestCreditCost(body: GenerateRequest): number {
  switch (body.type) {
    case "theme":
      return LLM_WORD_THEME_CREDITS;
    case "sentence-theme":
      return LLM_SENTENCE_THEME_CREDITS;
    case "generate-more-words":
      return LLM_GENERATE_MORE_WORDS_CREDITS;
    case "generate-more-sentence-rounds":
      return LLM_GENERATE_MORE_SENTENCES_CREDITS;
    case "field":
      return LLM_FIELD_REGEN_CREDITS;
    case "regenerate-for-word":
      return LLM_SINGLE_WORD_REGEN_CREDITS;
    case "add-word":
      return LLM_ADD_WORD_CREDITS;
  }
}

export async function handleGenerateRequest(body: GenerateRequest) {
  const creditCost = getGenerateRequestCreditCost(body);
  let convexClient: ConvexHttpClient;
  try {
    convexClient = await ensureLlmCreditsAvailable(creditCost);
  } catch (error) {
    return creditFailureResponse(error);
  }

  const openai = createOpenAIClient();

  if (body.type === "theme") {
    return generateAndRespond(openai, convexClient, creditCost, buildThemeSpec(body));
  }

  if (body.type === "sentence-theme") {
    return generateAndRespond(openai, convexClient, creditCost, buildSentenceThemeSpec(body));
  }

  if (body.type === "generate-more-sentence-rounds") {
    return generateAndRespond(
      openai,
      convexClient,
      creditCost,
      buildGenerateMoreSentenceRoundsSpec(body)
    );
  }

  if (body.type === "field") {
    return generateAndRespond(openai, convexClient, creditCost, buildFieldSpec(body));
  }

  if (body.type === "regenerate-for-word") {
    return generateAndRespond(openai, convexClient, creditCost, buildRegenerateForWordSpec(body));
  }

  if (body.type === "add-word") {
    // add-word does a pre-flight duplicate check before spending a generation.
    const systemPrompt = buildAddWordPrompt(
      body.themeName,
      body.newWord,
      body.existingWords,
      body.wordType
    );
    const duplicateWordIssues = validateGeneratedWordsAgainstExisting(
      [body.newWord],
      body.existingWords,
      "an existing word"
    );
    if (duplicateWordIssues.length > 0) {
      return validationFailureResponse({
        validationIssues: duplicateWordIssues,
        prompt: systemPrompt,
        status: 400,
      });
    }
    return generateAndRespond(openai, convexClient, creditCost, buildAddWordSpec(body, systemPrompt));
  }

  if (body.type === "generate-more-words") {
    return generateAndRespond(openai, convexClient, creditCost, buildGenerateMoreSpec(body));
  }

  return NextResponse.json({ success: false, error: "Invalid request type" }, { status: 400 });
}
