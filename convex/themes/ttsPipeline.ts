import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { stripIrr } from "../../lib/stringUtils";

export type ThemeWordWithTts = {
  word: string;
  answer: string;
  wrongAnswers: string[];
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

export async function generateThemeTtsAudio(
  target: ThemeTtsTarget,
  generateAudio: (text: string, signal: AbortSignal) => Promise<ArrayBuffer | null>,
  timeoutMs: number
): Promise<ArrayBuffer> {
  const cleanText = prepareThemeTtsProviderText(target.answer);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const audioBuffer = await generateAudio(cleanText, controller.signal);
    if (!audioBuffer) {
      throw new ConvexError({ code: "INTERNAL_ERROR", message: "TTS generation failed" });
    }
    return audioBuffer;
  } finally {
    clearTimeout(timeoutId);
  }
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
