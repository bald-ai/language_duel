import { describe, expect, it } from "vitest";
import {
  applyGeneratedTtsToWords,
  hasMissingThemeTts,
  hasWordOrAnswerChanged,
  reconcileThemeWordTts,
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

describe("theme TTS invalidation rules", () => {
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

describe("safe apply of generated TTS IDs", () => {
  it("applies generated ID when source snapshot matches", () => {
    const currentWords = [makeWord({ ttsStorageId: undefined })];

    const result = applyGeneratedTtsToWords(currentWords, [
      {
        wordIndex: 0,
        sourceWord: "cat",
        sourceAnswer: "el gato",
        storageId: "st_new",
      },
    ]);

    expect(result.applied).toBe(1);
    expect(result.skipped).toBe(0);
    expect(result.words[0]?.ttsStorageId).toBe("st_new");
  });

  it("skips stale generation result when word was edited during generation", () => {
    const currentWords = [makeWord({ answer: "la gata", ttsStorageId: undefined })];

    const result = applyGeneratedTtsToWords(currentWords, [
      {
        wordIndex: 0,
        sourceWord: "cat",
        sourceAnswer: "el gato",
        storageId: "st_old_snapshot",
      },
    ]);

    expect(result.applied).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.words[0]?.ttsStorageId).toBeUndefined();
  });

  it("handles partial success with out-of-range and stale entries", () => {
    const currentWords = [
      makeWord({ word: "cat", answer: "el gato", ttsStorageId: undefined }),
      makeWord({ word: "dog", answer: "el perro", ttsStorageId: undefined }),
      makeWord({ word: "bird", answer: "el pajaro", ttsStorageId: undefined }),
    ];

    const result = applyGeneratedTtsToWords(currentWords, [
      {
        wordIndex: 0,
        sourceWord: "cat",
        sourceAnswer: "el gato",
        storageId: "st_cat",
      },
      {
        wordIndex: 1,
        sourceWord: "dog",
        sourceAnswer: "la perra",
        storageId: "st_stale",
      },
      {
        wordIndex: 10,
        sourceWord: "ghost",
        sourceAnswer: "fantasma",
        storageId: "st_out_of_range",
      },
      {
        wordIndex: 2,
        sourceWord: "bird",
        sourceAnswer: "el pajaro",
        storageId: "st_bird",
      },
    ]);

    expect(result.applied).toBe(2);
    expect(result.skipped).toBe(2);
    expect(result.words[0]?.ttsStorageId).toBe("st_cat");
    expect(result.words[1]?.ttsStorageId).toBeUndefined();
    expect(result.words[2]?.ttsStorageId).toBe("st_bird");
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

  it("only treats word or answer edits as TTS invalidation changes", () => {
    const previousWord = makeWord({
      word: "cat",
      answer: "el gato",
      wrongAnswers: ["el perro", "el pez", "el pajaro"],
    });
    const nextWordOnlyWrongChanged = makeWord({
      word: "cat",
      answer: "el gato",
      wrongAnswers: ["el leon", "el tigre", "el lobo"],
    });
    const nextWordAnswerChanged = makeWord({
      word: "cat",
      answer: "la gata",
    });
    const nextWordWordChanged = makeWord({
      word: "kitty",
      answer: "el gato",
    });

    expect(hasWordOrAnswerChanged(previousWord, nextWordOnlyWrongChanged)).toBe(false);
    expect(hasWordOrAnswerChanged(previousWord, nextWordAnswerChanged)).toBe(true);
    expect(hasWordOrAnswerChanged(previousWord, nextWordWordChanged)).toBe(true);
  });
});
