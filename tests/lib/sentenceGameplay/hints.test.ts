import { describe, expect, it } from "vitest";
import {
  buildTileSolution,
  resolveSentenceHint,
} from "@/lib/sentenceGameplay/hints";

// "el gato el perro" (the cat the dog) — a repeated "el" so the duplicate-word
// branches are exercised. Pool: [0]=el [1]=gato [2]=el [3]=perro [4]=raton(decoy).
const DUP_POOL = ["el", "gato", "el", "perro", "raton"];
const DUP_SENTENCE = "el gato el perro";

describe("buildTileSolution", () => {
  it("maps each slot to every valid pool index and finds distractors (duplicates)", () => {
    const { positionToTileIndices, distractorTileIndices } = buildTileSolution(
      DUP_POOL,
      DUP_SENTENCE
    );
    expect(positionToTileIndices).toEqual([[0, 2], [1], [0, 2], [3]]);
    expect(distractorTileIndices).toEqual([4]);
  });

  it("normalizes case/accents/punctuation when matching tiles to slots", () => {
    const { positionToTileIndices, distractorTileIndices } = buildTileSolution(
      ["Quiero", "cafe.", "leche"],
      "Quiero cafe."
    );
    expect(positionToTileIndices).toEqual([[0], [1]]);
    expect(distractorTileIndices).toEqual([2]);
  });
});

describe("resolveSentenceHint", () => {
  const baseArgs = {
    tilePool: DUP_POOL,
    spanishSentence: DUP_SENTENCE,
    alreadyEliminated: [] as number[],
    seed: 123,
  };

  it("freeze_time grants +30s and no tile effects", () => {
    const effect = resolveSentenceHint("freeze_time", baseArgs);
    expect(effect.timerBonusSeconds).toBe(30);
    expect(effect.eliminatedTileIndices).toEqual([]);
    expect(effect.revealedTiles).toEqual([]);
  });

  it("remove_distractor eliminates every decoy and grants the universal +10s", () => {
    const effect = resolveSentenceHint("remove_distractor", baseArgs);
    expect(effect.eliminatedTileIndices).toEqual([4]);
    expect(effect.timerBonusSeconds).toBe(10);
    expect(effect.revealedTiles).toEqual([]);
  });

  it("remove_distractor skips already-eliminated indices", () => {
    const effect = resolveSentenceHint("remove_distractor", {
      ...baseArgs,
      alreadyEliminated: [4],
    });
    expect(effect.eliminatedTileIndices).toEqual([]);
  });

  it("reveal_tiles reveals min(2, tokenCount-1) slots, each carrying its valid tiles, +10s", () => {
    const effect = resolveSentenceHint("reveal_tiles", baseArgs);
    expect(effect.timerBonusSeconds).toBe(10);
    expect(effect.revealedTiles).toHaveLength(2);
    const { positionToTileIndices } = buildTileSolution(
      baseArgs.tilePool,
      baseArgs.spanishSentence
    );
    for (const reveal of effect.revealedTiles) {
      expect(reveal.tileIndices).toEqual(positionToTileIndices[reveal.position]);
    }
  });

  it("reveal_tiles never reveals the whole sentence (short-sentence guard)", () => {
    // 2-token sentence → min(2, 2 - 1) = 1 revealed slot, never both.
    const effect = resolveSentenceHint("reveal_tiles", {
      tilePool: ["Quiero", "cafe.", "leche"],
      spanishSentence: "Quiero cafe.",
      alreadyEliminated: [],
      seed: 7,
    });
    expect(effect.revealedTiles).toHaveLength(1);
  });

  it("reveal_tiles is deterministic for a given seed", () => {
    expect(resolveSentenceHint("reveal_tiles", baseArgs).revealedTiles).toEqual(
      resolveSentenceHint("reveal_tiles", baseArgs).revealedTiles
    );
  });
});
