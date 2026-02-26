import { describe, expect, it } from "vitest";
import {
  checkThemeForDuplicateWords,
  checkThemeForDuplicateWrongAnswers,
  checkThemeForWrongMatchingAnswer,
  doesWrongAnswerMatchCorrect,
  getDuplicateWordIndices,
  hasDuplicateWrongAnswersInWord,
  isWordDuplicate,
} from "@/lib/themes/validators";
import type { WordEntry } from "@/lib/types";

describe("themes validators", () => {
  it("detects duplicate wrong answers with relaxed normalization", () => {
    const word: WordEntry = {
      word: "cat",
      answer: "el gato",
      wrongAnswers: ["la casa", " LA CASA ", "el perro"],
    };

    expect(hasDuplicateWrongAnswersInWord(word)).toBe(true);
    expect(checkThemeForDuplicateWrongAnswers([word])).toBe(true);
  });

  it("detects wrong answer matching the correct answer (including Irr marker stripping)", () => {
    const word: WordEntry = {
      word: "go",
      answer: "ir(Irr)",
      wrongAnswers: ["ir", "venir", "hablar"],
    };

    expect(doesWrongAnswerMatchCorrect(word)).toBe(true);
    expect(checkThemeForWrongMatchingAnswer([word])).toBe(true);
  });

  it("detects duplicate words and returns all duplicate indices", () => {
    const words: WordEntry[] = [
      { word: "cat", answer: "el gato", wrongAnswers: ["la casa", "el perro", "el libro"] },
      { word: "dog", answer: "el perro", wrongAnswers: ["el gato", "la casa", "el libro"] },
      { word: " CAT ", answer: "gato", wrongAnswers: ["la mesa", "la silla", "la puerta"] },
    ];

    expect(checkThemeForDuplicateWords(words)).toBe(true);
    expect([...getDuplicateWordIndices(words)].sort((a, b) => a - b)).toEqual([0, 2]);
  });

  it("checks duplicate word against existing word list", () => {
    const words: WordEntry[] = [
      { word: "cat", answer: "el gato", wrongAnswers: ["la casa", "el perro", "el libro"] },
    ];

    expect(isWordDuplicate(" CAT ", words)).toBe(true);
    expect(isWordDuplicate("dog", words)).toBe(false);
  });
});
