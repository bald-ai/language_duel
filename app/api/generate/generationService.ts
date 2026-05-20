import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  buildAddWordPrompt,
  buildFieldSystemPrompt,
  buildGenerateMoreWordsPrompt,
  buildGenerateMoreWordsUserMessage,
  buildGenerateThemeUserMessage,
  buildRegenerateForWordPrompt,
  buildThemeSystemPrompt,
} from "@/lib/generate/prompts";
import {
  answerAndWrongsSchema,
  answerSchema,
  buildThemeSchema,
  createGenerateMoreWordsSchema,
  wordSchema,
  wrongAnswerSchema,
} from "@/lib/generate/schemas";
import { WRONG_ANSWER_COUNT } from "@/lib/generate/constants";
import { LLM_SMALL_ACTION_CREDITS, LLM_THEME_CREDITS } from "@/lib/credits/constants";
import { type GenerateRequest } from "@/lib/generate/requestValidation";
import { ApiRouteError } from "@/lib/api/serverErrors";
import { getAuthedConvexClient } from "@/lib/api/convexClient";
import { getDefaultWordType } from "@/lib/themes/wordTypes";
import type { ThemeWordInput } from "@/lib/themes/serverValidation";
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

type WordWithChoices = { word: string; answer: string; wrongAnswers: string[] };
type AnswerOnly = { answer: string };
type WrongAnswerOnly = { wrongAnswer: string };
type FieldGeneratedData = WordWithChoices | AnswerOnly | WrongAnswerOnly;

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

export async function handleGenerateRequest(body: GenerateRequest) {
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

  const openai = createOpenAIClient();

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

    let parsed = await callOpenAIJson<{ words: ThemeWordInput[] }>(openai, {
      messages: buildMessages({
        systemPrompt,
        userMessage: firstUserMessage,
        history: body.history,
      }),
      schemaName: "theme_words",
      schema: buildThemeSchema(wordCount),
    });

    let validationIssues = validateGeneratedTheme(parsed.words, wordType);

    if (validationIssues.length > 0) {
      parsed = await callOpenAIJson<{ words: ThemeWordInput[] }>(openai, {
        messages: buildRetryMessages({
          systemPrompt,
          userMessage: firstUserMessage,
          history: body.history,
          parsed,
          validationIssues,
          retryInstruction:
            "The previous result is invalid. Regenerate the full theme and fix these issues:",
        }),
        schemaName: "theme_words_retry",
        schema: buildThemeSchema(wordCount),
      });
      validationIssues = validateGeneratedTheme(parsed.words, wordType);
    }

    if (validationIssues.length > 0) {
      return validationFailureResponse({
        validationIssues,
        prompt: systemPrompt,
        status: 502,
      });
    }

    const creditFailure = await consumeCreditsOrReturnFailure(convexClient, creditCost);
    if (creditFailure) return creditFailure;
    return generationSuccessResponse(parsed.words, systemPrompt);
  }

  if (body.type === "field") {
    const { fieldType, themeName, wordType, currentWord, currentAnswer, currentWrongAnswers, fieldIndex, existingWords, rejectedWords, history, customInstructions } = body;
    const resolvedWordType = wordType || getDefaultWordType();

    const systemPrompt = buildFieldSystemPrompt(
      fieldType,
      themeName,
      currentWord,
      currentAnswer,
      currentWrongAnswers,
      fieldIndex,
      existingWords,
      rejectedWords,
      resolvedWordType,
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

    const userMessage = `Generate the new ${fieldType === "wrong" ? "wrong answer" : fieldType}.`;
    const messages = buildMessages({
      systemPrompt,
      userMessage,
      history,
    });

    let parsed = await callOpenAIJson<FieldGeneratedData>(openai, {
      messages,
      schemaName,
      schema,
    });

    const validateFieldOutput = (data: FieldGeneratedData) => {
      if (fieldType === "word") {
        const generatedWord = data as WordWithChoices;
        return [
          ...validateGeneratedWordEntry(generatedWord, resolvedWordType),
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
          resolvedWordType
        );
      }
      return validateGeneratedWrongAnswer(
        currentWord,
        currentAnswer,
        currentWrongAnswers,
        fieldIndex as number,
        (data as WrongAnswerOnly).wrongAnswer,
        resolvedWordType
      );
    };

    let validationIssues = validateFieldOutput(parsed);
    if (validationIssues.length > 0) {
      parsed = await callOpenAIJson<FieldGeneratedData>(openai, {
        messages: buildRetryMessages({
          systemPrompt,
          userMessage,
          history,
          parsed,
          validationIssues,
          retryInstruction: `The previous result is invalid. Regenerate the ${fieldType === "wrong" ? "wrong answer" : fieldType} and fix these issues:`,
        }),
        schemaName,
        schema,
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
    const creditFailure = await consumeCreditsOrReturnFailure(convexClient, creditCost);
    if (creditFailure) return creditFailure;
    return generationSuccessResponse(parsed, systemPrompt);
  }

  if (body.type === "regenerate-for-word") {
    const { themeName, wordType, newWord } = body;
    const resolvedWordType = wordType || getDefaultWordType();

    const systemPrompt = buildRegenerateForWordPrompt(
      themeName,
      newWord,
      resolvedWordType
    );

    const wordLabel = `Word "${newWord}"`;
    const userMessage = `Generate the Spanish translation and ${WRONG_ANSWER_COUNT} wrong answers for "${newWord}".`;
    const messages = buildMessages({
      systemPrompt,
      userMessage,
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
      resolvedWordType,
      wordLabel
    );

    if (validationIssues.length > 0) {
      parsed = await callOpenAIJson<{ answer: string; wrongAnswers: string[] }>(openai, {
        messages: buildRetryMessages({
          systemPrompt,
          userMessage,
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
        resolvedWordType,
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
    const creditFailure = await consumeCreditsOrReturnFailure(convexClient, creditCost);
    if (creditFailure) return creditFailure;
    return generationSuccessResponse(parsed, systemPrompt);
  }

  if (body.type === "add-word") {
    const { newWord } = body;
    const resolvedWordType = body.wordType || getDefaultWordType();
    const systemPrompt = addWordSystemPrompt!;
    const wordLabel = `Word "${newWord}"`;
    const userMessage = `Generate the Spanish translation and ${WRONG_ANSWER_COUNT} wrong answers for "${newWord}".`;

    const messages = buildMessages({
      systemPrompt,
      userMessage,
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
      resolvedWordType,
      wordLabel
    );

    if (validationIssues.length > 0) {
      parsed = await callOpenAIJson<{ answer: string; wrongAnswers: string[] }>(openai, {
        messages: buildRetryMessages({
          systemPrompt,
          userMessage,
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
        resolvedWordType,
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
    const creditFailure = await consumeCreditsOrReturnFailure(convexClient, creditCost);
    if (creditFailure) return creditFailure;
    return generationSuccessResponse(
      {
        word: newWord,
        answer: parsed.answer,
        wrongAnswers: parsed.wrongAnswers,
      },
      systemPrompt
    );
  }

  if (body.type === "generate-more-words") {
    const { themeName, wordType, count, existingWords } = body;
    const resolvedWordType = wordType || getDefaultWordType();
    const systemPrompt = buildGenerateMoreWordsPrompt(
      themeName,
      count,
      existingWords,
      resolvedWordType
    );
    const userMessage = buildGenerateMoreWordsUserMessage(
      themeName,
      count,
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
        schemaName: "more_words",
        schema: createGenerateMoreWordsSchema(count),
      }
    );
    let validationIssues = [
      ...validateGeneratedTheme(parsed.words, resolvedWordType),
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
              "The previous result is invalid. Regenerate all more-words and fix these issues:",
          }),
          schemaName: "more_words",
          schema: createGenerateMoreWordsSchema(count),
        }
      );
      validationIssues = [
        ...validateGeneratedTheme(parsed.words, resolvedWordType),
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
    const creditFailure = await consumeCreditsOrReturnFailure(convexClient, creditCost);
    if (creditFailure) return creditFailure;
    return generationSuccessResponse(parsed.words, systemPrompt);
  }

  return NextResponse.json({ success: false, error: "Invalid request type" }, { status: 400 });
}
