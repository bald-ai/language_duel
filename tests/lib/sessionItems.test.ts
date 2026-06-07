import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildSessionItems,
  getUniqueThemeIds,
  summarizeThemeNames,
  summarizeThemes,
  type SessionThemeInput,
} from "@/lib/sessionItems";

const themeId = (id: string) => id as Id<"themes">;

const themeA: SessionThemeInput = {
  _id: themeId("theme_a"),
  name: "Animals",
  contentType: "word",
  words: [
    { word: "cat", answer: "gato", wrongAnswers: ["perro", "pez"] },
    { word: "dog", answer: "perro", wrongAnswers: ["gato", "pez"] },
  ],
};

const themeB: SessionThemeInput = {
  _id: themeId("theme_b"),
  name: "Food",
  contentType: "word",
  words: [
    { word: "bread", answer: "pan", wrongAnswers: ["agua", "leche"] },
  ],
};

const themeWithTts: SessionThemeInput = {
  _id: themeId("theme_tts"),
  name: "TTS Theme",
  contentType: "word",
  words: [
    {
      word: "hello",
      answer: "hola",
      wrongAnswers: ["adiós"],
      ttsStorageId: "storage_1" as Id<"_storage">,
    },
  ],
};

const sentenceThemeWithTts: SessionThemeInput = {
  _id: themeId("theme_sentence_tts"),
  name: "Sentence TTS",
  contentType: "sentence",
  sentenceRounds: [
    {
      englishPrompt: "I drink water",
      spanishSentence: "Yo bebo agua",
      wordMeanings: ["I", "drink", "water"],
      freeWordPositions: [2],
      distractors: ["pan", "leche", "cafe"],
      ttsStorageId: "storage_sentence_1" as Id<"_storage">,
    },
  ],
};

describe("buildSessionItems", () => {
  it("returns empty array for no themes", () => {
    expect(buildSessionItems([])).toEqual([]);
  });

  it("flattens a single theme with themeId and themeName", () => {
    const result = buildSessionItems([themeB]);
    expect(result).toEqual([
      {
        kind: "word" as const, word: "bread",
        answer: "pan",
        wrongAnswers: ["agua", "leche"],
        themeId: themeId("theme_b"),
        themeName: "Food",
      },
    ]);
  });

  it("flattens multiple themes preserving order", () => {
    const result = buildSessionItems([themeA, themeB]);
    expect(result).toHaveLength(3);
    expect(result[0].themeName).toBe("Animals");
    expect(result[1].themeName).toBe("Animals");
    expect(result[2].themeName).toBe("Food");
  });

  it("preserves ttsStorageId when present", () => {
    const result = buildSessionItems([themeWithTts]);
    const first = result[0];
    if (first.kind !== "word") throw new Error("expected word session item");
    expect(first.ttsStorageId).toBe("storage_1");
  });

  it("omits ttsStorageId when absent", () => {
    const result = buildSessionItems([themeA]);
    const first = result[0];
    if (first.kind !== "word") throw new Error("expected word session item");
    expect(first.ttsStorageId).toBeUndefined();
  });

  it("preserves sentence ttsStorageId when present", () => {
    const result = buildSessionItems([sentenceThemeWithTts]);
    const first = result[0];
    if (first.kind !== "sentence") throw new Error("expected sentence session item");
    expect(first.ttsStorageId).toBe("storage_sentence_1");
  });
});

describe("getUniqueThemeIds", () => {
  it("returns empty array for no words", () => {
    expect(getUniqueThemeIds([])).toEqual([]);
  });

  it("returns single id for single-theme words", () => {
    const words = buildSessionItems([themeA]);
    expect(getUniqueThemeIds(words)).toEqual([themeId("theme_a")]);
  });

  it("returns ids in first-seen order and deduplicates", () => {
    const words = buildSessionItems([themeA, themeB, themeA]);
    expect(getUniqueThemeIds(words)).toEqual([themeId("theme_a"), themeId("theme_b")]);
  });
});

describe("summarizeThemeNames", () => {
  it("returns 'Theme' for empty array", () => {
    expect(summarizeThemeNames([])).toBe("Theme");
  });

  it("returns the name for a single theme", () => {
    expect(summarizeThemeNames(["Animals"])).toBe("Animals");
  });

  it("summarizes two themes as count", () => {
    expect(summarizeThemeNames(["Animals", "Food"])).toBe("2 themes");
  });

  it("summarizes 3+ themes as count", () => {
    expect(summarizeThemeNames(["A", "B", "C"])).toBe("3 themes");
  });

  it("summarizes 4 themes correctly", () => {
    expect(summarizeThemeNames(["A", "B", "C", "D"])).toBe("4 themes");
  });
});

describe("summarizeThemes", () => {
  it("delegates to summarizeThemeNames using theme names", () => {
    expect(summarizeThemes([themeA, themeB])).toBe("2 themes");
  });

  it("returns 'Theme' for empty array", () => {
    expect(summarizeThemes([])).toBe("Theme");
  });
});
