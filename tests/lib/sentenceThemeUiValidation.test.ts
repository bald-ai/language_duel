import { describe, expect, it } from "vitest";
import { analyzeSentenceThemeIssues, getSentenceThemeSaveErrorMessage } from "@/lib/themes/themeUiValidation";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";

const round = (changes: Partial<SentenceRoundInput> = {}): SentenceRoundInput => ({
  englishPrompt: "I eat", spanishSentence: "Yo como", distractors: ["bebo", "leo", "duermo"], ...changes,
});

describe("sentence editor repair projection", () => {
  it("allows valid rounds and explains an empty theme", () => {
    expect(analyzeSentenceThemeIssues([round()])).toEqual({ perRound: new Map(), hasAnyIssues: false, themeIssueMessage: null });
    expect(getSentenceThemeSaveErrorMessage([round()])).toBeNull();
    expect(getSentenceThemeSaveErrorMessage([])).toBe("Add at least one sentence before saving this theme.");
  });

  it.each([
    ["empty English", { englishPrompt: " " }, "englishHasIssue", "English prompt issue"],
    ["long English", { englishPrompt: "a".repeat(201) }, "englishHasIssue", "English prompt issue"],
    ["empty Spanish", { spanishSentence: " " }, "spanishHasIssue", "Spanish sentence missing"],
    ["short Spanish", { spanishSentence: "Yo" }, "spanishHasIssue", "Spanish sentence issue"],
    ["long Spanish", { spanishSentence: "uno dos tres cuatro cinco seis siete ocho nueve" }, "spanishHasIssue", "Spanish sentence issue"],
    ["punctuation", { spanishSentence: "Yo, como" }, "spanishHasIssue", "Spanish sentence issue"],
    ["long token", { spanishSentence: `Yo ${"a".repeat(33)}` }, "spanishHasIssue", "Spanish sentence issue"],
    ["unaligned meanings", { wordMeanings: ["I"] }, "spanishHasIssue", "Word meanings must match the Spanish words"],
    ["invalid free position", { freeWordPositions: [2] }, "spanishHasIssue", "Invalid free word position"],
  ] satisfies Array<[string, Partial<SentenceRoundInput>, string, string]>)("highlights %s on the affected round only", (_name, changes, field, message) => {
    const result = analyzeSentenceThemeIssues([round({ spanishSentence: "Tu bebes" }), round(changes)]);
    expect(result.hasAnyIssues).toBe(true);
    expect(result.perRound.has(0)).toBe(false);
    expect(result.perRound.get(1)).toEqual({
      englishHasIssue: field === "englishHasIssue", spanishHasIssue: field === "spanishHasIssue",
      distractorHasIssue: new Set(), isDuplicate: false, issueMessage: message,
    });
    expect(result.themeIssueMessage).toMatch(/^Sentence 2:/);
    expect(getSentenceThemeSaveErrorMessage([round(changes)])).toMatch(/^Sentence 1:/);
  });

  it.each([
    [["", "leo", "duermo"], [0], "Distractor field issue"],
    [["bebo", "a".repeat(33), "duermo"], [1], "Distractor field issue"],
    [["bebo", "leo", "dos palabras"], [2], "Distractor field issue"],
    [["café", " CAFE ", "cafe"], [0, 1, 2], "Distractor issue"],
    [["YO", "leo", "COMO"], [0, 2], "Distractor issue"],
    [["bebo", "leo"], [0, 1], "Distractor field issue"],
    [[], [], "Distractor field issue"],
    [["bebo", "leo", "duermo", "corro"], [0, 1, 2, 3], "Distractor field issue"],
  ] as const)("highlights offending distractors in %j", (distractors, indices, message) => {
    const result = analyzeSentenceThemeIssues([round({ distractors: [...distractors] })]);
    expect(result.perRound.get(0)).toEqual({ englishHasIssue: false, spanishHasIssue: false,
      distractorHasIssue: new Set(indices), isDuplicate: false, issueMessage: message });
    expect(result.hasAnyIssues).toBe(true);
  });

  it("marks all duplicate rounds while preserving each round's first field error", () => {
    const result = analyzeSentenceThemeIssues([
      round({ englishPrompt: "" }), round({ spanishSentence: " YO  COMO " }), round({ spanishSentence: "yo como" }),
    ]);
    expect(result.themeIssueMessage).toBe("Sentence 1: English prompt must be at least 1 character");
    expect([...result.perRound.values()].map(slot => [slot.isDuplicate, slot.spanishHasIssue, slot.issueMessage])).toEqual([
      [true, true, "English prompt issue"], [true, true, "Duplicate sentence"], [true, true, "Duplicate sentence"],
    ]);
    expect(result.perRound.get(0)?.englishHasIssue).toBe(true);
    expect(result.perRound.get(1)?.englishHasIssue).toBe(false);
  });
});
