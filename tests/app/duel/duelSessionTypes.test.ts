/**
 * Coverage for the boundary narrowing helpers used by the word-only duel
 * view-model. The companion server helper `requireWordDuelQuestion` is covered
 * in `tests/convex/duelScoringRules.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  isSentenceQuestion,
  isWordQuestion,
  requireWordQuestion,
  requireWordSessionItem,
} from "@/app/duel/[duelId]/hooks/duelSessionTypes";
import type { Id } from "@/convex/_generated/dataModel";

const wordQuestion = {
  kind: "word" as const,
  options: ["a", "b", "c", "d"],
  correctOption: "a",
  difficulty: "easy" as const,
  points: 1,
};

const sentenceQuestion = {
  kind: "sentence" as const,
  englishPrompt: "Hi",
  spanishSentence: "Hola",
  tilePool: ["Hola", "x", "y", "z"],
  tileMeanings: [null, null, null, null],
};

const wordItem = {
  kind: "word" as const,
  word: "cat",
  answer: "gato",
  wrongAnswers: ["perro", "pez", "ave"],
  themeId: "theme_1" as Id<"themes">,
  themeName: "Animals",
};

const sentenceItem = {
  kind: "sentence" as const,
  englishPrompt: "Hi",
  spanishSentence: "Hola amigo",
  wordMeanings: ["hello", "friend"],
  freeWordPositions: [],
  distractors: ["a", "b", "c"],
  themeId: "theme_1" as Id<"themes">,
  themeName: "Greetings",
};

describe("requireWordQuestion", () => {
  it("returns the question unchanged when it is a word", () => {
    expect(requireWordQuestion(wordQuestion)).toBe(wordQuestion);
  });

  it("throws when called with a sentence question", () => {
    expect(() => requireWordQuestion(sentenceQuestion)).toThrow(
      /sentence question/i
    );
  });
});

describe("requireWordSessionItem", () => {
  it("returns the item unchanged when it is a word", () => {
    expect(requireWordSessionItem(wordItem)).toBe(wordItem);
  });

  it("throws when called with a sentence session item", () => {
    expect(() => requireWordSessionItem(sentenceItem)).toThrow(
      /sentence item/i
    );
  });
});

describe("isWordQuestion / isSentenceQuestion", () => {
  it("identifies the two kinds", () => {
    expect(isWordQuestion(wordQuestion)).toBe(true);
    expect(isWordQuestion(sentenceQuestion)).toBe(false);
    expect(isSentenceQuestion(sentenceQuestion)).toBe(true);
    expect(isSentenceQuestion(wordQuestion)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isWordQuestion(undefined)).toBe(false);
    expect(isSentenceQuestion(undefined)).toBe(false);
  });
});
