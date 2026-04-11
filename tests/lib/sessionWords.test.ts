import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildSessionWords,
  getUniqueThemeIds,
  getUniqueThemeNames,
  summarizeThemeNames,
  summarizeThemes,
  type SessionThemeInput,
  type SessionWordEntry,
} from "@/lib/sessionWords";

const themeId = (id: string) => id as Id<"themes">;

const themeA: SessionThemeInput = {
  _id: themeId("theme_a"),
  name: "Animals",
  words: [
    { word: "cat", answer: "gato", wrongAnswers: ["perro", "pez"] },
    { word: "dog", answer: "perro", wrongAnswers: ["gato", "pez"] },
  ],
};

const themeB: SessionThemeInput = {
  _id: themeId("theme_b"),
  name: "Food",
  words: [
    { word: "bread", answer: "pan", wrongAnswers: ["agua", "leche"] },
  ],
};

const themeWithTts: SessionThemeInput = {
  _id: themeId("theme_tts"),
  name: "TTS Theme",
  words: [
    {
      word: "hello",
      answer: "hola",
      wrongAnswers: ["adiós"],
      ttsStorageId: "storage_1" as Id<"_storage">,
    },
  ],
};

describe("buildSessionWords", () => {
  it("returns empty array for no themes", () => {
    expect(buildSessionWords([])).toEqual([]);
  });

  it("flattens a single theme with themeId and themeName", () => {
    const result = buildSessionWords([themeB]);
    expect(result).toEqual([
      {
        word: "bread",
        answer: "pan",
        wrongAnswers: ["agua", "leche"],
        themeId: themeId("theme_b"),
        themeName: "Food",
      },
    ]);
  });

  it("flattens multiple themes preserving order", () => {
    const result = buildSessionWords([themeA, themeB]);
    expect(result).toHaveLength(3);
    expect(result[0].themeName).toBe("Animals");
    expect(result[1].themeName).toBe("Animals");
    expect(result[2].themeName).toBe("Food");
  });

  it("preserves ttsStorageId when present", () => {
    const result = buildSessionWords([themeWithTts]);
    expect(result[0].ttsStorageId).toBe("storage_1");
  });

  it("omits ttsStorageId when absent", () => {
    const result = buildSessionWords([themeA]);
    expect(result[0].ttsStorageId).toBeUndefined();
  });
});

describe("getUniqueThemeIds", () => {
  it("returns empty array for no words", () => {
    expect(getUniqueThemeIds([])).toEqual([]);
  });

  it("returns single id for single-theme words", () => {
    const words = buildSessionWords([themeA]);
    expect(getUniqueThemeIds(words)).toEqual([themeId("theme_a")]);
  });

  it("returns ids in first-seen order and deduplicates", () => {
    const words = buildSessionWords([themeA, themeB, themeA]);
    expect(getUniqueThemeIds(words)).toEqual([themeId("theme_a"), themeId("theme_b")]);
  });
});

describe("getUniqueThemeNames", () => {
  it("returns empty array for no words", () => {
    expect(getUniqueThemeNames([])).toEqual([]);
  });

  it("returns unique names in first-seen order", () => {
    const words = buildSessionWords([themeA, themeB]);
    expect(getUniqueThemeNames(words)).toEqual(["Animals", "Food"]);
  });

  it("deduplicates by themeId + themeName", () => {
    const words = buildSessionWords([themeA, themeA]);
    expect(getUniqueThemeNames(words)).toEqual(["Animals"]);
  });
});

describe("summarizeThemeNames", () => {
  it("returns 'Theme' for empty array", () => {
    expect(summarizeThemeNames([])).toBe("Theme");
  });

  it("returns the name for a single theme", () => {
    expect(summarizeThemeNames(["Animals"])).toBe("Animals");
  });

  it("joins two names with +", () => {
    expect(summarizeThemeNames(["Animals", "Food"])).toBe("Animals + Food");
  });

  it("summarizes 3+ as first + N more themes", () => {
    expect(summarizeThemeNames(["A", "B", "C"])).toBe("A + 2 more themes");
  });

  it("summarizes 4 themes correctly", () => {
    expect(summarizeThemeNames(["A", "B", "C", "D"])).toBe("A + 3 more themes");
  });
});

describe("summarizeThemes", () => {
  it("delegates to summarizeThemeNames using theme names", () => {
    expect(summarizeThemes([themeA, themeB])).toBe("Animals + Food");
  });

  it("returns 'Theme' for empty array", () => {
    expect(summarizeThemes([])).toBe("Theme");
  });
});
