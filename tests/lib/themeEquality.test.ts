import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { areSentenceRoundsEqual } from "@/lib/themes/sentenceEditing";
import { areThemeWordsEqual } from "@/lib/themes/wordEditing";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";
import type { WordEntry } from "@/lib/types";

const round: SentenceRoundInput = { englishPrompt: "The cat", spanishSentence: "El gato", distractors: ["la", "perro"], wordMeanings: ["The", "cat"], freeWordPositions: [0] };
const word: WordEntry = { word: "cat", answer: "gato", wrongAnswers: ["perro", "pez"] };

describe("unsaved theme content comparison", () => {
  it("compares independently allocated content and empty lists", () => {
    expect(areSentenceRoundsEqual([round], [structuredClone(round)])).toBe(true);
    expect(areThemeWordsEqual([word], [structuredClone(word)])).toBe(true);
    expect(areSentenceRoundsEqual([], [])).toBe(true);
    expect(areThemeWordsEqual([], [])).toBe(true);
  });
  it.each([
    { englishPrompt: "A cat" }, { spanishSentence: "Un gato" },
    { wordMeanings: ["A", "cat"] }, { wordMeanings: ["cat"] },
    { freeWordPositions: [1] }, { freeWordPositions: [] },
    { distractors: ["el", "perro"] }, { distractors: ["la"] },
    { ttsStorageId: "audio" as Id<"_storage"> },
  ] satisfies Partial<SentenceRoundInput>[])("detects sentence edits %j", change => {
    expect(areSentenceRoundsEqual([round], [{ ...round, ...change }])).toBe(false);
  });
  it("treats absent optional sentence lists as empty and retains matching audio", () => {
    const minimal = { ...round, wordMeanings: undefined, freeWordPositions: undefined, ttsStorageId: "audio" as Id<"_storage"> };
    expect(areSentenceRoundsEqual([minimal], [{ ...minimal, wordMeanings: [], freeWordPositions: [] }])).toBe(true);
    expect(areSentenceRoundsEqual([{ ...minimal, wordMeanings: [], freeWordPositions: [] }], [minimal])).toBe(true);
  });
  it.each([{ word: "dog" }, { answer: "perro" }, { wrongAnswers: ["pez"] }, { wrongAnswers: ["pez", "perro"] }, { ttsStorageId: "audio" as Id<"_storage"> }] satisfies Partial<WordEntry>[])("detects word edits %j", change => {
    expect(areThemeWordsEqual([word], [{ ...word, ...change }])).toBe(false);
  });
  it("retains matching word audio", () => {
    expect(areThemeWordsEqual([{ ...word, ttsStorageId: "audio" as Id<"_storage"> }], [{ ...word, ttsStorageId: "audio" as Id<"_storage"> }])).toBe(true);
  });
  it("rejects changed lengths and sparse content entries on either side", () => {
    expect(areSentenceRoundsEqual([round], [])).toBe(false);
    expect(areThemeWordsEqual([word], [])).toBe(false);
    expect(areSentenceRoundsEqual(Array(1), [round])).toBe(false);
    expect(areSentenceRoundsEqual([round], Array(1))).toBe(false);
    expect(areThemeWordsEqual(Array(1), [word])).toBe(false);
    expect(areThemeWordsEqual([word], Array(1))).toBe(false);
  });
});
