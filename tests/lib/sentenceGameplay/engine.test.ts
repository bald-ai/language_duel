import { describe, expect, it } from "vitest";
import {
  buildSentenceQuestionSnapshot,
  isSubmittedSentenceCorrect,
} from "@/lib/sentenceGameplay/engine";
import {
  SENTENCE_DISTRACTOR_COUNT_BY_LEVEL,
  SENTENCE_WORD_MEANING_PLACEHOLDER,
} from "@/lib/themes/sentenceConstants";

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
    expect(snapshot.tileMeanings).toHaveLength(5);
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

  it("attaches free-word meanings to the matching shuffled correct tiles only", () => {
    const snapshot = buildSentenceQuestionSnapshot({
      englishPrompt: "I want coffee",
      spanishSentence: "Quiero cafe.",
      wordMeanings: ["I want", "coffee"],
      freeWordPositions: [1],
      distractors: ["Tengo", "agua", "pan"],
      questionIndex: 0,
    });

    const cafeIndex = snapshot.tilePool.findIndex((tile) => tile === "cafe.");
    const quieroIndex = snapshot.tilePool.findIndex((tile) => tile === "Quiero");
    const distractorIndex = snapshot.tilePool.findIndex((tile) => tile === "Tengo");

    expect(snapshot.tileMeanings[cafeIndex]).toBe("coffee");
    expect(snapshot.tileMeanings[quieroIndex]).toBeNull();
    expect(snapshot.tileMeanings[distractorIndex]).toBeNull();
  });

  it("does not expose placeholder free-word meanings as tile hints", () => {
    const snapshot = buildSentenceQuestionSnapshot({
      englishPrompt: "I want coffee",
      spanishSentence: "Quiero cafe.",
      wordMeanings: ["I want", SENTENCE_WORD_MEANING_PLACEHOLDER],
      freeWordPositions: [1],
      distractors: ["Tengo", "agua", "pan"],
      questionIndex: 0,
    });

    const cafeIndex = snapshot.tilePool.findIndex((tile) => tile === "cafe.");

    expect(snapshot.tileMeanings[cafeIndex]).toBeNull();
  });
});

describe("buildSentenceQuestionSnapshot distractorCount (sentence difficulty)", () => {
  // 2 correct tokens ("Quiero", "cafe.") + 3 stored decoys.
  const baseArgs = {
    englishPrompt: "I want coffee",
    spanishSentence: "Quiero cafe.",
    distractors: ["Tengo", "agua", "pan"],
    questionIndex: 0,
  };
  const correctTokenCount = 2;
  const countDistractors = (tilePool: string[]) =>
    tilePool.filter((tile) => baseArgs.distractors.includes(tile)).length;

  it("shows every stored decoy when distractorCount is omitted", () => {
    const snapshot = buildSentenceQuestionSnapshot(baseArgs);
    expect(snapshot.tilePool).toHaveLength(correctTokenCount + baseArgs.distractors.length);
    expect(countDistractors(snapshot.tilePool)).toBe(baseArgs.distractors.length);
  });

  it.each([
    ["easy", SENTENCE_DISTRACTOR_COUNT_BY_LEVEL.easy],
    ["medium", SENTENCE_DISTRACTOR_COUNT_BY_LEVEL.medium],
    ["hard", SENTENCE_DISTRACTOR_COUNT_BY_LEVEL.hard],
  ] as const)("shows %s → %i decoy(s): tokens + N tiles", (_level, distractorCount) => {
    const snapshot = buildSentenceQuestionSnapshot({ ...baseArgs, distractorCount });
    expect(snapshot.tilePool).toHaveLength(correctTokenCount + distractorCount);
    expect(countDistractors(snapshot.tilePool)).toBe(distractorCount);
    // Every shown decoy comes from the stored set — no correct token leaks in.
    const shown = snapshot.tilePool.filter((tile) => baseArgs.distractors.includes(tile));
    expect(new Set(shown).size).toBe(shown.length);
  });

  it("always keeps every correct token regardless of how few decoys show", () => {
    const snapshot = buildSentenceQuestionSnapshot({ ...baseArgs, distractorCount: 1 });
    expect(snapshot.tilePool).toEqual(expect.arrayContaining(["Quiero", "cafe."]));
  });

  it("clamps distractorCount above the stored count to what exists", () => {
    const snapshot = buildSentenceQuestionSnapshot({ ...baseArgs, distractorCount: 99 });
    expect(snapshot.tilePool).toHaveLength(correctTokenCount + baseArgs.distractors.length);
  });

  it("is deterministic for the same seed + distractorCount", () => {
    const a = buildSentenceQuestionSnapshot({ ...baseArgs, distractorCount: 2 });
    const b = buildSentenceQuestionSnapshot({ ...baseArgs, distractorCount: 2 });
    expect(b.tilePool).toEqual(a.tilePool);
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
