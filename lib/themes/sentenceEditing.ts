import type { SentenceRoundInput } from "./sentenceTypes";

/**
 * Deep equality for sentence rounds, including the per-round `ttsStorageId`.
 * Mirrors `areThemeWordsEqual` for word themes — used to detect unsaved local
 * edits (e.g. to gate TTS generation, which must run against a saved theme).
 */
export function areSentenceRoundsEqual(
  left: readonly SentenceRoundInput[],
  right: readonly SentenceRoundInput[]
): boolean {
  if (left.length !== right.length) return false;

  for (let i = 0; i < left.length; i += 1) {
    const leftRound = left[i];
    const rightRound = right[i];

    if (!leftRound || !rightRound) return false;
    if (leftRound.englishPrompt !== rightRound.englishPrompt) return false;
    if (leftRound.spanishSentence !== rightRound.spanishSentence) return false;
    if ((leftRound.ttsStorageId ?? undefined) !== (rightRound.ttsStorageId ?? undefined)) {
      return false;
    }

    if (leftRound.distractors.length !== rightRound.distractors.length) return false;
    for (let j = 0; j < leftRound.distractors.length; j += 1) {
      if (leftRound.distractors[j] !== rightRound.distractors[j]) return false;
    }
  }

  return true;
}
