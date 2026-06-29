import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { TTS_GENERATION_COST } from "@/lib/credits/constants";

const {
  authMock,
  getTokenMock,
  queryMock,
  mutationMock,
  setAuthMock,
  generateTtsAudioWithFallbackMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  getTokenMock: vi.fn(),
  queryMock: vi.fn(),
  mutationMock: vi.fn(),
  setAuthMock: vi.fn(),
  generateTtsAudioWithFallbackMock: vi.fn(),
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

vi.mock("@/lib/tts/providerAdapters", () => ({
  generateTtsAudioWithFallback: generateTtsAudioWithFallbackMock,
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
  return new NextRequest("http://localhost/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function postTts(text = "hola") {
  const { POST } = await import("@/app/api/tts/route");
  return POST(createJsonRequest({ text }));
}

describe("/api/tts credit accounting", () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    getTokenMock.mockReset();
    queryMock.mockReset();
    mutationMock.mockReset();
    setAuthMock.mockReset();
    generateTtsAudioWithFallbackMock.mockReset();

    process.env.NEXT_PUBLIC_CONVEX_URL = "https://convex.example";

    getTokenMock.mockResolvedValue("convex-token");
    authMock.mockResolvedValue({
      userId: "user_1",
      getToken: getTokenMock,
    });
    queryMock.mockResolvedValue({
      ttsProvider: "resemble",
      ttsGenerationsRemaining: 100,
    });
    mutationMock.mockImplementation((mutationName: string) => {
      if (mutationName === "credits.consumeCredits") {
        return Promise.resolve({ creditTransactionId: "creditTransaction_1" });
      }
      return Promise.resolve(undefined);
    });
  });

  it("does not call the TTS provider when credits cannot be consumed", async () => {
    mutationMock.mockImplementation((mutationName: string) => {
      if (mutationName === "credits.consumeCredits") {
        const error = new Error("TTS credits exhausted") as Error & {
          data: { code: string };
        };
        error.data = { code: "CREDITS_EXHAUSTED" };
        return Promise.reject(error);
      }
      return Promise.resolve(undefined);
    });

    const response = await postTts();
    const payload = (await response.json()) as { code?: string };

    expect(response.status).toBe(402);
    expect(payload.code).toBe("CREDITS_EXHAUSTED");
    expect(mutationMock).toHaveBeenCalledOnce();
    expect(mutationMock).toHaveBeenCalledWith("credits.consumeCredits", {
      creditType: "tts",
      cost: TTS_GENERATION_COST,
    });
    expect(generateTtsAudioWithFallbackMock).not.toHaveBeenCalled();
  });

  it("refunds the TTS credit when the provider returns no audio", async () => {
    generateTtsAudioWithFallbackMock.mockResolvedValueOnce(null);

    const response = await postTts();
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(500);
    expect(payload.error).toContain("TTS generation failed");
    expect(generateTtsAudioWithFallbackMock).toHaveBeenCalledOnce();
    expect(mutationMock).toHaveBeenNthCalledWith(1, "credits.consumeCredits", {
      creditType: "tts",
      cost: TTS_GENERATION_COST,
    });
    expect(mutationMock).toHaveBeenNthCalledWith(2, "credits.refundConsumedCredits", {
      creditTransactionId: "creditTransaction_1",
    });
  });

  it("consumes TTS credits before calling the provider on success", async () => {
    generateTtsAudioWithFallbackMock.mockResolvedValueOnce({
      audioBuffer: new Uint8Array([1, 2, 3]).buffer,
      provider: "resemble",
      contentType: "audio/wav",
    });

    const response = await postTts();

    expect(response.status).toBe(200);
    expect(mutationMock).toHaveBeenCalledTimes(1);
    expect(generateTtsAudioWithFallbackMock).toHaveBeenCalledOnce();
    expect(mutationMock.mock.invocationCallOrder[0]).toBeLessThan(
      generateTtsAudioWithFallbackMock.mock.invocationCallOrder[0]!
    );
  });
});
