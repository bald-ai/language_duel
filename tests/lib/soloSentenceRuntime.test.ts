import { describe, expect, it } from "vitest";
import {
  answerSentenceCorrect,
  answerSentenceIncorrect,
  blanksForLevel,
  buildSoloSentenceCloze,
  sentenceBlankPositions,
  sentenceMaxLevel,
  validateSoloSentenceClozeAnswer,
  type SoloSentenceMasteryState,
} from "@/lib/soloSentenceRuntime";
import type { SessionSentenceItem } from "@/lib/sessionItems";
import type { Id } from "@/convex/_generated/dataModel";

function sentenceItem(overrides: Partial<SessionSentenceItem> = {}): SessionSentenceItem {
  return {
    kind: "sentence",
    englishPrompt: "I drink cold water",
    spanishSentence: "Yo bebo agua fria",
    wordMeanings: ["I", "drink", "water", "cold"],
    freeWordPositions: [2],
    distractors: ["pan", "leche", "caliente"],
    themeId: "theme_1" as Id<"themes">,
    themeName: "Basics",
    ...overrides,
  };
}

describe("soloSentenceRuntime", () => {
  // Level 0 is recognition (0 blanks); build rungs grow from 2 blanks up to the
  // full build, with every 2+ word sentence getting at least one build rung.
  it.each([
    { tokenCount: 2, maxLevel: 1, blanks: [0, 2] },
    { tokenCount: 3, maxLevel: 2, blanks: [0, 2, 3] },
    { tokenCount: 4, maxLevel: 3, blanks: [0, 2, 3, 4] },
    { tokenCount: 5, maxLevel: 3, blanks: [0, 2, 4, 5] },
    { tokenCount: 6, maxLevel: 3, blanks: [0, 2, 4, 6] },
    { tokenCount: 9, maxLevel: 3, blanks: [0, 2, 6, 9] },
  ])("caps and spaces blanks for $tokenCount tokens", ({ tokenCount, maxLevel, blanks }) => {
    expect(sentenceMaxLevel(tokenCount)).toBe(maxLevel);
    expect(blanks.map((_, level) => blanksForLevel(level, tokenCount))).toEqual(blanks);
  });

  it("keeps blank growth nested as levels climb", () => {
    const sentence = "Uno dos tres cuatro cinco seis siete";
    const level0 = new Set(sentenceBlankPositions(sentence, 0));
    const level1 = new Set(sentenceBlankPositions(sentence, 1));
    const level2 = new Set(sentenceBlankPositions(sentence, 2));
    const level3 = new Set(sentenceBlankPositions(sentence, 3));

    expect([...level0].every((position) => level1.has(position))).toBe(true);
    expect([...level1].every((position) => level2.has(position))).toBe(true);
    expect([...level2].every((position) => level3.has(position))).toBe(true);
    expect(level3.size).toBe(7);
  });

  it("builds a bank from exactly the blanked tokens and shows meanings only for free blanked words", () => {
    const item = sentenceItem();
    // Build the top rung (full build) so every token is blanked and the free
    // word's meaning is deterministically present.
    const cloze = buildSoloSentenceCloze(item, 3);
    const blankTokens = cloze.blankPositions.map(
      (position) => cloze.tokens[position]?.text
    );

    expect(cloze.bank.map((chip) => chip.text).sort()).toEqual(
      [...blankTokens].sort()
    );
    expect(cloze.bank).toHaveLength(cloze.blankPositions.length);
    expect(cloze.bank.find((chip) => chip.tokenIndex === 2)?.meaning).toBe("water");
    expect(
      cloze.bank
        .filter((chip) => chip.tokenIndex !== 2)
        .every((chip) => chip.meaning === null)
    ).toBe(true);
  });

  it("validates filled blanks with the shared normalized comparison", () => {
    const item = sentenceItem({ spanishSentence: "Yo bebo agua" });
    const blankPositions = [0, 2];

    expect(
      validateSoloSentenceClozeAnswer({
        spanishSentence: item.spanishSentence,
        blankPositions,
        filledTokens: ["yo", "água"],
      })
    ).toBe(true);
    expect(
      validateSoloSentenceClozeAnswer({
        spanishSentence: item.spanishSentence,
        blankPositions,
        filledTokens: ["agua", "yo"],
      })
    ).toBe(false);
  });

  it("moves sentence mastery one rung up, completes at max, and drops one rung on wrong", () => {
    const base: SoloSentenceMasteryState = {
      masteryLevel: 1,
      maxLevel: 2,
      completedMaxLevel: false,
      answeredExpansionGate: false,
    };

    const correct = answerSentenceCorrect(base, 1);
    expect(correct.masteryLevel).toBe(2);
    expect(correct.completedMaxLevel).toBe(false);
    expect(correct.answeredExpansionGate).toBe(false);

    const completed = answerSentenceCorrect(correct, 2);
    expect(completed.masteryLevel).toBe(2);
    expect(completed.completedMaxLevel).toBe(true);
    expect(completed.answeredExpansionGate).toBe(true);

    const dropped = answerSentenceIncorrect(completed);
    expect(dropped.masteryLevel).toBe(1);
    expect(dropped.completedMaxLevel).toBe(false);
  });
});
