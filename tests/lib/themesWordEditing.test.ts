import { describe, expect, it } from "vitest";
import {
  applyGeneratedWordEdit,
  applyManualWordEdit,
  areThemeWordsEqual,
  getWordFieldValue,
} from "@/lib/themes/wordEditing";
import type { WordEntry } from "@/lib/types";

const word: WordEntry = {
  word: "bonjour",
  answer: "hello",
  wrongAnswers: ["bye", "thanks", "please"],
  ttsStorageId: "storage-1" as WordEntry["ttsStorageId"],
};

describe("theme word editing rules", () => {
  it("compares words including wrong answers and TTS storage", () => {
    expect(areThemeWordsEqual([word], [{ ...word }])).toBe(true);
    expect(areThemeWordsEqual([word], [{ ...word, wrongAnswers: ["bye", "thanks", "yes"] }])).toBe(false);
  });

  it("reads the selected edit field value", () => {
    expect(getWordFieldValue(word, "word")).toBe("bonjour");
    expect(getWordFieldValue(word, "answer")).toBe("hello");
    expect(getWordFieldValue(word, "wrong", 1)).toBe("thanks");
  });

  it("drops stored TTS when manual word or answer edits change spoken content", () => {
    expect(applyManualWordEdit({
      previousWord: word,
      field: "answer",
      manualValue: "hi",
      wrongIndex: 0,
    })).toEqual({
      word: "bonjour",
      answer: "hi",
      wrongAnswers: ["bye", "thanks", "please"],
    });
  });

  it("keeps stored TTS when only wrong answers change", () => {
    expect(applyGeneratedWordEdit({
      previousWord: word,
      field: "wrong",
      generatedValue: "good night",
      generatedWordData: null,
      wrongIndex: 2,
    })).toEqual({
      ...word,
      wrongAnswers: ["bye", "thanks", "good night"],
    });
  });
});
