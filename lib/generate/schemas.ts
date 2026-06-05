// JSON schemas for structured output from OpenAI (responses API json_schema format)

import { WRONG_ANSWER_COUNT } from "@/lib/generate/constants";

export function buildThemeSchema(wordCount: number) {
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
              minItems: WRONG_ANSWER_COUNT,
              maxItems: WRONG_ANSWER_COUNT,
            },
          },
          required: ["word", "answer", "wrongAnswers"],
          additionalProperties: false,
        },
        minItems: wordCount,
        maxItems: wordCount,
      },
    },
    required: ["words"],
    additionalProperties: false,
  };
}

export const wordSchema = {
  type: "object" as const,
  properties: {
    word: { type: "string" as const },
    answer: { type: "string" as const },
    wrongAnswers: {
      type: "array" as const,
      items: { type: "string" as const },
      minItems: WRONG_ANSWER_COUNT,
      maxItems: WRONG_ANSWER_COUNT,
    },
  },
  required: ["word", "answer", "wrongAnswers"],
  additionalProperties: false,
};

export const answerSchema = {
  type: "object" as const,
  properties: {
    answer: { type: "string" as const },
  },
  required: ["answer"],
  additionalProperties: false,
};

export const wrongAnswerSchema = {
  type: "object" as const,
  properties: {
    wrongAnswer: { type: "string" as const },
  },
  required: ["wrongAnswer"],
  additionalProperties: false,
};

// Schema for regenerating answer + wrong answers for a manually edited word
export const answerAndWrongsSchema = {
  type: "object" as const,
  properties: {
    answer: { type: "string" as const },
    wrongAnswers: {
      type: "array" as const,
      items: { type: "string" as const },
      minItems: WRONG_ANSWER_COUNT,
      maxItems: WRONG_ANSWER_COUNT,
    },
  },
  required: ["answer", "wrongAnswers"],
  additionalProperties: false,
};

export function createGenerateMoreWordsSchema(count: number) {
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
              minItems: WRONG_ANSWER_COUNT,
              maxItems: WRONG_ANSWER_COUNT,
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

// ============================================================================
// Sentence Theme Generation Schemas
// ============================================================================

import { SENTENCE_DISTRACTOR_COUNT } from "@/lib/themes/sentenceConstants";

function sentenceRoundItemSchema() {
  return {
    type: "object" as const,
    properties: {
      englishPrompt: { type: "string" as const },
      spanishSentence: { type: "string" as const },
      wordMeanings: {
        type: "array" as const,
        items: { type: "string" as const },
      },
      distractors: {
        type: "array" as const,
        items: { type: "string" as const },
        minItems: SENTENCE_DISTRACTOR_COUNT,
        maxItems: SENTENCE_DISTRACTOR_COUNT,
      },
    },
    required: ["englishPrompt", "spanishSentence", "wordMeanings", "distractors"],
    additionalProperties: false,
  };
}

export function buildSentenceThemeSchema(roundCount: number) {
  return {
    type: "object" as const,
    properties: {
      rounds: {
        type: "array" as const,
        items: sentenceRoundItemSchema(),
        minItems: roundCount,
        maxItems: roundCount,
      },
    },
    required: ["rounds"],
    additionalProperties: false,
  };
}

export function buildGenerateMoreSentenceRoundsSchema(roundCount: number) {
  return buildSentenceThemeSchema(roundCount);
}
