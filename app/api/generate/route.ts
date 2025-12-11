import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = 'nodejs';

// Types
interface WordEntry {
  word: string;
  answer: string;
  wrongAnswers: string[];
}

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

// Build system prompt for theme generation
function buildThemeSystemPrompt(themeName: string, themePrompt?: string): string {
  const promptSpecification = themePrompt 
    ? `\n- Focus specifically on: ${themePrompt}` 
    : "";
  
  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly 20 English vocabulary words for the theme "${themeName}" with Spanish translations.

REQUIREMENTS:
- Each word must be an English noun related to "${themeName}"${promptSpecification}
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
- ANSWER AND MULTIPLE CHOICES MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa")

OUTPUT FORMAT: JSON array of 20 objects, each with:
- word: English word
- answer: Correct Spanish translation
- wrongAnswers: Array of exactly 6 challenging wrong Spanish translations`;
}

// Build system prompt for verb theme generation
function buildVerbThemeSystemPrompt(themeName: string, themePrompt?: string): string {
  const promptSpecification = themePrompt 
    ? `\n- Focus specifically on: ${themePrompt}` 
    : "";
  
  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly 20 English verbs for the theme "${themeName}" with Spanish infinitive translations.

REQUIREMENTS:
- Each word must be an English verb related to "${themeName}"${promptSpecification}
- The answer must be the Spanish INFINITIVE form (e.g., hablar, comer, vivir)
- NO articles (el/la) - verbs in infinitive form don't use articles
- If a verb is IRREGULAR in Spanish, end the Spanish infinitive with "*" (e.g., "ir*", "ser*", "tener*")
- Regular verbs should NOT have the "*" marker
- Each word needs exactly 6 wrong answers (Spanish infinitives)
- Wrong answers must be CHALLENGING and tricky:
  * Use similar-sounding Spanish verbs
  * Use verbs with subtle meaning differences
  * Include plausible Spanish verb alternatives that could fool a learner
  * Can include intentional grammar mistakes
  * All 6 wrong answers for each word MUST be unique - NO DUPLICATES allowed
  * Wrong answers should also follow the irregular "*" convention if applicable
- All 20 verbs must be unique within this theme
- Focus on practical, commonly used verbs

OUTPUT FORMAT: JSON array of 20 objects, each with:
- word: English verb (e.g., "speak", "eat", "go")
- answer: Spanish infinitive (e.g., "hablar", "comer", "ir*")
- wrongAnswers: Array of exactly 6 challenging wrong Spanish infinitives`;
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
  rejectedWords?: string[],
  wordType: "nouns" | "verbs" = "nouns"
): string {
  const isVerbs = wordType === "verbs";
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
    
    if (isVerbs) {
      return `You generate vocabulary flashcards. Given a theme, you produce an English verb with its correct Spanish infinitive translation and 6 challenging wrong Spanish infinitives.

TASK: Replace "${currentWord}" with a NEW English verb for the theme "${themeName}".

EXISTING WORDS (DO NOT DUPLICATE): ${existingWordsList}${rejectedWordsList}

REQUIREMENTS:
- New word must be a different English verb fitting the theme
- Must NOT duplicate any existing word or rejected suggestion
- Include correct Spanish infinitive translation (e.g., hablar, comer, vivir)
- NO articles (el/la) - verbs in infinitive form don't use articles
- If the verb is IRREGULAR in Spanish, end with "*" (e.g., "ir*", "ser*", "tener*")
- Include 6 tricky wrong Spanish infinitives (similar-sounding, subtle differences)
- All 6 wrong answers MUST be unique - NO DUPLICATES allowed

OUTPUT FORMAT: JSON object with:
- word: New English verb
- answer: Spanish infinitive (with * if irregular)
- wrongAnswers: Array of exactly 6 unique challenging wrong Spanish infinitives`;
    }
    
    return `You generate vocabulary flashcards. Given a theme, you produce an English word with its correct Spanish translation and 6 challenging wrong Spanish answers.

TASK: Replace "${currentWord}" with a NEW English word for the theme "${themeName}".

EXISTING WORDS (DO NOT DUPLICATE): ${existingWordsList}${rejectedWordsList}

REQUIREMENTS:
- New word must be a different English noun fitting the theme
- Must NOT duplicate any existing word or rejected suggestion
- Include correct Spanish translation
- Include 6 tricky wrong Spanish answers (similar-sounding, subtle differences, plausible mistakes)
- All 6 wrong answers MUST be unique - NO DUPLICATES allowed
- ANSWER AND MULTIPLE CHOICES MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa")

OUTPUT FORMAT: JSON object with:
- word: New English word
- answer: Correct Spanish translation
- wrongAnswers: Array of exactly 6 unique challenging wrong Spanish translations`;
  }

  if (fieldType === "answer") {
    if (isVerbs) {
      return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Provide a better Spanish infinitive translation for the English verb.
${context}

The current answer "${currentAnswer}" needs to be replaced. Provide the most accurate Spanish infinitive.
NO articles (el/la) - verbs in infinitive form don't use articles.
If the verb is IRREGULAR in Spanish, end with "*" (e.g., "ir*", "ser*", "tener*").

OUTPUT FORMAT: JSON object with:
- answer: Better/corrected Spanish infinitive (with * if irregular)`;
    }
    
    return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Provide a better Spanish translation for the English word.
${context}

The current answer "${currentAnswer}" needs to be replaced. Provide the most accurate Spanish translation.
ANSWER MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa").

OUTPUT FORMAT: JSON object with:
- answer: Better/corrected Spanish translation (with definite article)`;
  }

  // fieldType === "wrong"
  const wrongIndex = fieldIndex ?? 0;
  const otherWrongs = currentWrongAnswers.filter((_, i) => i !== wrongIndex);
  
  if (isVerbs) {
    return `You are a Spanish language tutor helping English speakers learn Spanish.

TASK: Generate a NEW challenging wrong Spanish infinitive to replace wrong answer #${wrongIndex + 1}.
${context}

The wrong answer "${currentWrongAnswers[wrongIndex]}" needs to be replaced.
Keep these other wrong answers: ${otherWrongs.join(", ")}

REQUIREMENTS for the new wrong answer:
- Must be CHALLENGING and tricky
- Use similar-sounding Spanish verbs, subtle meaning differences, or plausible alternatives
- Can include intentional grammar mistakes
- Must be a Spanish infinitive (ending in -ar, -er, -ir)
- NO articles (el/la) - verbs don't use articles
- If irregular, end with "*"
- Must NOT be the correct answer "${currentAnswer}"
- Must NOT duplicate any existing wrong answer

OUTPUT FORMAT: JSON object with:
- wrongAnswer: Single new challenging wrong Spanish infinitive`;
  }
  
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
- WRONG ANSWER MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa")

OUTPUT FORMAT: JSON object with:
- wrongAnswer: Single new challenging wrong Spanish translation (with definite article)`;
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

// Function to create schema for generating N random words
function createRandomWordsSchema(count: number) {
  return {
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
        minItems: count,
        maxItems: count,
      },
    },
    required: ["words"],
    additionalProperties: false,
  };
}

// Build system prompt for regenerating answer + wrong answers for a manually edited word
function buildRegenerateForWordPrompt(themeName: string, newWord: string, wordType: "nouns" | "verbs" = "nouns"): string {
  if (wordType === "verbs") {
    return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate the correct Spanish infinitive translation and 6 challenging wrong infinitives for the English verb "${newWord}" in the theme "${themeName}".

REQUIREMENTS:
- The answer must be the correct Spanish infinitive for "${newWord}" (e.g., hablar, comer, vivir)
- NO articles (el/la) - verbs in infinitive form don't use articles
- If the verb is IRREGULAR in Spanish, end with "*" (e.g., "ir*", "ser*", "tener*")
- Provide exactly 6 wrong answers (Spanish infinitives)
- Wrong answers must be CHALLENGING and tricky:
  * Use similar-sounding Spanish verbs
  * Use verbs with subtle meaning differences
  * Include plausible Spanish verb alternatives that could fool a learner
  * Can include intentional grammar mistakes
  * NEVER use obviously wrong answers
  * All 6 wrong answers MUST be unique - NO DUPLICATES allowed
  * Wrong answers should also follow the irregular "*" convention if applicable

OUTPUT FORMAT: JSON object with:
- answer: Correct Spanish infinitive (with * if irregular)
- wrongAnswers: Array of exactly 6 unique challenging wrong Spanish infinitives`;
  }
  
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
- ANSWER AND MULTIPLE CHOICES MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa")

OUTPUT FORMAT: JSON object with:
- answer: Correct Spanish translation (with definite article)
- wrongAnswers: Array of exactly 6 unique challenging wrong Spanish translations (each with definite article)`;
}

// Build system prompt for adding a new word to an existing theme
function buildAddWordPrompt(themeName: string, newWord: string, existingWords: string[], wordType: "nouns" | "verbs" = "nouns"): string {
  const existingWordsList = existingWords.length > 0 ? existingWords.join(", ") : "(none)";
  
  if (wordType === "verbs") {
    return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate the correct Spanish infinitive translation and 6 challenging wrong infinitives for the English verb "${newWord}" to add to the theme "${themeName}".

EXISTING WORDS IN THEME (for context): ${existingWordsList}

REQUIREMENTS:
- The answer must be the correct Spanish infinitive for "${newWord}" (e.g., hablar, comer, vivir)
- NO articles (el/la) - verbs in infinitive form don't use articles
- If the verb is IRREGULAR in Spanish, end with "*" (e.g., "ir*", "ser*", "tener*")
- Provide exactly 6 wrong answers (Spanish infinitives)
- Wrong answers must be CHALLENGING and tricky:
  * Use similar-sounding Spanish verbs
  * Use verbs with subtle meaning differences
  * Include plausible Spanish verb alternatives that could fool a learner
  * Can include intentional grammar mistakes
  * NEVER use obviously wrong answers
  * All 6 wrong answers MUST be unique - NO DUPLICATES allowed
  * Wrong answers should also follow the irregular "*" convention if applicable

OUTPUT FORMAT: JSON object with:
- answer: Correct Spanish infinitive (with * if irregular)
- wrongAnswers: Array of exactly 6 unique challenging wrong Spanish infinitives`;
  }
  
  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate the correct Spanish translation and 6 challenging wrong answers for the English word "${newWord}" to add to the theme "${themeName}".

EXISTING WORDS IN THEME (for context): ${existingWordsList}

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
- ANSWER AND MULTIPLE CHOICES MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa")

OUTPUT FORMAT: JSON object with:
- answer: Correct Spanish translation (with definite article)
- wrongAnswers: Array of exactly 6 unique challenging wrong Spanish translations (each with definite article)`;
}

// Build system prompt for generating random words for an existing theme
function buildGenerateRandomWordsPrompt(themeName: string, count: number, existingWords: string[], wordType: "nouns" | "verbs" = "nouns"): string {
  const existingWordsList = existingWords.length > 0 ? existingWords.join(", ") : "(none)";
  
  if (wordType === "verbs") {
    return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly ${count} NEW English verbs for the theme "${themeName}" with Spanish infinitive translations.

EXISTING WORDS IN THEME (DO NOT DUPLICATE): ${existingWordsList}

REQUIREMENTS:
- Each word must be an English verb related to "${themeName}"
- The answer must be the Spanish INFINITIVE form (e.g., hablar, comer, vivir)
- NO articles (el/la) - verbs in infinitive form don't use articles
- If a verb is IRREGULAR in Spanish, end the Spanish infinitive with "*" (e.g., "ir*", "ser*", "tener*")
- Regular verbs should NOT have the "*" marker
- Each word needs exactly 6 wrong answers (Spanish infinitives)
- Wrong answers must be CHALLENGING and tricky:
  * Use similar-sounding Spanish verbs
  * Use verbs with subtle meaning differences
  * Include plausible Spanish verb alternatives that could fool a learner
  * Can include intentional grammar mistakes
  * All 6 wrong answers for each word MUST be unique - NO DUPLICATES allowed
  * Wrong answers should also follow the irregular "*" convention if applicable
- All ${count} new verbs must be unique and NOT duplicate any existing word
- Focus on practical, commonly used verbs

OUTPUT FORMAT: JSON object with "words" array containing ${count} objects, each with:
- word: English verb (e.g., "speak", "eat", "go")
- answer: Spanish infinitive (e.g., "hablar", "comer", "ir*")
- wrongAnswers: Array of exactly 6 challenging wrong Spanish infinitives`;
  }
  
  return `You are a Spanish language tutor creating vocabulary flashcards for English speakers learning Spanish.

TASK: Generate exactly ${count} NEW English vocabulary words for the theme "${themeName}" with Spanish translations.

EXISTING WORDS IN THEME (DO NOT DUPLICATE): ${existingWordsList}

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
- All ${count} new words must be unique and NOT duplicate any existing word
- Focus on practical, commonly used vocabulary
- ANSWER AND MULTIPLE CHOICES MUST CONTAIN DEFINITE ARTICLE (e.g., "el libro", "la casa")

OUTPUT FORMAT: JSON object with "words" array containing ${count} objects, each with:
- word: English word
- answer: Correct Spanish translation
- wrongAnswers: Array of exactly 6 challenging wrong Spanish translations`;
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
      
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...(body.history || []).map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: userMessage },
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
      const { themeName, wordType, newWord } = body;
      
      const systemPrompt = buildRegenerateForWordPrompt(themeName, newWord, wordType || "nouns");

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

    if (body.type === "add-word") {
      const { themeName, wordType, newWord, existingWords } = body;
      
      const systemPrompt = buildAddWordPrompt(themeName, newWord, existingWords, wordType || "nouns");

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
      
      // Validate count (1-10)
      const validCount = Math.min(Math.max(Math.floor(count), 1), 10);
      
      const systemPrompt = buildGenerateRandomWordsPrompt(themeName, validCount, existingWords, wordType || "nouns");

      const userMessage = wordType === "verbs"
        ? `Generate ${validCount} new Spanish verbs for the theme "${themeName}".`
        : `Generate ${validCount} new Spanish vocabulary words for the theme "${themeName}".`;

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ];

      const response = await openai.responses.create({
        model: "gpt-5.1-2025-11-13",
        reasoning: { effort: "low" },
        input: messages.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content as string })),
        text: {
          format: {
            type: "json_schema",
            name: "random_words",
            schema: createRandomWordsSchema(validCount),
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
