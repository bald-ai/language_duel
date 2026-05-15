import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  THEME_ANSWER_INPUT_MAX_LENGTH,
  THEME_WORD_INPUT_MAX_LENGTH,
  THEME_WRONG_ANSWER_INPUT_MAX_LENGTH,
} from "@/lib/themes/constants";

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
    answer: `answer-${index}`,
    wrongAnswers: Array.from(
      { length: 6 },
      (__, wrongIndex) => `wrong-${index}-${wrongIndex}`
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
    name: "generate-random-words",
    request: {
      type: "generate-random-words",
      themeName: "Animals",
      count: 2,
      existingWords: ["cat"],
    },
    validOutput: { words: randomWordsValidWords },
    responseData: randomWordsValidWords,
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
    queryMock.mockResolvedValue({ llmCreditsRemaining: 10 });
    mutationMock.mockResolvedValue(undefined);
  });

  branchCases.forEach((branch) => {
    describe(branch.name, () => {
      branch.invalidCases.forEach((testCase) => {
        it(`rejects ${testCase.name} without consuming credits`, async () => {
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
          expect(mutationMock).not.toHaveBeenCalled();
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
        expect(responsesCreateMock).toHaveBeenCalledTimes(1);
        expect(mutationMock).toHaveBeenCalledTimes(1);
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
      currentWrongAnswers: sharedWrongAnswers.slice(0, 3),
      fieldIndex: 3,
    });
    const payload = (await response.json()) as { success: boolean; error: string };

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("fieldIndex");
    expect(responsesCreateMock).not.toHaveBeenCalled();
    expect(mutationMock).not.toHaveBeenCalled();
  });
});
