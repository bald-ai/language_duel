import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { TTS_PROVIDER_IDS } from "@/lib/tts/providers";
import { generateTtsAudioWithFallback } from "@/lib/tts/providerAdapters";
import {
  buildGeneratedThemeTtsResult,
  cleanupRejectedThemeTtsStorage,
  generateThemeTtsAudio,
  planThemeTtsGeneration,
  prepareThemeTtsProviderText,
  storeThemeTtsAudio,
  type ThemeTtsTarget,
} from "@/convex/themes/ttsPipeline";

vi.mock("@/lib/tts/providerAdapters", () => ({
  generateTtsAudioWithFallback: vi.fn(),
}));

const target: ThemeTtsTarget = {
  wordIndex: 1,
  word: "cat",
  answer: "la gata (irr)",
  wrongAnswers: ["a", "b", "c"],
};

describe("theme TTS pipeline", () => {
  it("plans missing words against the available credit count", () => {
    const plan = planThemeTtsGeneration(
      [
        { word: "one", answer: "uno", wrongAnswers: ["a", "b", "c"] },
        {
          word: "two",
          answer: "dos",
          wrongAnswers: ["a", "b", "c"],
          ttsStorageId: "storage_existing" as Id<"_storage">,
        },
        { word: "three", answer: "tres", wrongAnswers: ["a", "b", "c"] },
      ],
      1
    );

    expect(plan).toMatchObject({
      alreadyUpToDate: false,
      totalMissing: 2,
      skippedForCredits: 1,
    });
    expect(plan.targets.map((item) => item.word)).toEqual(["one"]);
  });

  it("prepares provider text by removing irregular markers and rejecting empty text", () => {
    expect(prepareThemeTtsProviderText("hacer (irr)")).toBe("hacer");
    expect(() => prepareThemeTtsProviderText("   ")).toThrow("Answer text is empty");
  });

  it("generates provider audio with the prepared text", async () => {
    const audio = new Uint8Array([1, 2, 3]).buffer;
    vi.mocked(generateTtsAudioWithFallback).mockResolvedValue({
      audioBuffer: audio,
      provider: TTS_PROVIDER_IDS.RESEMBLE,
      contentType: "audio/wav",
    });

    await expect(generateThemeTtsAudio(target)).resolves.toBe(audio);
    expect(generateTtsAudioWithFallback).toHaveBeenCalledWith({ text: "la gata" });
  });

  it("stores generated audio and builds an apply payload", async () => {
    const storage = {
      store: vi.fn(async () => "storage_new" as Id<"_storage">),
    };

    const storageId = await storeThemeTtsAudio(storage, new Uint8Array([1]).buffer);
    expect(storageId).toBe("storage_new");
    expect(storage.store).toHaveBeenCalledOnce();
    expect(buildGeneratedThemeTtsResult(target, storageId)).toEqual({
      wordIndex: 1,
      sourceWord: "cat",
      sourceAnswer: "la gata (irr)",
      storageId: "storage_new",
    });
  });

  it("cleans up rejected storage ids without failing the whole cleanup", async () => {
    const storage = {
      delete: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("delete failed")),
    };

    await expect(
      cleanupRejectedThemeTtsStorage(storage, [
        "storage_1" as Id<"_storage">,
        "storage_2" as Id<"_storage">,
      ])
    ).resolves.toBeUndefined();
    expect(storage.delete).toHaveBeenCalledTimes(2);
  });
});

