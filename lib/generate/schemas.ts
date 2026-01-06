// JSON schemas for structured output from OpenAI (responses API json_schema format)

export const themeSchema = {
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
      minItems: 10,
      maxItems: 10,
    },
  },
  required: ["words"],
  additionalProperties: false,
};

export const wordSchema = {
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
      minItems: 6,
      maxItems: 6,
    },
  },
  required: ["answer", "wrongAnswers"],
  additionalProperties: false,
};

// Function to create schema for generating N random words
export function createRandomWordsSchema(count: number) {
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


