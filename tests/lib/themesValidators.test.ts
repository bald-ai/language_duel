import { describe, expect, it } from "vitest";
import {
  checkThemeForDuplicateWords,
  checkThemeForDuplicateWrongAnswers,
  checkThemeForWrongMatchingAnswer,
  doesWrongAnswerMatchCorrect,
  getDuplicateWrongAnswerIndices,
  getDuplicateWordIndices,
  getThemeRepairIssueForFlags,
  getThemeRepairIssueForWords,
  getWrongIndicesMatchingAnswer,
  hasDuplicateWrongAnswersInWord,
  isWordDuplicate,
} from "@/lib/themes/validators";
import type { WordEntry } from "@/lib/types";

describe("themes validators", () => {
  it("detects duplicate wrong answers with relaxed normalization", () => {
    const word: WordEntry = {
      word: "cat",
      answer: "el gato",
      wrongAnswers: ["café", " cafe ", "el perro"],
    };

    expect(hasDuplicateWrongAnswersInWord(word)).toBe(true);
    expect(checkThemeForDuplicateWrongAnswers([word])).toBe(true);
    expect([...getDuplicateWrongAnswerIndices(word)].sort((a, b) => a - b)).toEqual([0, 1]);
  });

  it("detects wrong answer matching the correct answer (including Irr marker stripping)", () => {
    const word: WordEntry = {
      word: "coffee",
      answer: " el  café ",
      wrongAnswers: ["EL cafe", "té", "agua"],
    };

    expect(doesWrongAnswerMatchCorrect(word)).toBe(true);
    expect(checkThemeForWrongMatchingAnswer([word])).toBe(true);
    expect([...getWrongIndicesMatchingAnswer(word)]).toEqual([0]);
  });

  it("detects duplicate words and returns all duplicate indices", () => {
    const words: WordEntry[] = [
      { word: "inglés", answer: "el ingles", wrongAnswers: ["la casa", "el perro", "el libro"] },
      { word: "dog", answer: "el perro", wrongAnswers: ["el gato", "la casa", "el libro"] },
      { word: " INGLES ", answer: "gato", wrongAnswers: ["la mesa", "la silla", "la puerta"] },
    ];

    expect(checkThemeForDuplicateWords(words)).toBe(true);
    expect([...getDuplicateWordIndices(words)].sort((a, b) => a - b)).toEqual([0, 2]);
  });

  it("checks duplicate word against existing word list", () => {
    const words: WordEntry[] = [
      { word: "inglés", answer: "el gato", wrongAnswers: ["la casa", "el perro", "el libro"] },
    ];

    expect(isWordDuplicate(" ingles ", words)).toBe(true);
    expect(isWordDuplicate("dog", words)).toBe(false);
  });

  it("uses one shared priority for card and save messages", () => {
    const issue = getThemeRepairIssueForFlags({
      hasDuplicateWord: true,
      wrongMatchesAnswer: true,
      hasDuplicateWrongAnswers: true,
    });

    expect(issue?.type).toBe("duplicate_word");
    expect(issue?.cardMessage).toBe("Duplicate word");
    expect(issue?.saveToastMessage).toContain("duplicate words");
  });

  it("returns the highest-priority theme issue for a full word list", () => {
    const words: WordEntry[] = [
      { word: "cat", answer: "kocka", wrongAnswers: ["KOCKA", "auto", "auto"] },
      { word: "cat", answer: "macka", wrongAnswers: ["rieka", "hora", "cesta"] },
    ];

    expect(getThemeRepairIssueForWords(words)?.type).toBe("duplicate_word");
  });
});
