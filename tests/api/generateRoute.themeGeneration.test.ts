import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

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

function createJsonRequest(payload: unknown): NextRequest {
  return new NextRequest("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const WRONG_ANSWERS_TEMPLATE = [
  "la casa",
  "el gato",
  "la mesa",
  "el libro",
  "la flor",
  "el arbol",
] as const;

function invalidThemeWords(count: number) {
  return Array.from({ length: count }, () => ({
    word: "",
    answer: "el perro",
    wrongAnswers: [...WRONG_ANSWERS_TEMPLATE],
  }));
}

function validThemeWords(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    word: `word${i}`,
    answer: `el ans${i}`,
    wrongAnswers: Array.from({ length: 6 }, (_, j) => `el distractor-${i}-${j}`),
  }));
}

describe("/api/generate theme generation", () => {
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
    mutationMock.mockImplementation((mutationName: string) => {
      if (mutationName === "credits.consumeCredits") {
        return Promise.resolve({ creditTransactionId: "creditTransaction_1" });
      }
      return Promise.resolve(undefined);
    });
  });

  it("retries schema-invalid theme output and fails when the retry is still invalid", async () => {
    const invalidThemePayload = {
      output_text: JSON.stringify({
        words: invalidThemeWords(5),
      }),
    };

    responsesCreateMock
      .mockResolvedValueOnce(invalidThemePayload)
      .mockResolvedValueOnce(invalidThemePayload);

    const { POST } = await import("@/app/api/generate/route");
    const response = await POST(
      createJsonRequest({
        type: "theme",
        themeName: "Animals",
        wordType: "nouns",
        wordCount: 5,
      })
    );
    const payload = (await response.json()) as {
      success: boolean;
      error: string;
      validationIssues?: string[];
    };

    expect(response.status).toBe(502);
    expect(payload.success).toBe(false);
    expect(payload.error).toContain("Failed to generate valid content");
    expect(Array.isArray(payload.validationIssues)).toBe(true);
    expect(payload.validationIssues!.length).toBeGreaterThan(0);
    expect(responsesCreateMock).toHaveBeenCalledTimes(2);
    expect(mutationMock).toHaveBeenCalledTimes(2);
    expect(mutationMock).toHaveBeenNthCalledWith(1, "credits.consumeCredits", {
      creditType: "llm",
      cost: 10,
    });
    expect(mutationMock).toHaveBeenNthCalledWith(2, "credits.refundConsumedCredits", {
      creditTransactionId: "creditTransaction_1",
    });
  });

  it("consumes credits once when the retry produces a valid theme", async () => {
    const invalidThemePayload = {
      output_text: JSON.stringify({
        words: invalidThemeWords(5),
      }),
    };
    const validThemePayload = {
      output_text: JSON.stringify({
        words: validThemeWords(5),
      }),
    };

    responsesCreateMock
      .mockResolvedValueOnce(invalidThemePayload)
      .mockResolvedValueOnce(validThemePayload);

    const { POST } = await import("@/app/api/generate/route");
    const response = await POST(
      createJsonRequest({
        type: "theme",
        themeName: "Animals",
        wordType: "nouns",
        wordCount: 5,
      })
    );
    const payload = (await response.json()) as {
      success: boolean;
      data?: unknown;
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data).toHaveLength(5);
    expect(payload).not.toHaveProperty("prompt");
    expect(mutationMock).toHaveBeenCalledTimes(1);
    expect(responsesCreateMock).toHaveBeenCalledTimes(2);
  });
});
