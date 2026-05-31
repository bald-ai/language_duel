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
  SENTENCE_TTS_PIPELINE_SHAPE,
  WORD_TTS_PIPELINE_SHAPE,
  type SentenceRoundWithTts,
  type ThemeTtsTarget,
  type ThemeWordWithTts,
} from "@/convex/themes/ttsPipeline";

vi.mock("@/lib/tts/providerAdapters", () => ({
  generateTtsAudioWithFallback: vi.fn(),
}));

const wordTarget: ThemeTtsTarget<ThemeWordWithTts> = {
  index: 1,
  word: "cat",
  answer: "la gata (irr)",
  wrongAnswers: ["a", "b", "c"],
};

const sentenceTarget: ThemeTtsTarget<SentenceRoundWithTts> = {
  index: 2,
  englishPrompt: "The cat sleeps",
  spanishSentence: "El gato duerme (irr)",
  distractors: ["come", "corre", "salta"],
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

  it("plans missing sentence rounds against the available credit count", () => {
    const plan = planThemeTtsGeneration(
      [
        { englishPrompt: "a", spanishSentence: "uno", distractors: ["x", "y", "z"] },
        {
          englishPrompt: "b",
          spanishSentence: "dos",
          distractors: ["x", "y", "z"],
          ttsStorageId: "storage_existing" as Id<"_storage">,
        },
        { englishPrompt: "c", spanishSentence: "tres", distractors: ["x", "y", "z"] },
      ],
      1
    );

    expect(plan).toMatchObject({
      alreadyUpToDate: false,
      totalMissing: 2,
      skippedForCredits: 1,
    });
    expect(plan.targets.map((item) => item.spanishSentence)).toEqual(["uno"]);
  });

  it("prepares provider text by removing irregular markers and rejecting empty text", () => {
    expect(prepareThemeTtsProviderText("hacer (irr)")).toBe("hacer");
    expect(() => prepareThemeTtsProviderText("   ")).toThrow("Text is empty");
  });

  it("generates word audio with the prepared answer text", async () => {
    const audio = new Uint8Array([1, 2, 3]).buffer;
    vi.mocked(generateTtsAudioWithFallback).mockResolvedValue({
      audioBuffer: audio,
      provider: TTS_PROVIDER_IDS.RESEMBLE,
      contentType: "audio/wav",
    });

    await expect(generateThemeTtsAudio(WORD_TTS_PIPELINE_SHAPE, wordTarget)).resolves.toBe(audio);
    expect(generateTtsAudioWithFallback).toHaveBeenCalledWith({ text: "la gata" });
  });

  it("generates sentence audio with the prepared Spanish sentence text", async () => {
    const audio = new Uint8Array([4, 5, 6]).buffer;
    vi.mocked(generateTtsAudioWithFallback).mockResolvedValue({
      audioBuffer: audio,
      provider: TTS_PROVIDER_IDS.RESEMBLE,
      contentType: "audio/wav",
    });

    await expect(
      generateThemeTtsAudio(SENTENCE_TTS_PIPELINE_SHAPE, sentenceTarget)
    ).resolves.toBe(audio);
    expect(generateTtsAudioWithFallback).toHaveBeenLastCalledWith({ text: "El gato duerme" });
  });

  it("stores generated audio and builds a word apply payload", async () => {
    const storage = {
      store: vi.fn(async () => "storage_new" as Id<"_storage">),
    };

    const storageId = await storeThemeTtsAudio(storage, new Uint8Array([1]).buffer);
    expect(storageId).toBe("storage_new");
    expect(storage.store).toHaveBeenCalledOnce();
    expect(buildGeneratedThemeTtsResult(WORD_TTS_PIPELINE_SHAPE, wordTarget, storageId)).toEqual({
      index: 1,
      sourceSignature: JSON.stringify(["cat", "la gata (irr)"]),
      storageId: "storage_new",
    });
  });

  it("builds a sentence apply payload with the sentence invalidation signature", () => {
    const result = buildGeneratedThemeTtsResult(
      SENTENCE_TTS_PIPELINE_SHAPE,
      sentenceTarget,
      "storage_sentence" as Id<"_storage">
    );
    expect(result).toEqual({
      index: 2,
      sourceSignature: JSON.stringify(["The cat sleeps", "El gato duerme (irr)"]),
      storageId: "storage_sentence",
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
