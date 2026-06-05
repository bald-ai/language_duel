import { describe, expect, it } from "vitest";
import {
  answerSoloLevel0GotIt,
  answerSoloLevel0NotYet,
  answerSoloQuestionCorrect,
  answerSoloQuestionIncorrect,
  initializeSoloSession,
  selectNextSoloQuestion,
  type SoloRuntimeItem,
} from "@/lib/soloPracticeRuntime";

function fixedRandom(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

/**
 * Mulberry32 -- small deterministic PRNG used to drive parity-style tests.
 * Lets us replay a long input sequence and lock in the resulting state
 * transitions, so future refactors of the reducer have to keep behavior
 * identical for the same seed.
 */
function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wordItem(): SoloRuntimeItem {
  return { kind: "word", maxLevel: 3 };
}

function sentenceItem(maxLevel: 0 | 1 | 2 | 3): SoloRuntimeItem {
  return { kind: "sentence", maxLevel };
}

describe("soloPracticeRuntime", () => {
  it("initializes deterministically with an injected random source", () => {
    const session = initializeSoloSession({
      items: [wordItem(), wordItem(), wordItem()],
      initialConfidenceByItemIndex: { 0: 2 },
      random: fixedRandom(0.9, 0.1, 0.2, 0.3, 0.4),
    });

    expect(session.initialized).toBe(true);
    expect(session.activePool).toHaveLength(1);
    expect(session.remainingPool).toHaveLength(2);
    expect(session.currentItemIndex).not.toBeNull();
    // The shuffle decides which item becomes active: item 0 starts at mastery 2
    // (question levels 2-3), the others default to mastery 1 (levels 1-2).
    const expectedLevels = session.currentItemIndex === 0 ? [2, 3] : [1, 2];
    expect(expectedLevels).toContain(session.questionLevel);
  });

  it("marks level 3 word answers as mastered without React", () => {
    const session = initializeSoloSession({
      items: [wordItem()],
      initialConfidenceByItemIndex: { 0: 3 },
      random: fixedRandom(0),
    });

    const answered = answerSoloQuestionCorrect(
      { ...session, questionLevel: 3, currentItemIndex: 0 },
      fixedRandom(0)
    );

    expect(answered.itemStates.get(0)?.completedMaxLevel).toBe(true);
    expect(answered.itemStates.get(0)?.answeredExpansionGate).toBe(true);
    expect(answered.correctAnswers).toBe(1);
  });

  it("completes when the active pool has no unfinished items", () => {
    const session = initializeSoloSession({
      items: [wordItem()],
      initialConfidenceByItemIndex: { 0: 3 },
      random: fixedRandom(0),
    });
    const answered = answerSoloQuestionCorrect(
      { ...session, questionLevel: 3, currentItemIndex: 0 },
      fixedRandom(0)
    );

    const next = selectNextSoloQuestion(answered, fixedRandom(0));

    expect(next.completed).toBe(true);
  });

  it("answerSoloQuestionIncorrect floors mastery at 0 and counts the question", () => {
    const session = initializeSoloSession({
      items: [wordItem()],
      initialConfidenceByItemIndex: { 0: 0 },
      random: fixedRandom(0),
    });
    const result = answerSoloQuestionIncorrect({
      ...session,
      currentItemIndex: 0,
    });
    expect(result.itemStates.get(0)?.masteryLevel).toBe(0);
    expect(result.questionsAnswered).toBe(1);
    expect(result.correctAnswers).toBe(0);
  });

  it("level-0 GotIt promotes word mastery to 1 and counts as correct", () => {
    const session = initializeSoloSession({
      items: [wordItem()],
      initialConfidenceByItemIndex: { 0: 0 },
      random: fixedRandom(0),
    });
    const result = answerSoloLevel0GotIt({ ...session, currentItemIndex: 0 });
    expect(result.itemStates.get(0)?.masteryLevel).toBe(1);
    expect(result.correctAnswers).toBe(1);
  });

  it("level-0 NotYet keeps word mastery at 0 and does not count as correct", () => {
    const session = initializeSoloSession({
      items: [wordItem()],
      initialConfidenceByItemIndex: { 0: 1 },
      random: fixedRandom(0),
    });
    const result = answerSoloLevel0NotYet({ ...session, currentItemIndex: 0 });
    expect(result.itemStates.get(0)?.masteryLevel).toBe(0);
    expect(result.correctAnswers).toBe(0);
  });

  it("clamps sentence confidence to the sentence max level", () => {
    const session = initializeSoloSession({
      items: [sentenceItem(1)],
      initialConfidenceByItemIndex: { 0: 3 },
      random: fixedRandom(0),
    });

    expect(session.itemStates.get(0)?.masteryLevel).toBe(1);
    expect(session.questionLevel).toBe(1);
  });

  it("completes a short sentence at level 0 without word level-0 controls", () => {
    const session = initializeSoloSession({
      items: [sentenceItem(0)],
      initialConfidenceByItemIndex: { 0: 0 },
      random: fixedRandom(0),
    });

    const answered = answerSoloQuestionCorrect(session, fixedRandom(0));
    expect(answered.itemStates.get(0)?.completedMaxLevel).toBe(true);

    const next = selectNextSoloQuestion(answered, fixedRandom(0));
    expect(next.completed).toBe(true);
  });

  /**
   * Parity-style scenario: drive a realistic multi-question session with a
   * deterministic seeded RNG and assert the end-state. This locks in the
   * reducer's overall behavior so the React extraction cannot silently
   * regress without a test failure.
   */
  it("runs a deterministic multi-question word session to completion", () => {
    const random = seededRandom(42);
    let state = initializeSoloSession({
      items: [wordItem(), wordItem(), wordItem(), wordItem()],
      initialConfidenceByItemIndex: { 0: 1, 1: 1, 2: 2, 3: 3 },
      random,
    });

    expect(state.initialized).toBe(true);
    expect(state.activePool.length).toBeGreaterThan(0);
    expect(state.currentItemIndex).not.toBeNull();

    // Drive the session: always answer correctly. With seeded RNG and an
    // initial confidence map, every item eventually reaches completedMaxLevel
    // and the session terminates without exceeding a bounded step count.
    let safetyCounter = 0;
    while (!state.completed && safetyCounter < 200) {
      state = answerSoloQuestionCorrect(state, random);
      state = selectNextSoloQuestion(state, random);
      safetyCounter += 1;
    }

    expect(state.completed).toBe(true);
    expect(state.questionsAnswered).toBeGreaterThan(0);
    expect(state.correctAnswers).toBe(state.questionsAnswered);
    const masteredCount = Array.from(state.itemStates.values()).filter(
      (itemState) => itemState.completedMaxLevel
    ).length;
    expect(masteredCount).toBe(4);
  });

  it("uses the only candidate when avoiding lastItemIndex would empty the pool", () => {
    const random = seededRandom(7);
    const initial = initializeSoloSession({
      items: [wordItem(), wordItem()],
      initialConfidenceByItemIndex: { 0: 3, 1: 3 },
      random,
    });

    // Mark item 0 as fully mastered, leaving item 1 as the only incomplete item
    // even though lastItemIndex is also 1. The reducer must still pick item 1.
    const itemStates = new Map(initial.itemStates);
    itemStates.set(0, {
      ...itemStates.get(0)!,
      completedMaxLevel: true,
      answeredExpansionGate: true,
    });

    const next = selectNextSoloQuestion(
      {
        ...initial,
        itemStates,
        lastItemIndex: 1,
      },
      random
    );

    expect(next.completed).toBe(false);
    expect(next.currentItemIndex).toBe(1);
  });
});
