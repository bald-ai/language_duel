import type { SoloMasteryLevel } from "./soloPracticeRuntime";

/**
 * Codec for the `confidence` URL param that carries a learner's per-word
 * confidence from the Learn page into the Practice page. The wire format is a
 * JSON object keyed by word index, e.g. `{"0":2,"1":3}`.
 */
export function encodeConfidenceParam(
  confidenceByWordIndex: Record<number, number>
): string {
  return JSON.stringify(confidenceByWordIndex);
}

export function decodeConfidenceParam(
  raw: string | null
): Record<number, SoloMasteryLevel> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const record = parsed as Record<string, unknown>;
    const levels: Record<number, SoloMasteryLevel> = {};
    for (const [key, value] of Object.entries(record)) {
      const wordIndex = Number(key);
      if (!Number.isFinite(wordIndex)) continue;
      if (typeof value !== "number") continue;
      if (![0, 1, 2, 3].includes(value)) continue;
      levels[wordIndex] = value as SoloMasteryLevel;
    }
    return levels;
  } catch {
    return null;
  }
}
