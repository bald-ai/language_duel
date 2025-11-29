import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Types
interface WordEntry {
  word: string;
  answer: string;
  wrongAnswers: string[];
}

interface GenerateThemeRequest {
  type: "theme";
  themeName: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

interface RegenerateFieldRequest {
  type: "field";
  fieldType: "word" | "answer" | "wrong";
  themeName: string;
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
  newWord: string; // The manually edited English word
}

type GenerateRequest = GenerateThemeRequest | RegenerateFieldRequest | RegenerateForWordRequest;

// Build system prompt for theme generation
function buildThemeSystemPrompt(themeName: string): string {
  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly 20 English vocabulary words for the theme "${themeName}" with Spanish translations.

REQUIREMENTS:
- Each word must be an English noun related to "${themeName}"
- The answer must be the correct Spanish translation
- Each word needs exactly 6 wrong answers (Spanish)
- Wrong answers must be CHALLENGING and tricky:
  * Use similar-sounding Spanish words
  * Use words with subtle meaning differences
  * Include plausible Spanish alternatives that could fool a learner
  * Can include intentional grammar mistakes or wrong gender articles
  * NEVER use obviously wrong answers
  * All 6 wrong answers for each word MUST be unique - NO DUPLICATES allowed
- All 20 words must be unique within this theme
- Focus on practical, commonly used vocabulary

OUTPUT FORMAT: JSON array of 20 objects, each with:
- word: English word
- answer: Correct Spanish translation
- wrongAnswers: Array of exactly 6 challenging wrong Spanish translations`;
}

// Build system prompt for field regeneration
function buildFieldSystemPrompt(
  fieldType: "word" | "answer" | "wrong",
  themeName: string,
  currentWord: string,
  currentAnswer: string,
  currentWrongAnswers: string[],
  fieldIndex?: number,
  existingWords?: string[],
  rejectedWords?: string[]
): string {
  const context = `
THEME: "${themeName}"
CURRENT WORD (English): ${currentWord}
CURRENT ANSWER (Spanish): ${currentAnswer}
CURRENT WRONG ANSWERS (Spanish): ${currentWrongAnswers.join(", ")}`;

  if (fieldType === "word") {
    const existingWordsList = existingWords && existingWords.length > 0
      ? existingWords.join(", ")
      : "(none)";
    
    const rejectedWordsList = rejectedWords && rejectedWords.length > 0
      ? `\n\nREJECTED SUGGESTIONS (DO NOT REPEAT): ${rejectedWords.join(", ")}`
      : "";
    
    return `You generate vocabulary flashcards. Given a theme, you produce an English word with its correct Spanish translation and 6 challenging wrong Spanish answers.

TASK: Replace "${currentWord}" with a NEW English word for the theme "${themeName}".

EXISTING WORDS (DO NOT DUPLICATE): ${existingWordsList}${rejectedWordsList}

REQUIREMENTS:
- New word must be a different English noun fitting the theme
- Must NOT duplicate any existing word or rejected suggestion
- Include correct Spanish translation
- Include 6 tricky wrong Spanish answers (similar-sounding, subtle differences, plausible mistakes)
- All 6 wrong answers MUST be unique - NO DUPLICATES allowed

OUTPUT FORMAT: JSON object with:
- word: New English word
- answer: Correct Spanish translation
- wrongAnswers: Array of exactly 6 unique challenging wrong Spanish translations`;
  }

  if (fieldType === "answer") {
    return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Provide a better Spanish translation for the English word.
${context}

The current answer "${currentAnswer}" needs to be replaced. Provide the most accurate Spanish translation.

OUTPUT FORMAT: JSON object with:
- answer: Better/corrected Spanish translation`;
  }

  // fieldType === "wrong"
  const wrongIndex = fieldIndex ?? 0;
  const otherWrongs = currentWrongAnswers.filter((_, i) => i !== wrongIndex);
  
  return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Generate a NEW challenging wrong Spanish answer to replace wrong answer #${wrongIndex + 1}.
${context}

The wrong answer "${currentWrongAnswers[wrongIndex]}" needs to be replaced.
Keep these other wrong answers: ${otherWrongs.join(", ")}

REQUIREMENTS for the new wrong answer:
- Must be CHALLENGING and tricky
- Use similar-sounding Spanish words, subtle meaning differences, or plausible alternatives
- Can include intentional grammar mistakes or wrong gender articles
- Must NOT be the correct answer "${currentAnswer}"
- Must NOT duplicate any existing wrong answer

OUTPUT FORMAT: JSON object with:
- wrongAnswer: Single new challenging wrong Spanish translation`;
}

// JSON schemas for structured output
const themeSchema = {
  type: "object" as const,
  properties: {
    words: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          word: { type: "string" as const },
          answer: { type: "string" as const },
          wrongAnswers: {
            type: "array" as const,
            items: { type: "string" as const },
            minItems: 6,
            maxItems: 6,
          },
        },
        required: ["word", "answer", "wrongAnswers"],
        additionalProperties: false,
      },
      minItems: 20,
      maxItems: 20,
    },
  },
  required: ["words"],
  additionalProperties: false,
};

const wordSchema = {
  type: "object" as const,
  properties: {
    word: { type: "string" as const },
    answer: { type: "string" as const },
    wrongAnswers: {
      type: "array" as const,
      items: { type: "string" as const },
      minItems: 6,
      maxItems: 6,
    },
  },
  required: ["word", "answer", "wrongAnswers"],
  additionalProperties: false,
};

const answerSchema = {
  type: "object" as const,
  properties: {
    answer: { type: "string" as const },
  },
  required: ["answer"],
  additionalProperties: false,
};

const wrongAnswerSchema = {
  type: "object" as const,
  properties: {
    wrongAnswer: { type: "string" as const },
  },
  required: ["wrongAnswer"],
  additionalProperties: false,
};

// Schema for regenerating answer + wrong answers for a manually edited word
const answerAndWrongsSchema = {
  type: "object" as const,
  properties: {
    answer: { type: "string" as const },
    wrongAnswers: {
      type: "array" as const,
      items: { type: "string" as const },
      minItems: 6,
      maxItems: 6,
    },
  },
  required: ["answer", "wrongAnswers"],
  additionalProperties: false,
};

// Build system prompt for regenerating answer + wrong answers for a manually edited word
function buildRegenerateForWordPrompt(themeName: string, newWord: string): string {
  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate the correct Spanish translation and 6 challenging wrong answers for the English word "${newWord}" in the theme "${themeName}".

REQUIREMENTS:
- The answer must be the correct Spanish translation for "${newWord}"
- Provide exactly 6 wrong answers (Spanish)
- Wrong answers must be CHALLENGING and tricky:
  * Use similar-sounding Spanish words
  * Use words with subtle meaning differences
  * Include plausible Spanish alternatives that could fool a learner
  * Can include intentional grammar mistakes or wrong gender articles
  * NEVER use obviously wrong answers
  * All 6 wrong answers MUST be unique - NO DUPLICATES allowed

OUTPUT FORMAT: JSON object with:
- answer: Correct Spanish translation
- wrongAnswers: Array of exactly 6 unique challenging wrong Spanish translations`;
}

export async function POST(request: NextRequest) {
  // Debug logging
  console.log("POST /api/generate started");
  console.log("OPEN_AI_API_KEY exists:", !!process.env.OPEN_AI_API_KEY);
  console.log("OPEN_AI_API_KEY length:", process.env.OPEN_AI_API_KEY?.length);

  const openai = new OpenAI({
    apiKey: process.env.OPEN_AI_API_KEY,
  });

  try {
    const body: GenerateRequest = await request.json();
    console.log("Request type:", body.type);

    if (body.type === "theme") {
      // Generate full theme
      const systemPrompt = buildThemeSystemPrompt(body.themeName);
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...(body.history || []).map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: `Generate 20 Spanish vocabulary words for the theme "${body.themeName}".` },
      ];

      const response = await openai.responses.create({
        model: "gpt-5.1-2025-11-13",
        reasoning: { effort: "low" },
        input: messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content as string })),
        text: {
          format: {
            type: "json_schema",
            name: "theme_words",
            schema: themeSchema,
            strict: true,
          },
        },
      });

      const content = response.output_text;
      if (!content) throw new Error("No content in response");
      
      const parsed = JSON.parse(content);
      return NextResponse.json({
        success: true,
        data: parsed.words,
        prompt: systemPrompt, // Return for debugging
      });
    }

    if (body.type === "field") {
      const { fieldType, themeName, currentWord, currentAnswer, currentWrongAnswers, fieldIndex, existingWords, rejectedWords, history } = body;
      
      const systemPrompt = buildFieldSystemPrompt(
        fieldType,
        themeName,
        currentWord,
        currentAnswer,
        currentWrongAnswers,
        fieldIndex,
        existingWords,
        rejectedWords
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

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...(history || []).map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: `Generate the new ${fieldType === "wrong" ? "wrong answer" : fieldType}.` },
      ];

      const response = await openai.responses.create({
        model: "gpt-5.1-2025-11-13",
        reasoning: { effort: "low" },
        input: messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content as string })),
        text: {
          format: {
            type: "json_schema",
            name: schemaName,
            schema,
            strict: true,
          },
        },
      });

      const content = response.output_text;
      if (!content) throw new Error("No content in response");
      
      const parsed = JSON.parse(content);
      return NextResponse.json({
        success: true,
        data: parsed,
        prompt: systemPrompt, // Return for debugging
      });
    }

    if (body.type === "regenerate-for-word") {
      const { themeName, newWord } = body;
      
      const systemPrompt = buildRegenerateForWordPrompt(themeName, newWord);

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate the Spanish translation and 6 wrong answers for "${newWord}".` },
      ];

      const response = await openai.responses.create({
        model: "gpt-5.1-2025-11-13",
        reasoning: { effort: "low" },
        input: messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content as string })),
        text: {
          format: {
            type: "json_schema",
            name: "answer_and_wrongs",
            schema: answerAndWrongsSchema,
            strict: true,
          },
        },
      });

      const content = response.output_text;
      if (!content) throw new Error("No content in response");
      
      const parsed = JSON.parse(content);
      return NextResponse.json({
        success: true,
        data: parsed,
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
