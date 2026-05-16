import { describe, expect, it } from "vitest";
import {
  answerSoloLevel0GotIt,
  answerSoloLevel0NotYet,
  answerSoloQuestionCorrect,
  answerSoloQuestionIncorrect,
  initializeSoloSession,
  selectNextSoloQuestion,
} from "@/lib/soloPracticeRuntime";

function fixedRandom(...values: number[]) {
  let index = 0;
  return () => values[index++ % values.length] ?? 0;
}

/**
 * Mulberry32 — small deterministic PRNG used to drive parity-style tests.
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

describe("soloPracticeRuntime", () => {
  it("initializes deterministically with an injected random source", () => {
    const session = initializeSoloSession({
      wordCount: 3,
      initialConfidenceByWordIndex: { 0: 2 },
      random: fixedRandom(0.9, 0.1, 0.2, 0.3, 0.4),
    });

    expect(session.initialized).toBe(true);
    expect(session.activePool).toHaveLength(1);
    expect(session.remainingPool).toHaveLength(2);
    expect(session.currentWordIndex).not.toBeNull();
    expect([2, 3]).toContain(session.questionLevel);
  });

  it("marks level 3 correct answers as mastered without React", () => {
    const session = initializeSoloSession({
      wordCount: 1,
      initialConfidenceByWordIndex: { 0: 3 },
      random: fixedRandom(0),
    });

    const answered = answerSoloQuestionCorrect(
      { ...session, questionLevel: 3, currentWordIndex: 0 },
      fixedRandom(0)
    );

    expect(answered.wordStates.get(0)?.completedLevel3).toBe(true);
    expect(answered.wordStates.get(0)?.answeredLevel2Plus).toBe(true);
    expect(answered.correctAnswers).toBe(1);
  });

  it("completes when the active pool has no unfinished words", () => {
    const session = initializeSoloSession({
      wordCount: 1,
      initialConfidenceByWordIndex: { 0: 3 },
      random: fixedRandom(0),
    });
    const answered = answerSoloQuestionCorrect(
      { ...session, questionLevel: 3, currentWordIndex: 0 },
      fixedRandom(0)
    );

    const next = selectNextSoloQuestion(answered, fixedRandom(0));

    expect(next.completed).toBe(true);
  });

  it("answerSoloQuestionIncorrect floors mastery at 0 and counts the question", () => {
    const session = initializeSoloSession({
      wordCount: 1,
      initialConfidenceByWordIndex: { 0: 0 },
      random: fixedRandom(0),
    });
    const result = answerSoloQuestionIncorrect({
      ...session,
      currentWordIndex: 0,
    });
    expect(result.wordStates.get(0)?.masteryLevel).toBe(0);
    expect(result.questionsAnswered).toBe(1);
    expect(result.correctAnswers).toBe(0);
  });

  it("level-0 GotIt promotes mastery to 1 and counts as correct", () => {
    const session = initializeSoloSession({
      wordCount: 1,
      initialConfidenceByWordIndex: { 0: 0 },
      random: fixedRandom(0),
    });
    const result = answerSoloLevel0GotIt({ ...session, currentWordIndex: 0 });
    expect(result.wordStates.get(0)?.masteryLevel).toBe(1);
    expect(result.correctAnswers).toBe(1);
  });

  it("level-0 NotYet keeps mastery at 0 and does not count as correct", () => {
    const session = initializeSoloSession({
      wordCount: 1,
      initialConfidenceByWordIndex: { 0: 1 },
      random: fixedRandom(0),
    });
    const result = answerSoloLevel0NotYet({ ...session, currentWordIndex: 0 });
    expect(result.wordStates.get(0)?.masteryLevel).toBe(0);
    expect(result.correctAnswers).toBe(0);
  });

  /**
   * Parity-style scenario: drive a realistic multi-question session with a
   * deterministic seeded RNG and assert the end-state. This locks in the
   * reducer's overall behavior so the React extraction cannot silently
   * regress without a test failure.
   */
  it("runs a deterministic multi-question session to completion (parity scenario)", () => {
    const random = seededRandom(42);
    let state = initializeSoloSession({
      wordCount: 4,
      initialConfidenceByWordIndex: { 0: 1, 1: 1, 2: 2, 3: 3 },
      random,
    });

    expect(state.initialized).toBe(true);
    expect(state.activePool.length).toBeGreaterThan(0);
    expect(state.currentWordIndex).not.toBeNull();

    // Drive the session: always answer correctly. With seeded RNG and an
    // initial confidence map, every word eventually reaches completedLevel3
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
    const masteredCount = Array.from(state.wordStates.values()).filter(
      (ws) => ws.completedLevel3
    ).length;
    expect(masteredCount).toBe(4);
  });

  it("falls back to the only candidate when avoiding lastQuestionIndex would empty the pool", () => {
    const random = seededRandom(7);
    const initial = initializeSoloSession({
      wordCount: 2,
      initialConfidenceByWordIndex: { 0: 3, 1: 3 },
      random,
    });

    // Mark word 0 as fully mastered, leaving word 1 as the only incomplete word
    // even though lastQuestionIndex is also 1. The reducer must still pick word 1.
    const wordStates = new Map(initial.wordStates);
    wordStates.set(0, {
      ...wordStates.get(0)!,
      completedLevel3: true,
      answeredLevel2Plus: true,
    });

    const next = selectNextSoloQuestion(
      {
        ...initial,
        wordStates,
        lastQuestionIndex: 1,
      },
      random
    );

    expect(next.completed).toBe(false);
    expect(next.currentWordIndex).toBe(1);
  });
});
