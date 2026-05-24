export interface ThemeWordWithTts {
  word: string;
  answer: string;
  wrongAnswers: string[];
  ttsStorageId?: string;
}

export function hasWordOrAnswerChanged(
  previousWord: Pick<ThemeWordWithTts, "word" | "answer">,
  nextWord: Pick<ThemeWordWithTts, "word" | "answer">
): boolean {
  return previousWord.word !== nextWord.word || previousWord.answer !== nextWord.answer;
}

/**
 * Reconciles persisted TTS IDs after an edit.
 * TTS stays valid only when both word and answer are unchanged.
 * Wrong answer edits keep the existing TTS ID.
 */
export function reconcileThemeWordTts<TWord extends ThemeWordWithTts>(
  previousWords: readonly TWord[],
  nextWords: readonly TWord[]
): TWord[] {
  const previousByWord = new Map(previousWords.map((word) => [word.word, word]));

  return nextWords.map((nextWord) => {
    const previousWord = previousByWord.get(nextWord.word);

    if (!previousWord || hasWordOrAnswerChanged(previousWord, nextWord)) {
      if (nextWord.ttsStorageId === undefined) {
        return nextWord;
      }

      const { ttsStorageId: _dropTtsStorageId, ...rest } = nextWord;
      return rest as TWord;
    }

    if (previousWord.ttsStorageId === undefined) {
      if (nextWord.ttsStorageId === undefined) {
        return nextWord;
      }

      const { ttsStorageId: _dropTtsStorageId, ...rest } = nextWord;
      return rest as TWord;
    }

    if (nextWord.ttsStorageId === previousWord.ttsStorageId) {
      return nextWord;
    }

    return {
      ...nextWord,
      ttsStorageId: previousWord.ttsStorageId,
    };
  });
}

/**
 * Applies generated TTS IDs to the theme words. The single source of truth for
 * the apply rules — used by both the unit tests and the production mutation.
 *
 * A generated result is applied only when its source snapshot still matches the
 * current word (so a word edited mid-generation is not clobbered) and the slot
 * does not already have audio. Every storage ID that is not applied is returned
 * in `rejectedStorageIds` so the caller can delete the now-orphaned files.
 *
 * Generic over the word type so the caller's storage-ID brand (`Id<"_storage">`
 * in Convex, plain `string` in tests) is preserved on the returned words.
 */
export function applyGeneratedTtsToWords<TWord extends ThemeWordWithTts>(
  currentWords: readonly TWord[],
  generatedResults: ReadonlyArray<{
    wordIndex: number;
    sourceWord: string;
    sourceAnswer: string;
    storageId: NonNullable<TWord["ttsStorageId"]>;
  }>
): {
  words: TWord[];
  applied: number;
  skipped: number;
  rejectedStorageIds: NonNullable<TWord["ttsStorageId"]>[];
} {
  const words = currentWords.map((word) => ({ ...word })) as TWord[];
  let applied = 0;
  let skipped = 0;
  const rejectedStorageIds: NonNullable<TWord["ttsStorageId"]>[] = [];

  for (const result of generatedResults) {
    const currentWord = words[result.wordIndex];

    if (
      !currentWord ||
      currentWord.word !== result.sourceWord ||
      currentWord.answer !== result.sourceAnswer ||
      currentWord.ttsStorageId
    ) {
      skipped += 1;
      rejectedStorageIds.push(result.storageId);
      continue;
    }

    words[result.wordIndex] = {
      ...currentWord,
      ttsStorageId: result.storageId,
    };
    applied += 1;
  }

  return { words, applied, skipped, rejectedStorageIds };
}

export function hasMissingThemeTts(words: readonly ThemeWordWithTts[]): boolean {
  return words.some((word) => !word.ttsStorageId);
}
