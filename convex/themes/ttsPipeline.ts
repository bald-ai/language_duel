import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { stripIrr } from "../../lib/stringUtils";
import { generateTtsAudioWithFallback } from "../../lib/tts/providerAdapters";
import type { ThemeWordWithTts as ThemeWordWithTtsBase } from "../../lib/themes/tts";

// Convex specialization of the canonical word shape (lib/themes/tts.ts), with the
// storage-ID brand narrowed from string to Id<"_storage">.
export type ThemeWordWithTts = Omit<ThemeWordWithTtsBase, "ttsStorageId"> & {
  ttsStorageId?: Id<"_storage">;
};

export type ThemeTtsTarget = ThemeWordWithTts & {
  wordIndex: number;
};

export type GeneratedWordTtsResult = {
  wordIndex: number;
  sourceWord: string;
  sourceAnswer: string;
  storageId: Id<"_storage">;
};

export type ThemeTtsPlan =
  | {
      alreadyUpToDate: true;
      totalMissing: 0;
      targets: [];
      skippedForCredits: 0;
    }
  | {
      alreadyUpToDate: false;
      totalMissing: number;
      targets: ThemeTtsTarget[];
      skippedForCredits: number;
    };

export function planThemeTtsGeneration(
  words: ThemeWordWithTts[],
  ttsGenerationsRemaining: number
): ThemeTtsPlan {
  const missingWords = words
    .map((word, wordIndex) => ({ ...word, wordIndex }))
    .filter((word) => !word.ttsStorageId);

  if (missingWords.length === 0) {
    return {
      alreadyUpToDate: true,
      totalMissing: 0,
      targets: [],
      skippedForCredits: 0,
    };
  }

  const maxGenerations = Math.max(0, Math.floor(ttsGenerationsRemaining));
  const targets = missingWords.slice(0, maxGenerations);

  return {
    alreadyUpToDate: false,
    totalMissing: missingWords.length,
    targets,
    skippedForCredits: Math.max(0, missingWords.length - targets.length),
  };
}

export function prepareThemeTtsProviderText(answer: string): string {
  const cleanText = stripIrr(answer).trim();
  if (!cleanText) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Answer text is empty" });
  }
  return cleanText;
}

export async function generateThemeTtsAudio(target: ThemeTtsTarget): Promise<ArrayBuffer> {
  const cleanText = prepareThemeTtsProviderText(target.answer);
  const generatedAudio = await generateTtsAudioWithFallback({ text: cleanText });
  if (!generatedAudio) {
    throw new ConvexError({ code: "INTERNAL_ERROR", message: "TTS generation failed" });
  }
  return generatedAudio.audioBuffer;
}

export async function storeThemeTtsAudio(
  storage: { store: (blob: Blob) => Promise<Id<"_storage">> },
  audioBuffer: ArrayBuffer
): Promise<Id<"_storage">> {
  return await storage.store(new Blob([audioBuffer], { type: "audio/wav" }));
}

export function buildGeneratedThemeTtsResult(
  target: ThemeTtsTarget,
  storageId: Id<"_storage">
): GeneratedWordTtsResult {
  return {
    wordIndex: target.wordIndex,
    sourceWord: target.word,
    sourceAnswer: target.answer,
    storageId,
  };
}

export async function cleanupRejectedThemeTtsStorage(
  storage: { delete: (storageId: Id<"_storage">) => Promise<void> },
  rejectedStorageIds: Id<"_storage">[]
): Promise<void> {
  await Promise.all(
    rejectedStorageIds.map(async (storageId) => {
      try {
        await storage.delete(storageId);
      } catch (error) {
        console.error("[Theme TTS] Failed to delete stale generated file:", storageId, error);
      }
    })
  );
}
