import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { stripIrr } from "../../lib/stringUtils";
import { generateTtsAudioWithFallback } from "../../lib/tts/providerAdapters";
import {
  SENTENCE_TTS_SHAPE,
  WORD_TTS_SHAPE,
  type SentenceRoundWithTts as SentenceRoundWithTtsBase,
  type ThemeTtsRow,
  type ThemeTtsShape,
  type ThemeWordWithTts as ThemeWordWithTtsBase,
} from "../../lib/themes/tts";

// Convex specializations of the canonical row shapes (lib/themes/tts.ts), with
// the storage-ID brand narrowed from string to Id<"_storage">.
export type ThemeWordWithTts = Omit<ThemeWordWithTtsBase, "ttsStorageId"> & {
  ttsStorageId?: Id<"_storage">;
};
export type SentenceRoundWithTts = Omit<SentenceRoundWithTtsBase, "ttsStorageId"> & {
  ttsStorageId?: Id<"_storage">;
};

// Convex-branded views of the pure shapes. The shape functions only read string
// fields, so the base shapes apply verbatim — the casts just pin the storage-ID
// brand for the rest of this module.
export const WORD_TTS_PIPELINE_SHAPE: ThemeTtsShape<ThemeWordWithTts> =
  WORD_TTS_SHAPE;
export const SENTENCE_TTS_PIPELINE_SHAPE: ThemeTtsShape<SentenceRoundWithTts> =
  SENTENCE_TTS_SHAPE;

type ConvexTtsRow = ThemeTtsRow & { ttsStorageId?: Id<"_storage"> };

export type ThemeTtsTarget<TRow extends ConvexTtsRow> = TRow & {
  index: number;
};

// Content-agnostic generated result: the `sourceSignature` (captured from the
// row at generation time) lets the apply mutation reject results whose row was
// edited mid-generation, for both word and sentence themes.
export type GeneratedThemeTtsResult = {
  index: number;
  sourceSignature: string;
  storageId: Id<"_storage">;
};

export type ThemeTtsPlan<TRow extends ConvexTtsRow> =
  | {
      alreadyUpToDate: true;
      totalMissing: 0;
      targets: [];
      skippedForCredits: 0;
    }
  | {
      alreadyUpToDate: false;
      totalMissing: number;
      targets: ThemeTtsTarget<TRow>[];
      skippedForCredits: number;
    };

export function planThemeTtsGeneration<TRow extends ConvexTtsRow>(
  rows: TRow[],
  ttsGenerationsRemaining: number
): ThemeTtsPlan<TRow> {
  const missingRows = rows
    .map((row, index) => ({ ...row, index }))
    .filter((row) => !row.ttsStorageId);

  if (missingRows.length === 0) {
    return {
      alreadyUpToDate: true,
      totalMissing: 0,
      targets: [],
      skippedForCredits: 0,
    };
  }

  const maxGenerations = Math.max(0, Math.floor(ttsGenerationsRemaining));
  const targets = missingRows.slice(0, maxGenerations);

  return {
    alreadyUpToDate: false,
    totalMissing: missingRows.length,
    targets,
    skippedForCredits: Math.max(0, missingRows.length - targets.length),
  };
}

export function prepareThemeTtsProviderText(text: string): string {
  const cleanText = stripIrr(text).trim();
  if (!cleanText) {
    throw new ConvexError({ code: "INVALID_INPUT", message: "Text is empty" });
  }
  return cleanText;
}

export async function generateThemeTtsAudio<TRow extends ConvexTtsRow>(
  shape: ThemeTtsShape<TRow>,
  target: ThemeTtsTarget<TRow>
): Promise<ArrayBuffer> {
  const cleanText = prepareThemeTtsProviderText(shape.voicedText(target));
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

export function buildGeneratedThemeTtsResult<TRow extends ConvexTtsRow>(
  shape: ThemeTtsShape<TRow>,
  target: ThemeTtsTarget<TRow>,
  storageId: Id<"_storage">
): GeneratedThemeTtsResult {
  return {
    index: target.index,
    sourceSignature: shape.invalidationSignature(target),
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
