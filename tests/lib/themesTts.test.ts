import { describe, expect, it } from "vitest";
import {
  applyGeneratedTts,
  hasMissingThemeTts,
  reconcileThemeSentenceTts,
  reconcileThemeWordTts,
  SENTENCE_TTS_SHAPE,
  WORD_TTS_SHAPE,
  type SentenceRoundWithTts,
  type ThemeWordWithTts,
} from "@/lib/themes/tts";

function makeWord(overrides: Partial<ThemeWordWithTts>): ThemeWordWithTts {
  return {
    word: "cat",
    answer: "el gato",
    wrongAnswers: ["el perro", "el pajaro", "el pez"],
    ...overrides,
  };
}

function makeRound(overrides: Partial<SentenceRoundWithTts>): SentenceRoundWithTts {
  return {
    englishPrompt: "The cat sleeps",
    spanishSentence: "El gato duerme",
    distractors: ["come", "corre", "salta"],
    ...overrides,
  };
}

// Build a generated-apply entry whose sourceSignature is captured from the row
// itself, so the tests stay in sync with whatever the shape considers the
// invalidation fields.
function wordApply(
  index: number,
  row: ThemeWordWithTts,
  storageId: string
) {
  return { index, sourceSignature: WORD_TTS_SHAPE.invalidationSignature(row), storageId };
}

function sentenceApply(
  index: number,
  row: SentenceRoundWithTts,
  storageId: string
) {
  return { index, sourceSignature: SENTENCE_TTS_SHAPE.invalidationSignature(row), storageId };
}

describe("word theme TTS invalidation rules", () => {
  it("invalidates when answer changes", () => {
    const previousWords = [makeWord({ ttsStorageId: "st_1" })];
    const nextWords = [makeWord({ answer: "la gata", ttsStorageId: "st_1" })];

    const reconciled = reconcileThemeWordTts(previousWords, nextWords);

    expect(reconciled[0]?.ttsStorageId).toBeUndefined();
  });

  it("invalidates when word changes", () => {
    const previousWords = [makeWord({ ttsStorageId: "st_1" })];
    const nextWords = [makeWord({ word: "kitty", ttsStorageId: "st_1" })];

    const reconciled = reconcileThemeWordTts(previousWords, nextWords);

    expect(reconciled[0]?.ttsStorageId).toBeUndefined();
  });

  it("keeps TTS when only wrong answers change", () => {
    const previousWords = [makeWord({ ttsStorageId: "st_1" })];
    const nextWords = [makeWord({ wrongAnswers: ["el lobo", "el leon", "el tigre"] })];

    const reconciled = reconcileThemeWordTts(previousWords, nextWords);

    expect(reconciled[0]?.ttsStorageId).toBe("st_1");
  });

  it("preserves TTS on reorder and only invalidates new/changed words", () => {
    const previousWords = [
      makeWord({ word: "cat", answer: "el gato", ttsStorageId: "st_cat" }),
      makeWord({ word: "dog", answer: "el perro", ttsStorageId: "st_dog" }),
      makeWord({ word: "fish", answer: "el pez", ttsStorageId: "st_fish" }),
    ];
    const nextWords = [
      makeWord({ word: "dog", answer: "el perro" }),
      makeWord({ word: "bird", answer: "el pajaro", ttsStorageId: "st_old" }),
      makeWord({ word: "cat", answer: "el gato" }),
    ];

    const reconciled = reconcileThemeWordTts(previousWords, nextWords);

    expect(reconciled[0]?.ttsStorageId).toBe("st_dog");
    expect(reconciled[1]?.ttsStorageId).toBeUndefined();
    expect(reconciled[2]?.ttsStorageId).toBe("st_cat");
  });
});

describe("sentence theme TTS invalidation rules", () => {
  it("invalidates when the Spanish sentence changes", () => {
    const previousRounds = [makeRound({ ttsStorageId: "st_1" })];
    // A changed Spanish sentence is a different identity, so the audio drops.
    const nextRounds = [makeRound({ spanishSentence: "El gato corre", ttsStorageId: "st_1" })];

    const reconciled = reconcileThemeSentenceTts(previousRounds, nextRounds);

    expect(reconciled[0]?.ttsStorageId).toBeUndefined();
  });

  it("invalidates when only the English prompt changes", () => {
    const previousRounds = [makeRound({ ttsStorageId: "st_1" })];
    const nextRounds = [makeRound({ englishPrompt: "The cat is sleeping", ttsStorageId: "st_1" })];

    const reconciled = reconcileThemeSentenceTts(previousRounds, nextRounds);

    expect(reconciled[0]?.ttsStorageId).toBeUndefined();
  });

  it("keeps TTS when only distractors change", () => {
    const previousRounds = [makeRound({ ttsStorageId: "st_1" })];
    const nextRounds = [makeRound({ distractors: ["nada", "vuela", "lee"] })];

    const reconciled = reconcileThemeSentenceTts(previousRounds, nextRounds);

    expect(reconciled[0]?.ttsStorageId).toBe("st_1");
  });

  it("preserves TTS on reorder and only invalidates new/changed rounds", () => {
    const previousRounds = [
      makeRound({ englishPrompt: "The cat sleeps", spanishSentence: "El gato duerme", ttsStorageId: "st_cat" }),
      makeRound({ englishPrompt: "The dog runs", spanishSentence: "El perro corre", ttsStorageId: "st_dog" }),
    ];
    const nextRounds = [
      makeRound({ englishPrompt: "The dog runs", spanishSentence: "El perro corre" }),
      makeRound({ englishPrompt: "The bird flies", spanishSentence: "El pajaro vuela", ttsStorageId: "st_old" }),
      makeRound({ englishPrompt: "The cat sleeps", spanishSentence: "El gato duerme" }),
    ];

    const reconciled = reconcileThemeSentenceTts(previousRounds, nextRounds);

    expect(reconciled[0]?.ttsStorageId).toBe("st_dog");
    expect(reconciled[1]?.ttsStorageId).toBeUndefined();
    expect(reconciled[2]?.ttsStorageId).toBe("st_cat");
  });
});

describe("safe apply of generated word TTS IDs", () => {
  it("applies generated ID when source signature still matches", () => {
    const currentWords = [makeWord({ ttsStorageId: undefined })];

    const result = applyGeneratedTts(WORD_TTS_SHAPE, currentWords, [
      wordApply(0, makeWord({ word: "cat", answer: "el gato" }), "st_new"),
    ]);

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.rows[0]?.ttsStorageId).toBe("st_new");
  });

  it("skips stale generation result when word was edited during generation", () => {
    const currentWords = [makeWord({ answer: "la gata", ttsStorageId: undefined })];

    const result = applyGeneratedTts(WORD_TTS_SHAPE, currentWords, [
      // Signature was captured against the old answer "el gato".
      wordApply(0, makeWord({ word: "cat", answer: "el gato" }), "st_old_snapshot"),
    ]);

    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.rows[0]?.ttsStorageId).toBeUndefined();
  });

  it("handles partial success with out-of-range and stale entries", () => {
    const currentWords = [
      makeWord({ word: "cat", answer: "el gato", ttsStorageId: undefined }),
      makeWord({ word: "dog", answer: "el perro", ttsStorageId: undefined }),
      makeWord({ word: "bird", answer: "el pajaro", ttsStorageId: undefined }),
    ];

    const result = applyGeneratedTts(WORD_TTS_SHAPE, currentWords, [
      wordApply(0, makeWord({ word: "cat", answer: "el gato" }), "st_cat"),
      wordApply(1, makeWord({ word: "dog", answer: "la perra" }), "st_stale"),
      { index: 10, sourceSignature: WORD_TTS_SHAPE.invalidationSignature(makeWord({ word: "ghost", answer: "fantasma" })), storageId: "st_out_of_range" },
      wordApply(2, makeWord({ word: "bird", answer: "el pajaro" }), "st_bird"),
    ]);

    expect(result.applied).toBe(2);
    expect(result.skipped).toBe(2);
    expect(result.rows[0]?.ttsStorageId).toBe("st_cat");
    expect(result.rows[1]?.ttsStorageId).toBeUndefined();
    expect(result.rows[2]?.ttsStorageId).toBe("st_bird");
  });

  it("skips a slot that already has audio and rejects the new storage ID", () => {
    const currentWords = [makeWord({ ttsStorageId: "st_existing" })];

    const result = applyGeneratedTts(WORD_TTS_SHAPE, currentWords, [
      wordApply(0, makeWord({ word: "cat", answer: "el gato" }), "st_new"),
    ]);

    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.rejectedStorageIds).toEqual(["st_new"]);
    expect(result.rows[0]?.ttsStorageId).toBe("st_existing");
  });

  it("collects every unapplied storage ID in rejectedStorageIds", () => {
    const currentWords = [
      makeWord({ word: "cat", answer: "el gato", ttsStorageId: undefined }),
      makeWord({ word: "dog", answer: "el perro", ttsStorageId: undefined }),
    ];

    const result = applyGeneratedTts(WORD_TTS_SHAPE, currentWords, [
      wordApply(0, makeWord({ word: "cat", answer: "el gato" }), "st_cat"),
      wordApply(1, makeWord({ word: "dog", answer: "la perra" }), "st_stale"),
      { index: 9, sourceSignature: WORD_TTS_SHAPE.invalidationSignature(makeWord({ word: "ghost", answer: "fantasma" })), storageId: "st_oob" },
    ]);

    expect(result.applied).toBe(1);
    expect(result.rejectedStorageIds).toEqual(["st_stale", "st_oob"]);
  });
});

describe("safe apply of generated sentence TTS IDs", () => {
  it("applies generated ID when source signature still matches", () => {
    const currentRounds = [makeRound({ ttsStorageId: undefined })];

    const result = applyGeneratedTts(SENTENCE_TTS_SHAPE, currentRounds, [
      sentenceApply(0, makeRound({}), "st_new"),
    ]);

    expect(result.applied).toBe(1);
    expect(result.rows[0]?.ttsStorageId).toBe("st_new");
  });

  it("skips a stale result when the round was edited during generation", () => {
    const currentRounds = [makeRound({ spanishSentence: "El gato corre", ttsStorageId: undefined })];

    const result = applyGeneratedTts(SENTENCE_TTS_SHAPE, currentRounds, [
      // Signature captured against the old Spanish sentence.
      sentenceApply(0, makeRound({ spanishSentence: "El gato duerme" }), "st_stale"),
    ]);

    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.rejectedStorageIds).toEqual(["st_stale"]);
    expect(result.rows[0]?.ttsStorageId).toBeUndefined();
  });

  it("skips a round that already has audio and rejects the new storage ID", () => {
    const currentRounds = [makeRound({ ttsStorageId: "st_existing" })];

    const result = applyGeneratedTts(SENTENCE_TTS_SHAPE, currentRounds, [
      sentenceApply(0, makeRound({}), "st_new"),
    ]);

    expect(result.applied).toBe(0);
    expect(result.rejectedStorageIds).toEqual(["st_new"]);
    expect(result.rows[0]?.ttsStorageId).toBe("st_existing");
  });
});

describe("shape invalidation signatures", () => {
  it("word signature changes only on word or answer edits", () => {
    const base = makeWord({ word: "cat", answer: "el gato" });
    const wrongChanged = makeWord({ word: "cat", answer: "el gato", wrongAnswers: ["x", "y", "z"] });
    const answerChanged = makeWord({ word: "cat", answer: "la gata" });
    const wordChanged = makeWord({ word: "kitty", answer: "el gato" });

    const sig = WORD_TTS_SHAPE.invalidationSignature;
    expect(sig(base)).toBe(sig(wrongChanged));
    expect(sig(base)).not.toBe(sig(answerChanged));
    expect(sig(base)).not.toBe(sig(wordChanged));
  });

  it("sentence signature changes on English or Spanish edits but not distractors", () => {
    const base = makeRound({ englishPrompt: "The cat sleeps", spanishSentence: "El gato duerme" });
    const distractorsChanged = makeRound({ distractors: ["a", "b", "c"] });
    const englishChanged = makeRound({ englishPrompt: "The cat is sleeping" });
    const spanishChanged = makeRound({ spanishSentence: "El gato corre" });

    const sig = SENTENCE_TTS_SHAPE.invalidationSignature;
    expect(sig(base)).toBe(sig(distractorsChanged));
    expect(sig(base)).not.toBe(sig(englishChanged));
    expect(sig(base)).not.toBe(sig(spanishChanged));
  });
});

describe("helper guards", () => {
  it("detects missing TTS with a boolean flag", () => {
    expect(
      hasMissingThemeTts([
        makeWord({ ttsStorageId: "st_1" }),
        makeWord({ word: "dog", answer: "el perro", ttsStorageId: undefined }),
      ])
    ).toBe(true);

    expect(
      hasMissingThemeTts([
        makeWord({ ttsStorageId: "st_1" }),
        makeWord({ word: "dog", answer: "el perro", ttsStorageId: "st_2" }),
      ])
    ).toBe(false);
  });
});
