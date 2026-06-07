import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  getSessionItems,
  summarizeSessionItems,
} from "@/convex/helpers/sessionItems";
import type { SessionWordItem } from "@/lib/sessionItems";

const themeId = (id: string) => id as Id<"themes">;

const sampleWords: SessionWordItem[] = [
  { kind: "word" as const, word: "cat", answer: "gato", wrongAnswers: ["perro"], themeId: themeId("t1"), themeName: "Animals" },
  { kind: "word" as const, word: "bread", answer: "pan", wrongAnswers: ["agua"], themeId: themeId("t2"), themeName: "Food" },
  { kind: "word" as const, word: "dog", answer: "perro", wrongAnswers: ["gato"], themeId: themeId("t1"), themeName: "Animals" },
];

describe("getSessionItems", () => {
  it("returns sessionItems when present", () => {
    const result = getSessionItems({ sessionItems: sampleWords });
    expect(result).toEqual(sampleWords);
  });

  it("throws when sessionItems is empty", () => {
    expect(() => getSessionItems({ sessionItems: [] })).toThrow(
      "Session is missing content"
    );
  });

  it("throws when sessionItems is undefined", () => {
    expect(() =>
      getSessionItems({ sessionItems: undefined } as never)
    ).toThrow("Session is missing content");
  });
});

describe("summarizeSessionItems", () => {
  it("summarizes single-theme words", () => {
    const words = sampleWords.filter((w) => w.themeName === "Animals");
    expect(summarizeSessionItems(words)).toBe("Animals");
  });

  it("summarizes multi-theme words", () => {
    expect(summarizeSessionItems(sampleWords)).toBe("2 themes");
  });

  it("returns 'Theme' for empty array", () => {
    expect(summarizeSessionItems([])).toBe("Theme");
  });
});
