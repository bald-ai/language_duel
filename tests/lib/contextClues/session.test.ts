import { describe, expect, it } from "vitest";
import {
  advanceRound,
  answerOption,
  createRound,
  currentItem,
  getItems,
  isLastItem,
  isSelectionCorrect,
  OPTIONS_PER_ITEM,
  selectedOption,
  VARIANT_ORDER,
  type ContextCluesRound,
} from "@/lib/contextClues";

function correctOptionId(round: ContextCluesRound): string {
  const option = currentItem(round).options.find((candidate) => candidate.isCorrect);
  if (!option) throw new Error("expected a correct option");
  return option.id;
}

function wrongOptionId(round: ContextCluesRound): string {
  const option = currentItem(round).options.find((candidate) => !candidate.isCorrect);
  if (!option) throw new Error("expected a wrong option");
  return option.id;
}

function optionOrderSignature(round: ContextCluesRound): string {
  return round.items.map((prepared) => prepared.options.map((option) => option.id).join(",")).join("|");
}

describe("createRound", () => {
  it("starts a fresh answering round covering every content item", () => {
    for (const variant of VARIANT_ORDER) {
      const round = createRound(variant);
      expect(round.variant).toBe(variant);
      expect(round.index).toBe(0);
      expect(round.status).toBe("answering");
      expect(round.correctCount).toBe(0);
      expect(round.selectedOptionId).toBeNull();
      expect(round.items).toHaveLength(getItems(variant).length);
    }
  });

  it("prepares three options per item with exactly one correct, ids unique within the item", () => {
    const round = createRound("infer_word", 5);
    for (const prepared of round.items) {
      expect(prepared.options).toHaveLength(OPTIONS_PER_ITEM);
      expect(prepared.options.filter((option) => option.isCorrect)).toHaveLength(1);
      const ids = prepared.options.map((option) => option.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("is deterministic for a given seed and reshuffles for a different seed", () => {
    const a = createRound("infer_word", 7);
    const b = createRound("infer_word", 7);
    expect(optionOrderSignature(a)).toBe(optionOrderSignature(b));

    const allFirstSeed = VARIANT_ORDER.map((variant) => optionOrderSignature(createRound(variant, 1))).join("#");
    const allSecondSeed = VARIANT_ORDER.map((variant) => optionOrderSignature(createRound(variant, 2))).join("#");
    expect(allFirstSeed).not.toBe(allSecondSeed);
  });
});

describe("answerOption", () => {
  it("records a correct answer and scores it once", () => {
    const round = createRound("spot_pattern", 3);
    const answered = answerOption(round, correctOptionId(round));
    expect(answered.status).toBe("answered");
    expect(answered.selectedOptionId).toBe(correctOptionId(round));
    expect(answered.correctCount).toBe(1);
    expect(isSelectionCorrect(answered)).toBe(true);
    expect(selectedOption(answered)?.isCorrect).toBe(true);
  });

  it("records a wrong answer without scoring", () => {
    const round = createRound("spot_pattern", 3);
    const answered = answerOption(round, wrongOptionId(round));
    expect(answered.status).toBe("answered");
    expect(answered.correctCount).toBe(0);
    expect(isSelectionCorrect(answered)).toBe(false);
  });

  it("ignores a second answer once the item is answered", () => {
    const round = createRound("spot_pattern", 3);
    const answered = answerOption(round, correctOptionId(round));
    const again = answerOption(answered, wrongOptionId(round));
    expect(again).toBe(answered);
    expect(again.correctCount).toBe(1);
  });

  it("ignores an unknown option id", () => {
    const round = createRound("infer_word", 3);
    const result = answerOption(round, "does-not-exist");
    expect(result).toBe(round);
    expect(result.status).toBe("answering");
  });
});

describe("advanceRound", () => {
  it("does nothing while still answering", () => {
    const round = createRound("infer_word", 3);
    expect(advanceRound(round)).toBe(round);
  });

  it("moves to the next item and clears the selection", () => {
    const round = answerOption(createRound("infer_word", 3), correctOptionId(createRound("infer_word", 3)));
    const next = advanceRound(round);
    expect(next.index).toBe(1);
    expect(next.status).toBe("answering");
    expect(next.selectedOptionId).toBeNull();
    expect(next.correctCount).toBe(round.correctCount);
  });

  it("completes the round after the final item", () => {
    let round = createRound("story_detective", 9);
    const total = round.items.length;
    for (let step = 0; step < total; step += 1) {
      expect(isLastItem(round)).toBe(step === total - 1);
      round = answerOption(round, correctOptionId(round));
      round = advanceRound(round);
    }
    expect(round.status).toBe("complete");
    expect(round.correctCount).toBe(total);
  });

  it("ignores answers once complete", () => {
    let round = createRound("story_detective", 9);
    while (round.status !== "complete") {
      round = advanceRound(answerOption(round, correctOptionId(round)));
    }
    const afterComplete = answerOption(round, correctOptionId(createRound("story_detective", 9)));
    expect(afterComplete).toBe(round);
  });
});

describe("selection helpers", () => {
  it("returns null selection before answering", () => {
    const round = createRound("infer_word", 1);
    expect(selectedOption(round)).toBeNull();
    expect(isSelectionCorrect(round)).toBe(false);
  });
});
