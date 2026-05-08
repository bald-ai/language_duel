import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getSessionWords,
  summarizeSessionWords,
  getThemeIdsFromSessionWords,
} from "@/convex/helpers/sessionWords";
import type { SessionWordEntry } from "@/lib/sessionWords";

const themeId = (id: string) => id as Id<"themes">;

const sampleWords: SessionWordEntry[] = [
  { word: "cat", answer: "gato", wrongAnswers: ["perro"], themeId: themeId("t1"), themeName: "Animals" },
  { word: "bread", answer: "pan", wrongAnswers: ["agua"], themeId: themeId("t2"), themeName: "Food" },
  { word: "dog", answer: "perro", wrongAnswers: ["gato"], themeId: themeId("t1"), themeName: "Animals" },
];

describe("getSessionWords", () => {
  it("returns sessionWords when present", () => {
    const result = getSessionWords({ sessionWords: sampleWords });
    expect(result).toEqual(sampleWords);
  });

  it("throws when sessionWords is empty", () => {
    expect(() => getSessionWords({ sessionWords: [] })).toThrow(
      "Session is missing words"
    );
  });

  it("throws when sessionWords is undefined", () => {
    expect(() =>
      getSessionWords({ sessionWords: undefined } as never)
    ).toThrow("Session is missing words");
  });
});

describe("summarizeSessionWords", () => {
  it("summarizes single-theme words", () => {
    const words = sampleWords.filter((w) => w.themeName === "Animals");
    expect(summarizeSessionWords(words)).toBe("Animals");
  });

  it("summarizes multi-theme words", () => {
    expect(summarizeSessionWords(sampleWords)).toBe("2 themes");
  });

  it("returns 'Theme' for empty array", () => {
    expect(summarizeSessionWords([])).toBe("Theme");
  });
});

describe("getThemeIdsFromSessionWords", () => {
  it("returns unique theme ids in order", () => {
    expect(getThemeIdsFromSessionWords(sampleWords)).toEqual([
      themeId("t1"),
      themeId("t2"),
    ]);
  });

  it("returns empty array for no words", () => {
    expect(getThemeIdsFromSessionWords([])).toEqual([]);
  });
});
