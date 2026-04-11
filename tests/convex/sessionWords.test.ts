import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getChallengeSessionWords,
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

describe("getChallengeSessionWords", () => {
  it("returns sessionWords when present", () => {
    const result = getChallengeSessionWords({ sessionWords: sampleWords });
    expect(result).toBe(sampleWords);
  });

  it("throws when sessionWords is empty", () => {
    expect(() => getChallengeSessionWords({ sessionWords: [] })).toThrow(
      "Challenge is missing sessionWords"
    );
  });

  it("throws when sessionWords is undefined", () => {
    expect(() =>
      getChallengeSessionWords({ sessionWords: undefined } as never)
    ).toThrow("Challenge is missing sessionWords");
  });
});

describe("summarizeSessionWords", () => {
  it("summarizes single-theme words", () => {
    const words = sampleWords.filter((w) => w.themeName === "Animals");
    expect(summarizeSessionWords(words)).toBe("Animals");
  });

  it("summarizes multi-theme words", () => {
    expect(summarizeSessionWords(sampleWords)).toBe("Animals + Food");
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
