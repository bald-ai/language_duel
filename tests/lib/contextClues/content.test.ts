import { describe, expect, it } from "vitest";
import {
  CONTEXT_CLUES_CONTENT,
  GLOSS_BLANK,
  OPTIONS_PER_ITEM,
  VARIANT_META,
  VARIANT_ORDER,
  getItems,
  type ContextCluesItem,
} from "@/lib/contextClues";

function allItems(): ContextCluesItem[] {
  return VARIANT_ORDER.flatMap((variant) => getItems(variant));
}

describe("context clues content", () => {
  it("exposes a non-empty item set for every variant", () => {
    for (const variant of VARIANT_ORDER) {
      expect(getItems(variant).length).toBeGreaterThan(0);
      expect(CONTEXT_CLUES_CONTENT[variant]).toBe(getItems(variant));
    }
  });

  it("keeps item ids globally unique", () => {
    const ids = allItems().map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("buckets every item under its declared variant", () => {
    for (const variant of VARIANT_ORDER) {
      for (const item of getItems(variant)) {
        expect(item.variant).toBe(variant);
      }
    }
  });

  it("gives each item three options with exactly one correct answer", () => {
    for (const item of allItems()) {
      expect(item.options).toHaveLength(OPTIONS_PER_ITEM);
      const correct = item.options.filter((option) => option.isCorrect);
      expect(correct).toHaveLength(1);
      const texts = item.options.map((option) => option.text.trim());
      expect(texts.every((text) => text.length > 0)).toBe(true);
      expect(new Set(texts).size).toBe(texts.length);
      expect(item.explanation.trim().length).toBeGreaterThan(0);
    }
  });

  it("builds infer-word items whose target is shown in the sentence with a blanked gloss", () => {
    for (const item of getItems("infer_word")) {
      if (item.variant !== "infer_word") continue;
      expect(item.target.trim().length).toBeGreaterThan(0);
      expect(item.sentence).toContain(item.target);
      expect(item.glossWithBlank).toContain(GLOSS_BLANK);
    }
  });

  it("builds story items with a non-empty passage and question", () => {
    for (const item of getItems("story_detective")) {
      if (item.variant !== "story_detective") continue;
      expect(item.passage.length).toBeGreaterThan(0);
      expect(item.passage.every((line) => line.trim().length > 0)).toBe(true);
      expect(item.question.trim().length).toBeGreaterThan(0);
    }
  });

  it("builds pattern items with at least two worked examples and a prompt", () => {
    for (const item of getItems("spot_pattern")) {
      if (item.variant !== "spot_pattern") continue;
      expect(item.examples.length).toBeGreaterThanOrEqual(2);
      expect(
        item.examples.every((example) => example.from.trim().length > 0 && example.to.trim().length > 0)
      ).toBe(true);
      expect(item.prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("describes every variant in VARIANT_META", () => {
    for (const variant of VARIANT_ORDER) {
      const meta = VARIANT_META[variant];
      expect(meta.variant).toBe(variant);
      expect(meta.label.trim().length).toBeGreaterThan(0);
      expect(meta.tagline.trim().length).toBeGreaterThan(0);
      expect(meta.instruction.trim().length).toBeGreaterThan(0);
    }
  });
});
