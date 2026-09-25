import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";
import {
  buildPlaceholderSentenceWordMeanings,
  normalizeSentenceFreeWordPositions,
  sentenceTokensChanged,
} from "@/lib/themes/sentenceValidation";

/**
 * Drop the round's `ttsStorageId` when an identity/voiced field changed, so the
 * editor stops offering stale audio before the save-time reconcile runs.
 */
function clearTtsIfChanged(
  round: SentenceRoundInput,
  changed: boolean,
): SentenceRoundInput {
  if (!changed || round.ttsStorageId === undefined) return round;
  const { ttsStorageId: _dropTtsStorageId, ...rest } = round;
  return rest;
}

function updateEnglishPrompt(
  round: SentenceRoundInput,
  nextValue: string,
): SentenceRoundInput {
  // English or Spanish edits invalidate the audio (word-parity): drop
  // the id immediately so a stale play button isn't shown before save.
  const changed = round.englishPrompt !== nextValue;
  return clearTtsIfChanged(
    changed
      ? {
          ...round,
          englishPrompt: nextValue,
          wordMeanings: buildPlaceholderSentenceWordMeanings(
            round.spanishSentence,
          ),
          freeWordPositions: normalizeSentenceFreeWordPositions(
            round.spanishSentence,
            round.freeWordPositions,
          ),
        }
      : { ...round, englishPrompt: nextValue },
    changed,
  );
}
function updateSpanishSentence(
  round: SentenceRoundInput,
  nextValue: string,
): SentenceRoundInput {
  const changed = round.spanishSentence !== nextValue;
  const wordsChanged = sentenceTokensChanged(round.spanishSentence, nextValue);
  return clearTtsIfChanged(
    changed
      ? {
          ...round,
          spanishSentence: nextValue,
          wordMeanings: buildPlaceholderSentenceWordMeanings(nextValue),
          freeWordPositions: wordsChanged
            ? []
            : normalizeSentenceFreeWordPositions(
                nextValue,
                round.freeWordPositions,
              ),
        }
      : { ...round, spanishSentence: nextValue },
    changed,
  );
}

/** Update an authored field and invalidate derived content only when its source changes. */
export function updateSentenceRoundField(
  round: SentenceRoundInput,
  edit: {
    field: "english" | "spanish" | "distractor";
    distractorIndex?: number;
  },
  nextValue: string,
): SentenceRoundInput {
  if (edit.field === "english") return updateEnglishPrompt(round, nextValue);
  if (edit.field === "spanish") return updateSpanishSentence(round, nextValue);
  // Distractor-only edits keep the audio.
  const distractors = [...round.distractors];
  distractors[edit.distractorIndex ?? 0] = nextValue;
  return { ...round, distractors };
}
