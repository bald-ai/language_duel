/**
 * Coverage for `buildFrozenData`, the pure reconstruction of the reveal-phase
 * snapshot. The phase machine (`useDuelPhaseState`) decides *when* to freeze;
 * this asserts *what* the frozen card contains for a given previous position,
 * including the `wordOrder` indirection and the viewer-reveal gating.
 */

import { describe, expect, it } from "vitest";
import type { Doc } from "@/convex/_generated/dataModel";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { buildFrozenData } from "@/app/duel/[duelId]/hooks/duelViewModelHelpers";

function makeDuel(args: {
  wordOrder: number[];
  sessionWords: Array<Record<string, unknown>>;
  duelQuestions: Array<Record<string, unknown>>;
}): Doc<"duels"> {
  return {
    wordOrder: args.wordOrder,
    sessionWords: args.sessionWords,
    duelQuestions: args.duelQuestions,
  } as unknown as Doc<"duels">;
}

const cat = { kind: "word", word: "cat", answer: "gato", wrongAnswers: ["perro", "pez", "ave"] };
const dog = { kind: "word", word: "dog", answer: "perro", wrongAnswers: ["gato", "pez", "ave"] };

const revealedCatQuestion = {
  kind: "word",
  options: ["gato", "perro", "pez", "ave"],
  correctOption: "gato",
  answerRevealedToViewer: true,
  difficulty: "easy",
  points: 1,
};

describe("buildFrozenData", () => {
  it("builds the frozen snapshot for a revealed word position", () => {
    const duel = makeDuel({
      wordOrder: [0, 1],
      sessionWords: [cat, dog],
      duelQuestions: [revealedCatQuestion, revealedCatQuestion],
    });

    expect(
      buildFrozenData({ duel, prevIndex: 0, lockedAnswer: "gato", theirLastAnswer: "perro" })
    ).toEqual({
      word: "cat",
      correctAnswer: "gato",
      shuffledAnswers: ["gato", "perro", "pez", "ave"],
      selectedAnswer: "gato",
      opponentAnswer: "perro",
      wordIndex: 0,
      hasNoneOption: false,
      difficulty: { level: "easy", points: 1 },
    });
  });

  it("maps position to the session word through wordOrder, not directly", () => {
    // Position 0 resolves to sessionWords[1] via wordOrder.
    const duel = makeDuel({
      wordOrder: [1, 0],
      sessionWords: [cat, dog],
      duelQuestions: [revealedCatQuestion, revealedCatQuestion],
    });

    expect(buildFrozenData({ duel, prevIndex: 0, lockedAnswer: null, theirLastAnswer: null }).word).toBe(
      "dog"
    );
  });

  it("hides the correct answer until the viewer reveal flag is set", () => {
    const duel = makeDuel({
      wordOrder: [0],
      sessionWords: [cat],
      duelQuestions: [{ ...revealedCatQuestion, answerRevealedToViewer: false }],
    });

    expect(
      buildFrozenData({ duel, prevIndex: 0, lockedAnswer: null, theirLastAnswer: null }).correctAnswer
    ).toBeNull();
  });

  it("normalizes empty locked/opponent answers to null and flags none-of-above", () => {
    const duel = makeDuel({
      wordOrder: [0],
      sessionWords: [cat],
      duelQuestions: [{ ...revealedCatQuestion, correctOption: NONE_OF_ABOVE }],
    });

    const frozen = buildFrozenData({
      duel,
      prevIndex: 0,
      lockedAnswer: null,
      theirLastAnswer: undefined,
    });
    expect(frozen.selectedAnswer).toBeNull();
    expect(frozen.opponentAnswer).toBeNull();
    expect(frozen.hasNoneOption).toBe(true);
  });

  it("reports an unknown none-of-above state when the correct option is absent", () => {
    const duel = makeDuel({
      wordOrder: [0],
      sessionWords: [cat],
      duelQuestions: [{ kind: "word", options: ["a", "b", "c", "d"], difficulty: "hard", points: 3 }],
    });

    expect(
      buildFrozenData({ duel, prevIndex: 0, lockedAnswer: null, theirLastAnswer: null }).hasNoneOption
    ).toBeNull();
  });

  it("falls back to an empty word when the session item is missing", () => {
    const duel = makeDuel({
      wordOrder: [5], // points past the end of sessionWords
      sessionWords: [cat],
      duelQuestions: [revealedCatQuestion],
    });

    expect(
      buildFrozenData({ duel, prevIndex: 0, lockedAnswer: null, theirLastAnswer: null }).word
    ).toBe("");
  });

  it("throws when the previous position is a sentence question", () => {
    const duel = makeDuel({
      wordOrder: [0],
      sessionWords: [cat],
      duelQuestions: [{ kind: "sentence", englishPrompt: "Hi", spanishSentence: "Hola", tilePool: ["Hola"] }],
    });

    expect(() =>
      buildFrozenData({ duel, prevIndex: 0, lockedAnswer: null, theirLastAnswer: null })
    ).toThrow(/sentence question/i);
  });
});
