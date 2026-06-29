import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  THEME_ANSWER_INPUT_MAX_LENGTH,
  THEME_WORD_INPUT_MAX_LENGTH,
  THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
} from "@/lib/themes/constants";
import {
  LLM_ADD_SENTENCE_CREDITS,
  LLM_ADD_WORD_CREDITS,
  LLM_FIELD_REGEN_CREDITS,
  LLM_GENERATE_MORE_SENTENCES_CREDITS,
  LLM_GENERATE_MORE_WORDS_CREDITS,
  LLM_SENTENCE_THEME_CREDITS,
  LLM_SINGLE_WORD_REGEN_CREDITS,
  LLM_WORD_THEME_CREDITS,
} from "@/lib/credits/constants";

const {
  authMock,
  getTokenMock,
  queryMock,
  mutationMock,
  responsesCreateMock,
  setAuthMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getTokenMock: vi.fn(),
  queryMock: vi.fn(),
  mutationMock: vi.fn(),
  responsesCreateMock: vi.fn(),
  setAuthMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: authMock,
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth = setAuthMock;
    query = queryMock;
    mutation = mutationMock;
  },
}));

vi.mock("openai", () => ({
  default: class OpenAI {
    responses = {
      create: responsesCreateMock,
    };
  },
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    users: {
      getCurrentUser: "users.getCurrentUser",
    },
    credits: {
      consumeCredits: "credits.consumeCredits",
      refundConsumedCredits: "credits.refundConsumedCredits",
    },
  },
}));

type GeneratedEntry = {
  word: string;
  answer: string;
  wrongAnswers: string[];
};

type BranchCase = {
  name: string;
  request: Record<string, unknown>;
  validOutput: unknown;
  responseData: unknown;
  expectedCreditCost: number;
  invalidCases: Array<{
    name: string;
    output?: unknown;
    status?: number;
    expectedIssue: string;
    expectedOpenAiCalls?: number;
  }>;
};

function createJsonRequest(payload: unknown): NextRequest {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function openAiPayload(output: unknown) {
  return { output_text: JSON.stringify(output) };
}

function validEntry(overrides: Partial<GeneratedEntry> = {}): GeneratedEntry {
  return {
    word: "dog",
    answer: "el perro",
    wrongAnswers: [
      "el gato",
      "el pajaro",
      "el pez",
      "el caballo",
      "la vaca",
      "el raton",
    ],
    ...overrides,
  };
}

function longText(length: number) {
  return "x".repeat(length + 1);
}

function setupOpenAiFailure(output: unknown) {
  responsesCreateMock
    .mockResolvedValueOnce(openAiPayload(output))
    .mockResolvedValueOnce(openAiPayload(output));
}

async function postGenerate(payload: Record<string, unknown>) {
  const { POST } = await import("@/app/api/generate/route");
  return POST(createJsonRequest(payload));
}

const sharedWrongAnswers = [
  "el gato",
  "el pajaro",
  "el pez",
  "el caballo",
  "la vaca",
  "el raton",
];

const fieldBase = {
  type: "field",
  themeName: "Animals",
  currentWord: "dog",
  currentAnswer: "el perro",
  currentWrongAnswers: sharedWrongAnswers,
};

const validAnswerAndWrongs = {
  answer: "el perro",
  wrongAnswers: sharedWrongAnswers,
};

const themeValidWords = Array.from({ length: 5 }, (_, index) =>
  validEntry({
    word: `word-${index}`,
    answer: `el answer-${index}`,
    wrongAnswers: Array.from(
      { length: 6 },
      (__, wrongIndex) => `el wrong-${index}-${wrongIndex}`
    ),
  })
);

const randomWordsValidWords = [
  validEntry({ word: "dog" }),
  validEntry({
    word: "bird",
    answer: "el pajaro",
    wrongAnswers: [
      "el perro",
      "el gato",
      "el pez",
      "el caballo",
      "la vaca",
      "el raton",
    ],
  }),
];

const sentenceThemeRounds = [
  {
    englishPrompt: "I eat bread",
    spanishSentence: "Yo como pan",
    wordMeanings: ["I", "eat", "bread"],
    distractors: ["bebo", "libro", "rojo"],
  },
  {
    englishPrompt: "You drink water",
    spanishSentence: "Tu bebes agua",
    wordMeanings: ["you", "drink", "water"],
    distractors: ["como", "pan", "verde"],
  },
  {
    englishPrompt: "The cat sleeps",
    spanishSentence: "El gato duerme",
    wordMeanings: ["the", "cat", "sleeps"],
    distractors: ["perro", "come", "salta"],
  },
  {
    englishPrompt: "We read books",
    spanishSentence: "Nosotros leemos libros",
    wordMeanings: ["we", "read", "books"],
    distractors: ["ellos", "corren", "cartas"],
  },
  {
    englishPrompt: "She opens doors",
    spanishSentence: "Ella abre puertas",
    wordMeanings: ["she", "opens", "doors"],
    distractors: ["cierra", "ventanas", "lento"],
  },
];

const generateMoreSentenceRounds = [
  {
    englishPrompt: "He walks home",
    spanishSentence: "El camina casa",
    wordMeanings: ["he", "walks", "home"],
    distractors: ["corre", "calle", "azul"],
  },
  {
    englishPrompt: "They cook rice",
    spanishSentence: "Ellos cocinan arroz",
    wordMeanings: ["they", "cook", "rice"],
    distractors: ["comen", "pan", "rapido"],
  },
];

const branchCases: BranchCase[] = [
  {
    name: "theme",
    request: {
      type: "theme",
      themeName: "Animals",
      wordType: "nouns",
      wordCount: 5,
    },
    validOutput: { words: themeValidWords },
    responseData: themeValidWords,
    expectedCreditCost: LLM_WORD_THEME_CREDITS,
    invalidCases: [
      {
        name: "rule 1 word empty",
        output: { words: Array.from({ length: 5 }, () => validEntry({ word: "" })) },
        expectedIssue: "word must be at least 1 character",
      },
      {
        name: "rule 2 answer empty",
        output: { words: Array.from({ length: 5 }, () => validEntry({ answer: "" })) },
        expectedIssue: "answer must be at least 1 character",
      },
      {
        name: "rule 3 wrong answer empty",
        output: {
          words: Array.from({ length: 5 }, () =>
            validEntry({ wrongAnswers: ["", ...sharedWrongAnswers.slice(1)] })
          ),
        },
        expectedIssue: "wrong answer 1 must be at least 1 character",
      },
      {
        name: "rule 4 wrong answer count",
        output: {
          words: Array.from({ length: 5 }, (_, index) =>
            validEntry({ word: `word-${index}`, wrongAnswers: sharedWrongAnswers.slice(0, 2) })
          ),
        },
        expectedIssue: "wrong answers must contain",
      },
      {
        name: "rule 5 wrong matches answer",
        output: {
          words: Array.from({ length: 5 }, () =>
            validEntry({ wrongAnswers: ["el perro", ...sharedWrongAnswers.slice(1)] })
          ),
        },
        expectedIssue: "matches the correct answer",
      },
      {
        name: "rule 6 duplicate wrong answer",
        output: {
          words: Array.from({ length: 5 }, () =>
            validEntry({ wrongAnswers: ["el gato", "EL GATO", ...sharedWrongAnswers.slice(2)] })
          ),
        },
        expectedIssue: "are duplicates after normalization",
      },
      {
        name: "rule 7 duplicate generated words",
        output: {
          words: Array.from({ length: 5 }, (_, index) =>
            validEntry({ word: index < 2 ? "dog" : `word-${index}` })
          ),
        },
        expectedIssue: "are duplicates after normalization",
      },
    ],
  },
  {
    name: "add-word",
    request: {
      type: "add-word",
      themeName: "Animals",
      newWord: "dog",
      existingWords: ["cat"],
    },
    validOutput: validAnswerAndWrongs,
    responseData: validEntry(),
    expectedCreditCost: LLM_ADD_WORD_CREDITS,
    invalidCases: [
      {
        name: "rule 2 answer empty",
        output: { ...validAnswerAndWrongs, answer: "" },
        expectedIssue: "answer must be at least 1 character",
      },
      {
        name: "rule 3 wrong answer too long",
        output: {
          ...validAnswerAndWrongs,
          wrongAnswers: [
            longText(THEME_WRONG_ANSWER_INPUT_MAX_LENGTH),
            ...sharedWrongAnswers.slice(1),
          ],
        },
        expectedIssue: "wrong answer 1 must be at most",
      },
      {
        name: "rule 4 wrong answer count",
        output: { ...validAnswerAndWrongs, wrongAnswers: sharedWrongAnswers.slice(0, 2) },
        expectedIssue: "wrong answers must contain",
      },
      {
        name: "rule 5 wrong matches answer",
        output: {
          ...validAnswerAndWrongs,
          wrongAnswers: ["el perro", ...sharedWrongAnswers.slice(1)],
        },
        expectedIssue: "matches the correct answer",
      },
      {
        name: "rule 6 duplicate wrong answer",
        output: {
          ...validAnswerAndWrongs,
          wrongAnswers: ["el gato", "EL GATO", ...sharedWrongAnswers.slice(2)],
        },
        expectedIssue: "are duplicates after normalization",
      },
      {
        name: "rule 8 duplicate existing word",
        status: 400,
        expectedOpenAiCalls: 0,
        expectedIssue: "duplicates an existing word",
      },
    ],
  },
  {
    name: "regenerate-for-word",
    request: {
      type: "regenerate-for-word",
      themeName: "Animals",
      newWord: "dog",
    },
    validOutput: validAnswerAndWrongs,
    responseData: validAnswerAndWrongs,
    expectedCreditCost: LLM_SINGLE_WORD_REGEN_CREDITS,
    invalidCases: [
      {
        name: "rule 2 answer too long",
        output: {
          ...validAnswerAndWrongs,
          answer: longText(THEME_ANSWER_INPUT_MAX_LENGTH),
        },
        expectedIssue: "answer must be at most",
      },
      {
        name: "rule 3 wrong answer empty",
        output: {
          ...validAnswerAndWrongs,
          wrongAnswers: ["", ...sharedWrongAnswers.slice(1)],
        },
        expectedIssue: "wrong answer 1 must be at least 1 character",
      },
      {
        name: "rule 4 wrong answer count",
        output: { ...validAnswerAndWrongs, wrongAnswers: sharedWrongAnswers.slice(0, 2) },
        expectedIssue: "wrong answers must contain",
      },
      {
        name: "rule 5 wrong matches answer",
        output: {
          ...validAnswerAndWrongs,
          wrongAnswers: ["el perro", ...sharedWrongAnswers.slice(1)],
        },
        expectedIssue: "matches the correct answer",
      },
      {
        name: "rule 6 duplicate wrong answer",
        output: {
          ...validAnswerAndWrongs,
          wrongAnswers: ["el gato", "EL GATO", ...sharedWrongAnswers.slice(2)],
        },
        expectedIssue: "are duplicates after normalization",
      },
    ],
  },
  {
    name: "generate-more-words",
    request: {
      type: "generate-more-words",
      themeName: "Animals",
      count: 2,
      existingWords: ["cat"],
    },
    validOutput: { words: randomWordsValidWords },
    responseData: randomWordsValidWords,
    expectedCreditCost: LLM_GENERATE_MORE_WORDS_CREDITS,
    invalidCases: [
      {
        name: "rule 1 word too long",
        output: { words: [validEntry({ word: longText(THEME_WORD_INPUT_MAX_LENGTH) })] },
        expectedIssue: "word must be at most",
      },
      {
        name: "rule 2 answer empty",
        output: { words: [validEntry({ answer: "" })] },
        expectedIssue: "answer must be at least 1 character",
      },
      {
        name: "rule 3 wrong answer empty",
        output: { words: [validEntry({ wrongAnswers: ["", ...sharedWrongAnswers.slice(1)] })] },
        expectedIssue: "wrong answer 1 must be at least 1 character",
      },
      {
        name: "rule 4 wrong answer count",
        output: { words: [validEntry({ wrongAnswers: sharedWrongAnswers.slice(0, 2) })] },
        expectedIssue: "wrong answers must contain",
      },
      {
        name: "rule 5 wrong matches answer",
        output: {
          words: [validEntry({ wrongAnswers: ["el perro", ...sharedWrongAnswers.slice(1)] })],
        },
        expectedIssue: "matches the correct answer",
      },
      {
        name: "rule 6 duplicate wrong answer",
        output: {
          words: [validEntry({ wrongAnswers: ["el gato", "EL GATO", ...sharedWrongAnswers.slice(2)] })],
        },
        expectedIssue: "are duplicates after normalization",
      },
      {
        name: "rule 7 duplicate generated words",
        output: { words: [validEntry({ word: "dog" }), validEntry({ word: "DOG" })] },
        expectedIssue: "are duplicates after normalization",
      },
      {
        name: "rule 8 duplicate existing word",
        output: { words: [validEntry({ word: "cat" })] },
        expectedIssue: "duplicates an existing word",
      },
    ],
  },
  {
    name: "field word",
    request: {
      ...fieldBase,
      fieldType: "word",
      existingWords: ["cat"],
      rejectedWords: ["bird"],
    },
    validOutput: validEntry({ word: "dog" }),
    responseData: validEntry({ word: "dog" }),
    expectedCreditCost: LLM_FIELD_REGEN_CREDITS,
    invalidCases: [
      {
        name: "rule 1 word empty",
        output: validEntry({ word: "" }),
        expectedIssue: "word must be at least 1 character",
      },
      {
        name: "rule 2 answer empty",
        output: validEntry({ answer: "" }),
        expectedIssue: "answer must be at least 1 character",
      },
      {
        name: "rule 3 wrong answer empty",
        output: validEntry({ wrongAnswers: ["", ...sharedWrongAnswers.slice(1)] }),
        expectedIssue: "wrong answer 1 must be at least 1 character",
      },
      {
        name: "rule 4 wrong answer count",
        output: validEntry({ wrongAnswers: sharedWrongAnswers.slice(0, 2) }),
        expectedIssue: "wrong answers must contain",
      },
      {
        name: "rule 5 wrong matches answer",
        output: validEntry({ wrongAnswers: ["el perro", ...sharedWrongAnswers.slice(1)] }),
        expectedIssue: "matches the correct answer",
      },
      {
        name: "rule 6 duplicate wrong answer",
        output: validEntry({ wrongAnswers: ["el gato", "EL GATO", ...sharedWrongAnswers.slice(2)] }),
        expectedIssue: "are duplicates after normalization",
      },
      {
        name: "rule 8 duplicate existing word",
        output: validEntry({ word: "cat" }),
        expectedIssue: "duplicates an existing word",
      },
      {
        name: "rule 8 duplicate rejected word",
        output: validEntry({ word: "bird" }),
        expectedIssue: "duplicates a previously rejected word",
      },
    ],
  },
  {
    name: "field answer",
    request: {
      ...fieldBase,
      fieldType: "answer",
    },
    validOutput: { answer: "el can" },
    responseData: { answer: "el can" },
    expectedCreditCost: LLM_FIELD_REGEN_CREDITS,
    invalidCases: [
      {
        name: "rule 2 answer empty",
        output: { answer: "" },
        expectedIssue: "answer must be at least 1 character",
      },
      {
        name: "rule 5 answer matches wrong answer",
        output: { answer: "EL GATO" },
        expectedIssue: "matches wrong answer",
      },
    ],
  },
  {
    name: "field wrong",
    request: {
      ...fieldBase,
      fieldType: "wrong",
      fieldIndex: 1,
    },
    validOutput: { wrongAnswer: "el lobo" },
    responseData: { wrongAnswer: "el lobo" },
    expectedCreditCost: LLM_FIELD_REGEN_CREDITS,
    invalidCases: [
      {
        name: "rule 3 wrong answer empty",
        output: { wrongAnswer: "" },
        expectedIssue: "wrong answer 2 must be at least 1 character",
      },
      {
        name: "rule 5 wrong answer matches answer",
        output: { wrongAnswer: "EL PERRO" },
        expectedIssue: "matches the correct answer",
      },
      {
        name: "rule 6 wrong answer duplicates another wrong",
        output: { wrongAnswer: "el pez" },
        expectedIssue: "are duplicates after normalization",
      },
    ],
  },
  {
    name: "sentence-theme",
    request: {
      type: "sentence-theme",
      themeName: "Daily life",
      roundCount: 5,
    },
    validOutput: { rounds: sentenceThemeRounds },
    responseData: sentenceThemeRounds,
    expectedCreditCost: LLM_SENTENCE_THEME_CREDITS,
    invalidCases: [
      {
        name: "word meanings count",
        output: {
          rounds: sentenceThemeRounds.map((round, index) =>
            index === 0 ? { ...round, wordMeanings: ["I"] } : round
          ),
        },
        expectedIssue: "word meanings must match",
      },
    ],
  },
  {
    name: "add-sentence-round",
    request: {
      type: "add-sentence-round",
      themeName: "Daily life",
      englishPrompt: "The cat sleeps",
      existingEnglishPrompts: ["I eat bread"],
      existingSpanishSentences: ["Yo como pan"],
    },
    validOutput: { rounds: [sentenceThemeRounds[2]!] },
    responseData: { ...sentenceThemeRounds[2]!, freeWordPositions: [] },
    expectedCreditCost: LLM_ADD_SENTENCE_CREDITS,
    invalidCases: [
      {
        name: "word meanings count",
        output: {
          rounds: [{ ...sentenceThemeRounds[2]!, wordMeanings: ["the"] }],
        },
        expectedIssue: "word meanings must match",
      },
      {
        name: "duplicate existing sentence",
        output: {
          rounds: [sentenceThemeRounds[0]!],
        },
        expectedIssue: "duplicates an existing sentence",
      },
    ],
  },
  {
    name: "generate-more-sentence-rounds",
    request: {
      type: "generate-more-sentence-rounds",
      themeName: "Daily life",
      roundCount: 2,
      existingSpanishSentences: ["Yo como pan"],
    },
    validOutput: { rounds: generateMoreSentenceRounds },
    responseData: generateMoreSentenceRounds,
    expectedCreditCost: LLM_GENERATE_MORE_SENTENCES_CREDITS,
    invalidCases: [
      {
        name: "duplicate existing sentence",
        output: {
          rounds: [
            sentenceThemeRounds[0]!,
            generateMoreSentenceRounds[1]!,
          ],
        },
        expectedIssue: "duplicates an existing sentence",
      },
    ],
  },
];

describe("/api/generate semantic validation", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    getTokenMock.mockReset();
    queryMock.mockReset();
    mutationMock.mockReset();
    responsesCreateMock.mockReset();
    setAuthMock.mockReset();

    process.env.NEXT_PUBLIC_CONVEX_URL = "https://convex.example";
    process.env.OPEN_AI_API_KEY = "test-key";

    getTokenMock.mockResolvedValue("convex-token");
    authMock.mockResolvedValue({
      userId: "user_1",
      getToken: getTokenMock,
    });
    queryMock.mockResolvedValue({ llmCreditsRemaining: 100 });
    mutationMock.mockImplementation((mutationName: string) => {
      if (mutationName === "credits.consumeCredits") {
        return Promise.resolve({ creditTransactionId: "creditTransaction_1" });
      }
      return Promise.resolve(undefined);
    });
  });

  branchCases.forEach((branch) => {
    describe(branch.name, () => {
      branch.invalidCases.forEach((testCase) => {
        it(`rejects ${testCase.name} without permanently consuming credits`, async () => {
          if (testCase.output !== undefined) {
            setupOpenAiFailure(testCase.output);
          }

          const request =
            branch.name === "add-word" && testCase.status === 400
              ? { ...branch.request, newWord: "cat" }
              : branch.request;
          const response = await postGenerate(request);
          const payload = (await response.json()) as {
            success: boolean;
            error: string;
            validationIssues?: string[];
          };

          expect(response.status).toBe(testCase.status ?? 502);
          expect(payload.success).toBe(false);
          expect(payload.error).toContain("Failed to generate valid content");
          expect(payload.validationIssues?.join("\n")).toContain(testCase.expectedIssue);
          expect(responsesCreateMock).toHaveBeenCalledTimes(
            testCase.expectedOpenAiCalls ?? 2
          );
          if ((testCase.expectedOpenAiCalls ?? 2) === 0) {
            expect(mutationMock).not.toHaveBeenCalled();
          } else {
            expect(mutationMock).toHaveBeenCalledTimes(2);
            expect(mutationMock).toHaveBeenNthCalledWith(1, "credits.consumeCredits", {
              creditType: "llm",
              cost: branch.expectedCreditCost,
            });
            expect(mutationMock).toHaveBeenNthCalledWith(2, "credits.refundConsumedCredits", {
              creditTransactionId: "creditTransaction_1",
            });
          }
        });
      });

      it("succeeds and consumes credits once with valid first output", async () => {
        responsesCreateMock.mockResolvedValueOnce(openAiPayload(branch.validOutput));

        const response = await postGenerate(branch.request);
        const payload = (await response.json()) as {
          success: boolean;
          data?: unknown;
        };

        expect(response.status).toBe(200);
        expect(payload.success).toBe(true);
        expect(payload.data).toEqual(branch.responseData);
        expect(payload).not.toHaveProperty("prompt");
        expect(responsesCreateMock).toHaveBeenCalledTimes(1);
        expect(mutationMock).toHaveBeenCalledTimes(1);
        expect(mutationMock).toHaveBeenCalledWith("credits.consumeCredits", {
          creditType: "llm",
          cost: branch.expectedCreditCost,
        });
      });

      if (branch.name !== "theme") {
        it("retries once and consumes credits once when retry succeeds", async () => {
          const invalidOutput = branch.invalidCases.find(
            (testCase) => testCase.output !== undefined
          )?.output;
          expect(invalidOutput).toBeDefined();
          responsesCreateMock
            .mockResolvedValueOnce(openAiPayload(invalidOutput))
            .mockResolvedValueOnce(openAiPayload(branch.validOutput));

          const response = await postGenerate(branch.request);
          const payload = (await response.json()) as {
            success: boolean;
            data?: unknown;
          };

          expect(response.status).toBe(200);
          expect(payload.success).toBe(true);
          expect(payload.data).toEqual(branch.responseData);
          expect(responsesCreateMock).toHaveBeenCalledTimes(2);
          expect(mutationMock).toHaveBeenCalledTimes(1);
          expect(mutationMock).toHaveBeenCalledWith("credits.consumeCredits", {
            creditType: "llm",
            cost: branch.expectedCreditCost,
          });
        });
      }
    });
  });

  it("rejects missing fieldIndex for field wrong before calling OpenAI", async () => {
    const response = await postGenerate({
      ...fieldBase,
      fieldType: "wrong",
    });
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("fieldIndex");
    expect(responsesCreateMock).not.toHaveBeenCalled();
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("rejects out-of-list fieldIndex for field wrong before calling OpenAI", async () => {
    const response = await postGenerate({
      ...fieldBase,
      fieldType: "wrong",
      currentWrongAnswers: sharedWrongAnswers,
      fieldIndex: sharedWrongAnswers.length,
    });
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("fieldIndex");
    expect(responsesCreateMock).not.toHaveBeenCalled();
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("rejects duplicate add-sentence English prompt before calling OpenAI", async () => {
    const response = await postGenerate({
      type: "add-sentence-round",
      themeName: "Daily life",
      englishPrompt: "the CAT sleeps",
      existingEnglishPrompts: ["The cat sleeps"],
      existingSpanishSentences: [],
    });
    const payload = (await response.json()) as {
      success: boolean;
      error: string;
      validationIssues?: string[];
    };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("Failed to generate valid content");
    expect(payload.validationIssues?.join("\n")).toContain("duplicates existing sentence prompt");
    expect(responsesCreateMock).not.toHaveBeenCalled();
    expect(mutationMock).not.toHaveBeenCalled();
  });

  it("does not call OpenAI when credits cannot be consumed", async () => {
    mutationMock.mockImplementation((mutationName: string) => {
      if (mutationName === "credits.consumeCredits") {
        const error = new Error("LLM credits exhausted") as Error & {
          data: { code: string };
        };
        error.data = { code: "CREDITS_EXHAUSTED" };
        return Promise.reject(error);
      }
      return Promise.resolve(undefined);
    });

    const response = await postGenerate(branchCases[0]!.request);
    const payload = (await response.json()) as { success: boolean; code?: string };

    expect(response.status).toBe(402);
    expect(payload.success).toBe(false);
    expect(payload.code).toBe("CREDITS_EXHAUSTED");
    expect(mutationMock).toHaveBeenCalledOnce();
    expect(mutationMock).toHaveBeenCalledWith("credits.consumeCredits", {
      creditType: "llm",
      cost: LLM_WORD_THEME_CREDITS,
    });
    expect(responsesCreateMock).not.toHaveBeenCalled();
  });

  it("consumes LLM credits before calling OpenAI", async () => {
    responsesCreateMock.mockResolvedValueOnce(openAiPayload(branchCases[0]!.validOutput));

    const response = await postGenerate(branchCases[0]!.request);

    expect(response.status).toBe(200);
    expect(mutationMock).toHaveBeenCalledWith("credits.consumeCredits", {
      creditType: "llm",
      cost: LLM_WORD_THEME_CREDITS,
    });
    expect(mutationMock.mock.invocationCallOrder[0]).toBeLessThan(
      responsesCreateMock.mock.invocationCallOrder[0]!
    );
  });
});
