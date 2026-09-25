import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { ActionCtx } from "@/convex/_generated/server";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { generateThemeTtsForCurrentUser } from "@/convex/themes/generateThemeTtsAction";
import { generateTtsAudioWithFallback } from "@/lib/tts/providerAdapters";
import { TTS_GENERATION_COST } from "@/lib/credits/constants";

vi.mock("@/lib/tts/providerAdapters", () => ({
  generateTtsAudioWithFallback: vi.fn(),
}));
const themeId = "theme" as Id<"themes">;
const userId = "user" as Id<"users">;
const word = {
  word: "cat",
  answer: "gato (irr)",
  wrongAnswers: ["perro", "pan", "agua"],
};
const theme: Doc<"themes"> = {
  _id: themeId,
  _creationTime: 1,
  createdAt: 1,
  ownerId: userId,
  contentType: "word",
  name: "Animals",
  description: "",
  words: [word],
};
const audio = {
  audioBuffer: new Uint8Array([1, 2, 3]).buffer,
  contentType: "audio/wav",
  provider: "resemble" as const,
};
type Ref = FunctionReference<"query" | "mutation">;
type Call = { name: string; args: Record<string, unknown> };
function fixture(
  options: {
    user?: boolean;
    theme?: Doc<"themes"> | null;
    credits?: number;
  } = {},
) {
  const calls: Call[] = [];
  let creditId = 0;
  let storageId = 0;
  const apply = vi.fn(async (args: Record<string, unknown>) => ({
    applied: (args.generated as unknown[]).length,
    skipped: 0,
    rejectedStorageIds: [] as string[],
  }));
  const consume = vi.fn(async () => ({
    creditTransactionId: `credit_${++creditId}`,
  }));
  const refund = vi.fn(async (_args: Record<string, unknown>) => undefined);
  const acquire = vi.fn(async () => undefined);
  const release = vi.fn(async () => undefined);
  const ctx = {
    runQuery: vi.fn(async (ref: Ref) => {
      const name = getFunctionName(ref);
      if (name === "users:getCurrentUser")
        return options.user === false
          ? null
          : { _id: userId, ttsGenerationsRemaining: options.credits ?? 10 };
      if (name === "themes:getThemeForStoredTtsEditor")
        return options.theme === undefined ? theme : options.theme;
      throw new Error(`Unexpected query ${name}`);
    }),
    runMutation: vi.fn(async (ref: Ref, args: Record<string, unknown>) => {
      const name = getFunctionName(ref);
      calls.push({ name, args });
      switch (name) {
        case "credits:consumeCredits":
          return consume();
        case "credits:refundConsumedCredits":
          return refund(args);
        case "ttsGenerationLocks:acquireTtsGenerationLock":
          return acquire();
        case "ttsGenerationLocks:releaseTtsGenerationLock":
          return release();
        case "themes:applyGeneratedThemeTts":
          return apply(args);
        default:
          throw new Error(`Unexpected mutation ${name}`);
      }
    }),
    storage: {
      store: vi.fn(
        async (_blob: Blob) => `storage_${++storageId}` as Id<"_storage">,
      ),
      delete: vi.fn(async (_id: Id<"_storage">) => undefined),
    },
  };
  return {
    ctx,
    calls,
    apply,
    consume,
    refund,
    acquire,
    release,
    run: () =>
      generateThemeTtsForCurrentUser(ctx as unknown as ActionCtx, themeId),
  };
}

describe("stored theme audio generation action", () => {
  beforeEach(() => {
    vi.mocked(generateTtsAudioWithFallback)
      .mockReset()
      .mockResolvedValue(audio);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each([{ user: false }, { theme: null }])(
    "requires an authenticated editor before charging or generating",
    async (options) => {
      const f = fixture(options);
      await expect(f.run()).rejects.toThrow(
        options.user === false ? "Unauthorized" : "permission",
      );
      expect(f.calls).toEqual([]);
      expect(generateTtsAudioWithFallback).not.toHaveBeenCalled();
    },
  );

  it("returns an up-to-date result without locking or charging", async () => {
    const f = fixture({
      theme: {
        ...theme,
        words: [{ ...word, ttsStorageId: "existing" as Id<"_storage"> }],
      },
    });
    await expect(f.run()).resolves.toEqual({
      totalMissing: 0,
      attempted: 0,
      generated: 0,
      applied: 0,
      skippedStale: 0,
      failed: 0,
      skippedForCredits: 0,
      alreadyUpToDate: true,
    });
    expect(f.calls).toEqual([]);
  });

  it("reports missing audio skipped for zero credits without locking", async () => {
    const f = fixture({ credits: 0 });
    await expect(f.run()).resolves.toEqual({
      totalMissing: 1,
      attempted: 0,
      generated: 0,
      applied: 0,
      skippedStale: 0,
      failed: 0,
      skippedForCredits: 1,
      alreadyUpToDate: false,
    });
    expect(f.calls).toEqual([]);
    expect(generateTtsAudioWithFallback).not.toHaveBeenCalled();
  });

  it("limits generation to available credits and applies the original row index and signature", async () => {
    const f = fixture({
      credits: 1,
      theme: {
        ...theme,
        words: [
          { ...word, ttsStorageId: "existing" as Id<"_storage"> },
          word,
          { ...word, word: "dog", answer: "perro" },
        ],
      },
    });
    await expect(f.run()).resolves.toEqual({
      totalMissing: 2,
      attempted: 1,
      generated: 1,
      applied: 1,
      skippedStale: 0,
      failed: 0,
      skippedForCredits: 1,
      alreadyUpToDate: false,
    });
    expect(generateTtsAudioWithFallback).toHaveBeenCalledExactlyOnceWith({
      text: "gato",
    });
    expect(f.ctx.storage.store.mock.calls[0][0].type).toBe("audio/wav");
    expect(f.apply).toHaveBeenCalledExactlyOnceWith({
      themeId,
      generated: [
        {
          index: 1,
          sourceSignature: JSON.stringify(["cat", "gato (irr)"]),
          storageId: "storage_1",
        },
      ],
    });
    expect(
      f.calls.find((call) => call.name === "credits:consumeCredits")?.args,
    ).toEqual({ creditType: "tts", cost: TTS_GENERATION_COST });
    const lock = f.calls[0];
    expect(lock).toEqual({
      name: "ttsGenerationLocks:acquireTtsGenerationLock",
      args: { userId, token: expect.any(String), lockMs: 600_000 },
    });
    expect(f.calls.at(-1)).toEqual({
      name: "ttsGenerationLocks:releaseTtsGenerationLock",
      args: { userId, token: lock.args.token },
    });
    expect(f.refund).not.toHaveBeenCalled();
  });

  it("voices Spanish sentence content and includes its full source signature", async () => {
    const f = fixture({
      theme: {
        _id: themeId,
        _creationTime: 1,
        createdAt: 1,
        ownerId: userId,
        name: "Sentences",
        description: "",
        contentType: "sentence",
        sentenceRounds: [
          {
            englishPrompt: "The cat sleeps",
            spanishSentence: "El gato duerme",
            wordMeanings: ["The", "cat", "sleeps"],
            freeWordPositions: [],
            distractors: ["pan", "agua", "perro"],
          },
        ],
      },
    });
    await expect(f.run()).resolves.toMatchObject({ generated: 1, applied: 1 });
    expect(generateTtsAudioWithFallback).toHaveBeenCalledWith({
      text: "El gato duerme",
    });
    expect(f.apply).toHaveBeenCalledWith({
      themeId,
      generated: [
        {
          index: 0,
          sourceSignature: JSON.stringify(["The cat sleeps", "El gato duerme"]),
          storageId: "storage_1",
        },
      ],
    });
  });

  it.each(["provider", "empty audio", "storage"])(
    "refunds charged work when %s fails and releases the lock",
    async (failure) => {
      const f = fixture();
      if (failure === "provider")
        vi.mocked(generateTtsAudioWithFallback).mockRejectedValue(
          new Error("provider unavailable"),
        );
      if (failure === "empty audio")
        vi.mocked(generateTtsAudioWithFallback).mockResolvedValue(null);
      if (failure === "storage")
        f.ctx.storage.store.mockRejectedValue(new Error("storage unavailable"));
      await expect(f.run()).resolves.toMatchObject({
        attempted: 1,
        generated: 0,
        failed: 1,
        applied: 0,
      });
      expect(f.refund).toHaveBeenCalledExactlyOnceWith({
        creditTransactionId: "credit_1",
      });
      expect(f.apply).not.toHaveBeenCalled();
      expect(f.release).toHaveBeenCalledOnce();
    },
  );

  it("does not refund a failed credit reservation or invoke the provider", async () => {
    const f = fixture();
    f.consume.mockRejectedValue(new Error("credits exhausted concurrently"));
    await expect(f.run()).resolves.toMatchObject({
      attempted: 1,
      generated: 0,
      failed: 1,
    });
    expect(f.refund).not.toHaveBeenCalled();
    expect(generateTtsAudioWithFallback).not.toHaveBeenCalled();
    expect(f.release).toHaveBeenCalledOnce();
  });

  it("keeps successful sibling audio when another target fails", async () => {
    const f = fixture({
      theme: {
        ...theme,
        words: [word, { ...word, word: "dog", answer: "perro" }],
      },
    });
    vi.mocked(generateTtsAudioWithFallback)
      .mockRejectedValueOnce(new Error("one target failed"))
      .mockResolvedValueOnce(audio);
    await expect(f.run()).resolves.toMatchObject({
      attempted: 2,
      generated: 1,
      applied: 1,
      failed: 1,
    });
    expect(f.apply).toHaveBeenCalledWith({
      themeId,
      generated: [
        {
          index: 1,
          sourceSignature: JSON.stringify(["dog", "perro"]),
          storageId: "storage_1",
        },
      ],
    });
    expect(f.refund).toHaveBeenCalledExactlyOnceWith({
      creditTransactionId: "credit_1",
    });
  });

  it("deletes rejected stale audio and refunds only the associated transaction", async () => {
    const f = fixture({
      theme: {
        ...theme,
        words: [word, { ...word, word: "dog", answer: "perro" }],
      },
    });
    f.apply.mockResolvedValue({
      applied: 1,
      skipped: 1,
      rejectedStorageIds: ["storage_2"],
    });
    await expect(f.run()).resolves.toMatchObject({
      attempted: 2,
      generated: 2,
      applied: 1,
      skippedStale: 1,
      failed: 0,
    });
    expect(f.ctx.storage.delete).toHaveBeenCalledExactlyOnceWith("storage_2");
    expect(f.refund).toHaveBeenCalledExactlyOnceWith({
      creditTransactionId: "credit_2",
    });
    expect(f.release).toHaveBeenCalledOnce();
  });

  it("cleans up all generated files and refunds all charges when applying fails", async () => {
    const f = fixture({ theme: { ...theme, words: [word, word] } });
    f.apply.mockRejectedValue(new Error("apply failed"));
    await expect(f.run()).rejects.toThrow("apply failed");
    expect(f.ctx.storage.delete.mock.calls.map(([id]) => id)).toEqual([
      "storage_1",
      "storage_2",
    ]);
    expect(f.refund.mock.calls.map(([args]) => args)).toEqual([
      { creditTransactionId: "credit_1" },
      { creditTransactionId: "credit_2" },
    ]);
    expect(f.release).toHaveBeenCalledOnce();
  });

  it("preserves the generation outcome when refund and release services fail", async () => {
    const f = fixture();
    vi.mocked(generateTtsAudioWithFallback).mockRejectedValue(
      new Error("generation failed"),
    );
    f.refund.mockRejectedValue(new Error("refund failed"));
    f.release.mockRejectedValue(new Error("release failed"));
    await expect(f.run()).resolves.toMatchObject({ failed: 1, generated: 0 });
    expect(console.error).toHaveBeenCalledWith(
      "[Theme TTS] Failed to refund TTS credit:",
      expect.any(Error),
    );
    expect(console.error).toHaveBeenCalledWith(
      "[Theme TTS] Failed to release generation lock:",
      expect.any(Error),
    );
  });

  it("rejects a held lock before charging and leaves its ownership intact", async () => {
    const f = fixture();
    f.acquire.mockRejectedValue(new Error("generation already in progress"));
    await expect(f.run()).rejects.toThrow("generation already in progress");
    expect(f.consume).not.toHaveBeenCalled();
    expect(f.release).not.toHaveBeenCalled();
    expect(generateTtsAudioWithFallback).not.toHaveBeenCalled();
  });
});
