import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  buildSentenceAnswerPatch,
  scoreSentenceSubmission,
  validateSentenceSubmission,
} from "@/convex/rules/sentenceGameplayRules";
import {
  SENTENCE_CLEAN_COMPLETION_POINTS,
  SENTENCE_MESSY_COMPLETION_POINTS,
  SENTENCE_TIMEOUT_POINTS,
} from "@/lib/themes/sentenceConstants";

function baseDuel(overrides: Partial<Doc<"duels">> = {}): Doc<"duels"> {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: Date.now(),
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: [],
    sessionWords: [],
    sourceType: "normal",
    status: "active",
    createdAt: Date.now(),
    currentWordIndex: 0,
    wordOrder: [0],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    duelMode: "pvp",
    hintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 1,
    ...overrides,
  };
}

describe("scoreSentenceSubmission", () => {
  it("clean completion = perfect points", () => {
    expect(
      scoreSentenceSubmission({ completed: true, mistakes: 0 })
    ).toBe(SENTENCE_CLEAN_COMPLETION_POINTS);
  });

  it("messy completion = messy tier", () => {
    expect(
      scoreSentenceSubmission({ completed: true, mistakes: 3 })
    ).toBe(SENTENCE_MESSY_COMPLETION_POINTS);
  });

  it("timeout / abandon = 0 points", () => {
    expect(
      scoreSentenceSubmission({ completed: false, mistakes: 0 })
    ).toBe(SENTENCE_TIMEOUT_POINTS);
    expect(
      scoreSentenceSubmission({ completed: false, mistakes: 5 })
    ).toBe(SENTENCE_TIMEOUT_POINTS);
  });
});

describe("buildSentenceAnswerPatch", () => {
  it("awards clean points to the challenger and flags them answered", () => {
    const duel = baseDuel();
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      submission: { completed: true, mistakes: 0 },
    });
    expect(patch.challengerAnswered).toBe(true);
    expect(patch.challengerScore).toBe(SENTENCE_CLEAN_COMPLETION_POINTS);
    expect(patch.challengerLastAnswer).toBe("sentence:0");
  });

  it("awards messy points and records mistake count on the answer marker", () => {
    const duel = baseDuel({ opponentScore: 5 });
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "opponent",
      isChallenger: false,
      submission: { completed: true, mistakes: 2 },
    });
    expect(patch.opponentAnswered).toBe(true);
    expect(patch.opponentScore).toBe(5 + SENTENCE_MESSY_COMPLETION_POINTS);
    expect(patch.opponentLastAnswer).toBe("sentence:2");
  });

  it("scores 0 on timeout and marks the player answered", () => {
    const duel = baseDuel();
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "opponent",
      isChallenger: false,
      submission: { completed: false, mistakes: 1 },
    });
    expect(patch.opponentAnswered).toBe(true);
    expect(patch.opponentScore).toBe(0);
    expect(patch.opponentLastAnswer).toBe("__TIMEOUT__");
  });

  it("is a no-op once the player has already answered", () => {
    const duel = baseDuel({ challengerAnswered: true, challengerScore: 7 });
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      submission: { completed: true, mistakes: 0 },
    });
    expect(patch).toEqual({});
  });

  it("deducts lives equal to mistakes on a boss attempt", () => {
    const duel = baseDuel({
      sourceType: "boss",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      livesRemaining: 5,
      livesTotal: 5,
      challengerPerfectRun: true,
      opponentPerfectRun: true,
    });
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      submission: { completed: true, mistakes: 2 },
    });
    expect(patch.livesRemaining).toBe(3);
    expect(patch.challengerPerfectRun).toBe(false);
  });

  it("counts an extra HP lost on timeout (couldn't finish at all)", () => {
    const duel = baseDuel({
      sourceType: "boss",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      livesRemaining: 5,
      challengerPerfectRun: true,
      opponentPerfectRun: true,
    });
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      submission: { completed: false, mistakes: 1 },
    });
    expect(patch.livesRemaining).toBe(3); // 1 mistake + 1 timeout
  });
});

describe("validateSentenceSubmission", () => {
  it("accepts a normal submission", () => {
    expect(() =>
      validateSentenceSubmission({ completed: true, mistakes: 2 })
    ).not.toThrow();
  });

  it("rejects negative mistake counts", () => {
    expect(() =>
      validateSentenceSubmission({ completed: true, mistakes: -1 })
    ).toThrow(/non-negative/i);
  });

  it("rejects non-integer mistakes", () => {
    expect(() =>
      validateSentenceSubmission({ completed: true, mistakes: 1.5 })
    ).toThrow(/non-negative/i);
  });
});
