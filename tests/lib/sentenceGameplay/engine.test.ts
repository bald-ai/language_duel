import { describe, expect, it } from "vitest";
import {
  buildAssembledSentence,
  buildSentenceQuestionSnapshot,
  createInitialSentenceRoundState,
  isSubmittedSentenceCorrect,
  tapSentenceTile,
} from "@/lib/sentenceGameplay/engine";

describe("buildSentenceQuestionSnapshot", () => {
  it("produces a tile pool containing every correct word and every distractor", () => {
    const snapshot = buildSentenceQuestionSnapshot({
      englishPrompt: "I want coffee",
      spanishSentence: "Quiero cafe.",
      distractors: ["Tengo", "agua", "pan"],
      questionIndex: 0,
    });
    expect(snapshot.kind).toBe("sentence");
    expect(snapshot.englishPrompt).toBe("I want coffee");
    expect(snapshot.spanishSentence).toBe("Quiero cafe.");
    // 2 correct + 3 distractors = 5 tiles, identical-text tiles allowed
    expect(snapshot.tilePool).toHaveLength(5);
    expect(snapshot.tilePool).toEqual(expect.arrayContaining(["Quiero", "cafe.", "Tengo", "agua", "pan"]));
  });

  it("is deterministic for the same sentence + questionIndex seed", () => {
    const a = buildSentenceQuestionSnapshot({
      englishPrompt: "x",
      spanishSentence: "uno dos tres",
      distractors: ["a", "b", "c"],
      questionIndex: 3,
    });
    const b = buildSentenceQuestionSnapshot({
      englishPrompt: "x",
      spanishSentence: "uno dos tres",
      distractors: ["a", "b", "c"],
      questionIndex: 3,
    });
    expect(b.tilePool).toEqual(a.tilePool);
  });
});

describe("tapSentenceTile", () => {
  const snapshot = buildSentenceQuestionSnapshot({
    englishPrompt: "I want coffee",
    spanishSentence: "Quiero cafe.",
    distractors: ["Tengo", "agua", "pan"],
    questionIndex: 0,
  });
  const findTile = (text: string) => snapshot.tilePool.findIndex((token) => token === text);

  it("accepts a correct first tile and advances the placed sequence", () => {
    const initial = createInitialSentenceRoundState();
    const tap = tapSentenceTile(initial, snapshot, findTile("Quiero"));
    expect(tap.accepted).toBe(true);
    expect(tap.state.placedTileIndices).toEqual([findTile("Quiero")]);
    expect(tap.state.mistakes).toBe(0);
    expect(tap.state.completed).toBe(false);
  });

  it("rejects a wrong tile and increments mistakes without placing it", () => {
    const initial = createInitialSentenceRoundState();
    const tap = tapSentenceTile(initial, snapshot, findTile("Tengo"));
    expect(tap.accepted).toBe(false);
    expect(tap.state.placedTileIndices).toEqual([]);
    expect(tap.state.mistakes).toBe(1);
  });

  it("ignores re-tapping an already placed tile (no-op, no mistake count)", () => {
    const state = createInitialSentenceRoundState();
    const first = tapSentenceTile(state, snapshot, findTile("Quiero"));
    expect(first.accepted).toBe(true);
    const second = tapSentenceTile(first.state, snapshot, findTile("Quiero"));
    expect(second.accepted).toBe(false);
    expect(second.state.placedTileIndices).toEqual(first.state.placedTileIndices);
    expect(second.state.mistakes).toBe(0);
  });

  it("completes when every correct tile is placed in order", () => {
    let state = createInitialSentenceRoundState();
    state = tapSentenceTile(state, snapshot, findTile("Quiero")).state;
    state = tapSentenceTile(state, snapshot, findTile("cafe.")).state;
    expect(state.completed).toBe(true);
    expect(buildAssembledSentence(snapshot, state.placedTileIndices)).toBe("Quiero cafe.");
  });

  it("ignores taps once the round is completed", () => {
    let state = createInitialSentenceRoundState();
    state = tapSentenceTile(state, snapshot, findTile("Quiero")).state;
    state = tapSentenceTile(state, snapshot, findTile("cafe.")).state;
    const after = tapSentenceTile(state, snapshot, findTile("agua"));
    expect(after.accepted).toBe(false);
    expect(after.state).toBe(state);
  });
});

describe("repeated correct words (tile-text equivalence)", () => {
  const snapshot = buildSentenceQuestionSnapshot({
    englishPrompt: "Yes yes",
    spanishSentence: "si si si",
    distractors: ["no", "tal", "vez"],
  questionIndex: 0,
  });
  const allSiIndices = snapshot.tilePool
    .map((token, index) => (token === "si" ? index : -1))
    .filter((index) => index !== -1);

  it("accepts any si tile for the first si slot", () => {
    expect(allSiIndices.length).toBeGreaterThan(0);
    const initial = createInitialSentenceRoundState();
    const tap = tapSentenceTile(initial, snapshot, allSiIndices[0]);
    expect(tap.accepted).toBe(true);
  });

  it("accepts a DIFFERENT si tile for each subsequent si slot", () => {
    if (allSiIndices.length < 3) return; // sentence built only one "si" tile (shouldn't happen)
    let state = createInitialSentenceRoundState();
    state = tapSentenceTile(state, snapshot, allSiIndices[0]).state;
    state = tapSentenceTile(state, snapshot, allSiIndices[1]).state;
    state = tapSentenceTile(state, snapshot, allSiIndices[2]).state;
    expect(state.completed).toBe(true);
  });
});

describe("isSubmittedSentenceCorrect", () => {
  const snapshot = buildSentenceQuestionSnapshot({
    englishPrompt: "I want coffee",
    spanishSentence: "Quiero cafe.",
    distractors: ["Tengo", "agua", "pan"],
    questionIndex: 0,
  });
  const findTile = (text: string) => snapshot.tilePool.findIndex((token) => token === text);

  it("returns true for a sequence that assembles the canonical sentence", () => {
    expect(
      isSubmittedSentenceCorrect(snapshot, [findTile("Quiero"), findTile("cafe.")])
    ).toBe(true);
  });

  it("returns false for a wrong-length sequence", () => {
    expect(isSubmittedSentenceCorrect(snapshot, [findTile("Quiero")])).toBe(false);
  });

  it("returns false for a sequence with a misordered tile", () => {
    expect(
      isSubmittedSentenceCorrect(snapshot, [findTile("cafe."), findTile("Quiero")])
    ).toBe(false);
  });

  it("accepts case/accent differences in the placed tile text (normalization)", () => {
    const snap = buildSentenceQuestionSnapshot({
      englishPrompt: "Where?",
      spanishSentence: "Dónde está",
      distractors: ["a", "b", "c"],
      questionIndex: 0,
    });
    const idxDonde = snap.tilePool.findIndex((token) => token.toLowerCase() === "dónde");
    const idxEsta = snap.tilePool.findIndex((token) => token.toLowerCase() === "está");
    expect(isSubmittedSentenceCorrect(snap, [idxDonde, idxEsta])).toBe(true);
  });
});
