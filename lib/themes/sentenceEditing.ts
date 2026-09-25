import type { SentenceRoundInput } from "./sentenceTypes";
import { arraysEqual, scalarArraysEqual } from "./arrayEquality";

function roundArraysEqual(left: SentenceRoundInput, right: SentenceRoundInput): boolean {
  return scalarArraysEqual(left.wordMeanings ?? [], right.wordMeanings ?? [])
    && scalarArraysEqual(left.freeWordPositions ?? [], right.freeWordPositions ?? [])
    && scalarArraysEqual(left.distractors, right.distractors);
}

function roundsEqual(left: SentenceRoundInput, right: SentenceRoundInput): boolean {
  if (!left || !right) return false;
  if (left.englishPrompt !== right.englishPrompt || left.spanishSentence !== right.spanishSentence) return false;
  if ((left.ttsStorageId ?? undefined) !== (right.ttsStorageId ?? undefined)) return false;
  return roundArraysEqual(left, right);
}

/** Compare saved content, including audio, to detect unsaved edits before TTS generation. */
export function areSentenceRoundsEqual(left: readonly SentenceRoundInput[], right: readonly SentenceRoundInput[]): boolean {
  return arraysEqual(left, right, roundsEqual);
}
