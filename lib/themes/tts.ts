/**
 * Pure TTS reconcile/apply logic, shared by word and sentence themes.
 *
 * Both content types attach a single optional `ttsStorageId` to each editable
 * row. They differ only in:
 *   - which field is the stable identity used to match a row across an edit
 *     (words are unique by `word`; sentence rounds are unique by
 *     `spanishSentence` — English prompts may repeat), and
 *   - which fields invalidate the audio when they change (word/answer for words,
 *     englishPrompt/spanishSentence for sentences; the rest — wrong answers /
 *     distractors — keep the audio).
 *
 * A `ThemeTtsShape` captures those two differences so the engine below stays
 * content-agnostic. The invalidation signature MUST include the identity value
 * so "same identity, another voiced field changed" still invalidates.
 */

export interface ThemeTtsRow {
  ttsStorageId?: string;
}

export interface ThemeWordWithTts extends ThemeTtsRow {
  word: string;
  answer: string;
  wrongAnswers: string[];
}

export interface SentenceRoundWithTts extends ThemeTtsRow {
  englishPrompt: string;
  spanishSentence: string;
  distractors: string[];
}

export interface ThemeTtsShape<TRow extends ThemeTtsRow> {
  /** Unique field used to match a row before/after an edit. */
  identity(row: TRow): string;
  /**
   * Serialized snapshot of the fields whose change invalidates the audio.
   * Includes the identity value so a changed sibling voiced field is caught.
   */
  invalidationSignature(row: TRow): string;
  /** Text sent to the TTS provider for this row. */
  voicedText(row: TRow): string;
}

export const WORD_TTS_SHAPE: ThemeTtsShape<ThemeWordWithTts> = {
  identity: (word) => word.word,
  invalidationSignature: (word) => JSON.stringify([word.word, word.answer]),
  voicedText: (word) => word.answer,
};

// Sentence themes only enforce uniqueness on `spanishSentence` (English prompts
// may repeat), so the canonical Spanish sentence is the row identity and the
// voiced text. English + Spanish both invalidate audio (word-parity decision).
export const SENTENCE_TTS_SHAPE: ThemeTtsShape<SentenceRoundWithTts> = {
  identity: (round) => round.spanishSentence,
  invalidationSignature: (round) =>
    JSON.stringify([round.englishPrompt, round.spanishSentence]),
  voicedText: (round) => round.spanishSentence,
};

function withoutTtsStorageId<TRow extends ThemeTtsRow>(row: TRow): TRow {
  if (row.ttsStorageId === undefined) return row;
  const { ttsStorageId: _dropTtsStorageId, ...rest } = row;
  return rest as TRow;
}

/**
 * Reconciles persisted TTS IDs after an edit, generic over the row shape.
 * TTS stays valid only when the row is matched by identity AND its invalidation
 * signature is unchanged. Otherwise the stored ID is dropped.
 *
 * Generic over the row type so the caller's storage-ID brand (`Id<"_storage">`
 * in Convex, plain `string` in tests) is preserved on the returned rows.
 */
export function reconcileThemeTts<TRow extends ThemeTtsRow>(
  shape: ThemeTtsShape<TRow>,
  previousRows: readonly TRow[],
  nextRows: readonly TRow[]
): TRow[] {
  const previousByIdentity = new Map(
    previousRows.map((row) => [shape.identity(row), row])
  );

  return nextRows.map((nextRow) => {
    const previousRow = previousByIdentity.get(shape.identity(nextRow));

    if (
      !previousRow ||
      shape.invalidationSignature(previousRow) !== shape.invalidationSignature(nextRow)
    ) {
      return withoutTtsStorageId(nextRow);
    }

    if (previousRow.ttsStorageId === undefined) {
      return withoutTtsStorageId(nextRow);
    }

    if (nextRow.ttsStorageId === previousRow.ttsStorageId) {
      return nextRow;
    }

    // Identity + signature unchanged: the persisted audio wins regardless of
    // whatever the client claimed for this slot.
    return {
      ...nextRow,
      ttsStorageId: previousRow.ttsStorageId,
    };
  });
}

export function reconcileThemeWordTts<TWord extends ThemeWordWithTts>(
  previousWords: readonly TWord[],
  nextWords: readonly TWord[]
): TWord[] {
  return reconcileThemeTts<TWord>(WORD_TTS_SHAPE, previousWords, nextWords);
}

export function reconcileThemeSentenceTts<TRound extends SentenceRoundWithTts>(
  previousRounds: readonly TRound[],
  nextRounds: readonly TRound[]
): TRound[] {
  return reconcileThemeTts<TRound>(SENTENCE_TTS_SHAPE, previousRounds, nextRounds);
}

/**
 * One generated TTS result, ready to be applied back to a content row. The
 * `sourceSignature` is the invalidation signature captured at generation time
 * (content-agnostic), so a row edited mid-generation is detected and skipped.
 */
export interface GeneratedThemeTtsApply<TStorageId extends string> {
  index: number;
  sourceSignature: string;
  storageId: TStorageId;
}

/**
 * Applies generated TTS IDs to the content rows. The single source of truth for
 * the apply rules — used by both the unit tests and the production mutation.
 *
 * A generated result is applied only when its source signature still matches the
 * current row (so a row edited mid-generation is not clobbered) and the slot
 * does not already have audio. Every storage ID that is not applied is returned
 * in `rejectedStorageIds` so the caller can delete the now-orphaned files.
 *
 * Generic over the row type so the caller's storage-ID brand is preserved.
 */
export function applyGeneratedTts<TRow extends ThemeTtsRow>(
  shape: ThemeTtsShape<TRow>,
  currentRows: readonly TRow[],
  generatedResults: ReadonlyArray<GeneratedThemeTtsApply<NonNullable<TRow["ttsStorageId"]>>>
): {
  rows: TRow[];
  applied: number;
  skipped: number;
  rejectedStorageIds: NonNullable<TRow["ttsStorageId"]>[];
} {
  const rows = currentRows.map((row) => ({ ...row })) as TRow[];
  let applied = 0;
  let skipped = 0;
  const rejectedStorageIds: NonNullable<TRow["ttsStorageId"]>[] = [];

  for (const result of generatedResults) {
    const currentRow = rows[result.index];

    if (
      !currentRow ||
      shape.invalidationSignature(currentRow) !== result.sourceSignature ||
      currentRow.ttsStorageId
    ) {
      skipped += 1;
      rejectedStorageIds.push(result.storageId);
      continue;
    }

    rows[result.index] = {
      ...currentRow,
      ttsStorageId: result.storageId,
    };
    applied += 1;
  }

  return { rows, applied, skipped, rejectedStorageIds };
}

export function hasMissingThemeTts(rows: readonly ThemeTtsRow[]): boolean {
  return rows.some((row) => !row.ttsStorageId);
}
