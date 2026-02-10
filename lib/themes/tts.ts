export interface ThemeWordWithTts {
  word: string;
  answer: string;
  wrongAnswers: string[];
  ttsStorageId?: string;
}

export interface GeneratedWordTtsResult {
  wordIndex: number;
  sourceWord: string;
  sourceAnswer: string;
  storageId: string;
}

export interface ApplyGeneratedTtsResult<TWord extends ThemeWordWithTts> {
  words: TWord[];
  applied: number;
  skipped: number;
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
 * Applies generated TTS IDs only if the original source snapshot still matches.
 * This protects against stale action results overwriting words edited during generation.
 */
export function applyGeneratedTtsToWords<TWord extends ThemeWordWithTts>(
  currentWords: readonly TWord[],
  generatedResults: readonly GeneratedWordTtsResult[]
): ApplyGeneratedTtsResult<TWord> {
  const words = currentWords.map((word) => ({ ...word })) as TWord[];
  let applied = 0;
  let skipped = 0;

  for (const result of generatedResults) {
    const currentWord = words[result.wordIndex];

    if (!currentWord) {
      skipped += 1;
      continue;
    }

    if (
      currentWord.word !== result.sourceWord ||
      currentWord.answer !== result.sourceAnswer
    ) {
      skipped += 1;
      continue;
    }

    words[result.wordIndex] = {
      ...currentWord,
      ttsStorageId: result.storageId,
    };
    applied += 1;
  }

  return { words, applied, skipped };
}

export function hasMissingThemeTts(words: readonly ThemeWordWithTts[]): boolean {
  return words.some((word) => !word.ttsStorageId);
}
