import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEVEL_1_START_PROBABILITY,
  LEVEL_2_TYPING_PROBABILITY,
  L1_TO_L2_PROBABILITY,
  LCG_INCREMENT,
  LCG_MODULUS,
  LCG_MULTIPLIER,
} from "@/convex/constants";
import {
  advanceSeed,
  calculateNextLevelOnCorrectSeeded,
  createInitialWordStates,
  createShuffledWordOrder,
  determineInitialLevelSeeded,
  determineLevel2ModeSeeded,
  expandPoolSeeded,
  initializeWordPoolsSeeded,
  pickNextQuestionSeeded,
  shouldExpandPool,
  shuffleArray,
  shuffleArraySeeded,
  updatePlayerStats,
  updateWordStateAfterAnswerSeeded,
  type WordState,
} from "@/convex/helpers/gameLogic";

function expectPermutation(result: number[], expectedItems: number[]) {
  expect([...result].sort((a, b) => a - b)).toEqual([...expectedItems].sort((a, b) => a - b));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("game logic helpers", () => {
  it("advanceSeed follows the shared LCG formula", () => {
    const seed = 12345;
    expect(advanceSeed(seed)).toBe((seed * LCG_MULTIPLIER + LCG_INCREMENT) & LCG_MODULUS);
  });

  it("shuffleArray is deterministic when Math.random is controlled and does not mutate input", () => {
    const values = [1, 2, 3, 4];
    vi.spyOn(Math, "random")
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.8)
      .mockReturnValueOnce(0.3);

    const result = shuffleArray(values);

    expect(result).toEqual([2, 4, 3, 1]);
    expect(values).toEqual([1, 2, 3, 4]);
  });

  it("shuffleArraySeeded returns the same output and new seed for the same seed", () => {
    const first = shuffleArraySeeded(["a", "b", "c", "d"], 77);
    const second = shuffleArraySeeded(["a", "b", "c", "d"], 77);

    expect(first).toEqual(second);
    expectPermutation(first.result.map((value) => value.charCodeAt(0)), [97, 98, 99, 100]);
  });

  it("createShuffledWordOrder returns a valid word index permutation", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    expect(createShuffledWordOrder(5)).toEqual([1, 2, 3, 4, 0]);
  });

  it("initializeWordPoolsSeeded is deterministic and splits active from remaining pool", () => {
    const first = initializeWordPoolsSeeded(10, 99);
    const second = initializeWordPoolsSeeded(10, 99);

    expect(first).toEqual(second);
    expect(first.activePool).toHaveLength(4);
    expect(first.remainingPool).toHaveLength(6);
    expectPermutation([...first.activePool, ...first.remainingPool], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("initializeWordPoolsSeeded keeps at least one active word", () => {
    expect(initializeWordPoolsSeeded(1, 42).activePool).toHaveLength(1);
  });

  it("createInitialWordStates initializes every word at level 1", () => {
    expect(createInitialWordStates(3)).toEqual([
      { wordIndex: 0, currentLevel: 1, completedLevel3: false, answeredLevel2Plus: false },
      { wordIndex: 1, currentLevel: 1, completedLevel3: false, answeredLevel2Plus: false },
      { wordIndex: 2, currentLevel: 1, completedLevel3: false, answeredLevel2Plus: false },
    ]);
  });

  it("determineInitialLevelSeeded is deterministic and follows the configured distribution", () => {
    const runs = Array.from({ length: 10_000 }, (_, index) =>
      determineInitialLevelSeeded(index + 1)
    );
    const repeated = Array.from({ length: 10_000 }, (_, index) =>
      determineInitialLevelSeeded(index + 1)
    );
    const level1Ratio = runs.filter((run) => run.level === 1).length / runs.length;

    expect(runs).toEqual(repeated);
    expect(Math.abs(level1Ratio - LEVEL_1_START_PROBABILITY)).toBeLessThanOrEqual(0.02);
  });

  it("determineLevel2ModeSeeded is deterministic and follows the configured distribution", () => {
    const runs = Array.from({ length: 10_000 }, (_, index) =>
      determineLevel2ModeSeeded(index + 1)
    );
    const typingRatio = runs.filter((run) => run.mode === "typing").length / runs.length;

    expect(determineLevel2ModeSeeded(123)).toEqual(determineLevel2ModeSeeded(123));
    expect(Math.abs(typingRatio - LEVEL_2_TYPING_PROBABILITY)).toBeLessThanOrEqual(0.02);
  });

  it("calculateNextLevelOnCorrectSeeded is deterministic and follows the level-1 promotion distribution", () => {
    const runs = Array.from({ length: 10_000 }, (_, index) =>
      calculateNextLevelOnCorrectSeeded(1, index + 1)
    );
    const level2Ratio = runs.filter((run) => run.level === 2).length / runs.length;

    expect(calculateNextLevelOnCorrectSeeded(1, 456)).toEqual(calculateNextLevelOnCorrectSeeded(1, 456));
    expect(Math.abs(level2Ratio - L1_TO_L2_PROBABILITY)).toBeLessThanOrEqual(0.02);
    expect(calculateNextLevelOnCorrectSeeded(2, 456)).toEqual({ level: 3, newSeed: 456 });
  });

  it("shouldExpandPool responds to completion threshold and remaining words", () => {
    const wordStates: WordState[] = [
      { wordIndex: 0, currentLevel: 2, completedLevel3: false, answeredLevel2Plus: true },
      { wordIndex: 1, currentLevel: 1, completedLevel3: false, answeredLevel2Plus: false },
      { wordIndex: 2, currentLevel: 2, completedLevel3: false, answeredLevel2Plus: true },
    ];

    expect(shouldExpandPool([0, 1, 2], wordStates, [3])).toBe(true);
    expect(shouldExpandPool([0, 1, 2], wordStates, [])).toBe(false);
  });

  it("expandPoolSeeded is deterministic and moves words from remaining to active", () => {
    const first = expandPoolSeeded([0, 1], [2, 3, 4], 88);
    const second = expandPoolSeeded([0, 1], [2, 3, 4], 88);

    expect(first).toEqual(second);
    expect(first.newActivePool).toHaveLength(4);
    expect(first.newRemainingPool).toHaveLength(1);
    expectPermutation([...first.newActivePool, ...first.newRemainingPool], [0, 1, 2, 3, 4]);
  });

  it("updateWordStateAfterAnswerSeeded advances, completes, and demotes levels correctly", () => {
    const base: WordState = {
      wordIndex: 0,
      currentLevel: 2,
      completedLevel3: false,
      answeredLevel2Plus: false,
    };

    expect(updateWordStateAfterAnswerSeeded(base, 2, true, 7).wordState).toMatchObject({
      currentLevel: 3,
      answeredLevel2Plus: true,
      completedLevel3: false,
    });
    expect(updateWordStateAfterAnswerSeeded({ ...base, currentLevel: 3 }, 3, true, 7).wordState).toMatchObject({
      currentLevel: 3,
      answeredLevel2Plus: true,
      completedLevel3: true,
    });
    expect(updateWordStateAfterAnswerSeeded({ ...base, currentLevel: 3 }, 3, false, 7).wordState.currentLevel).toBe(2);
  });

  it("pickNextQuestionSeeded is deterministic and reports completion when all active words are done", () => {
    const wordStates = [
      { wordIndex: 0, currentLevel: 1, completedLevel3: false, answeredLevel2Plus: false },
      { wordIndex: 1, currentLevel: 3, completedLevel3: false, answeredLevel2Plus: true },
    ];

    expect(pickNextQuestionSeeded([0, 1], wordStates, 0, 101)).toEqual(
      pickNextQuestionSeeded([0, 1], wordStates, 0, 101)
    );

    expect(
      pickNextQuestionSeeded(
        [0],
        [{ wordIndex: 0, currentLevel: 3, completedLevel3: true, answeredLevel2Plus: true }],
        0,
        101
      )
    ).toEqual({
      result: { wordIndex: 0, level: 3, level2Mode: "typing", isComplete: true },
      newSeed: 101,
    });
  });

  it("updatePlayerStats increments totals and correct counts", () => {
    expect(updatePlayerStats({ questionsAnswered: 2, correctAnswers: 1 }, true)).toEqual({
      questionsAnswered: 3,
      correctAnswers: 2,
    });
    expect(updatePlayerStats({ questionsAnswered: 2, correctAnswers: 1 }, false)).toEqual({
      questionsAnswered: 3,
      correctAnswers: 1,
    });
  });
});
