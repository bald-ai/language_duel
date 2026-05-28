import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  applySentenceTap,
  buildSentenceAnswerPatch,
  scoreSentenceSubmission,
  validateTimedOutFlag,
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

/**
 * A two-token sentence ("Quiero cafe") with one distractor. Tile pool indices
 * for the correct sequence are [0, 1]; index 2 is a distractor that should be
 * counted as a mistake.
 */
function sentenceDuel(progress?: Partial<Doc<"duels">>["sentenceProgress"]): Doc<"duels"> {
  return baseDuel({
    duelQuestions: [
      {
        kind: "sentence",
        englishPrompt: "I want coffee",
        spanishSentence: "Quiero cafe",
        tilePool: ["Quiero", "cafe", "leche"],
      },
    ],
    sentenceProgress: progress,
  });
}

describe("scoreSentenceSubmission", () => {
  it("clean completion = perfect points", () => {
    expect(scoreSentenceSubmission({ completed: true, mistakes: 0 })).toBe(
      SENTENCE_CLEAN_COMPLETION_POINTS
    );
  });

  it("messy completion = messy tier", () => {
    expect(scoreSentenceSubmission({ completed: true, mistakes: 3 })).toBe(
      SENTENCE_MESSY_COMPLETION_POINTS
    );
  });

  it("timeout / abandon = 0 points", () => {
    expect(scoreSentenceSubmission({ completed: false, mistakes: 0 })).toBe(
      SENTENCE_TIMEOUT_POINTS
    );
    expect(scoreSentenceSubmission({ completed: false, mistakes: 5 })).toBe(
      SENTENCE_TIMEOUT_POINTS
    );
  });
});

describe("applySentenceTap (Task 21 server validation)", () => {
  it("accepts the first correct tile and records it in sentenceProgress", () => {
    const duel = sentenceDuel();
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 0,
    });
    expect(accepted).toBe(true);
    expect(patch.sentenceProgress).toEqual([
      expect.objectContaining({
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0],
        mistakes: 0,
        completed: false,
      }),
    ]);
  });

  it("flags the round complete when the last correct tile is placed", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0],
        mistakes: 0,
        completed: false,
        finalized: false,
      },
    ]);
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 1,
    });
    expect(accepted).toBe(true);
    expect(patch.sentenceProgress?.[0]).toEqual(
      expect.objectContaining({ completed: true, placedTileIndices: [0, 1] })
    );
  });

  it("increments mistakes for a wrong tap (distractor) and keeps placed unchanged", () => {
    const duel = sentenceDuel();
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 2, // distractor "leche"
    });
    expect(accepted).toBe(false);
    expect(patch.sentenceProgress?.[0]).toEqual(
      expect.objectContaining({ mistakes: 1, placedTileIndices: [] })
    );
  });

  it("rejects out-of-range tile indices with no state change", () => {
    const duel = sentenceDuel();
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 99,
    });
    expect(accepted).toBe(false);
    expect(patch).toEqual({});
  });

  it("rejects re-taps on an already-placed tile", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0],
        mistakes: 0,
        completed: false,
        finalized: false,
      },
    ]);
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 0,
    });
    expect(accepted).toBe(false);
    expect(patch).toEqual({});
  });

  it("ignores taps after the round is finalized", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0, 1],
        mistakes: 0,
        completed: true,
        finalized: true,
      },
    ]);
    const { patch, accepted } = applySentenceTap({
      duel,
      questionIndex: 0,
      role: "challenger",
      tileIndex: 2,
    });
    expect(accepted).toBe(false);
    expect(patch).toEqual({});
  });

  it("rejects taps on a word position", () => {
    const duel = baseDuel({
      duelQuestions: [
        { kind: "word", options: ["a", "b", "c", "d"], correctOption: "a", difficulty: "easy", points: 1 },
      ],
    });
    expect(() =>
      applySentenceTap({ duel, questionIndex: 0, role: "challenger", tileIndex: 0 })
    ).toThrow(/sentence positions/i);
  });
});

describe("buildSentenceAnswerPatch (reads server state)", () => {
  it("awards clean points when server-tracked progress shows completed + 0 mistakes", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0, 1],
        mistakes: 0,
        completed: true,
        finalized: false,
      },
    ]);
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: false,
      questionIndex: 0,
    });
    expect(patch.challengerAnswered).toBe(true);
    expect(patch.challengerScore).toBe(SENTENCE_CLEAN_COMPLETION_POINTS);
    expect(patch.challengerLastAnswer).toBe("sentence:0");
  });

  it("uses the server-tracked mistakes count, ignoring client-side claims", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "opponent",
        placedTileIndices: [0, 1],
        mistakes: 2,
        completed: true,
        finalized: false,
      },
    ]);
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "opponent",
      isChallenger: false,
      timedOut: false,
      questionIndex: 0,
    });
    expect(patch.opponentLastAnswer).toBe("sentence:2");
    expect(patch.opponentScore).toBe(SENTENCE_MESSY_COMPLETION_POINTS);
  });

  it("scores 0 on timeout and marks the player answered", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "opponent",
        placedTileIndices: [0],
        mistakes: 1,
        completed: false,
        finalized: false,
      },
    ]);
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "opponent",
      isChallenger: false,
      timedOut: true,
      questionIndex: 0,
    });
    expect(patch.opponentAnswered).toBe(true);
    expect(patch.opponentScore).toBe(0);
    expect(patch.opponentLastAnswer).toBe("__TIMEOUT__");
  });

  it("treats a player who never tapped as a 0-mistake timeout", () => {
    const duel = sentenceDuel();
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: true,
      questionIndex: 0,
    });
    expect(patch.challengerLastAnswer).toBe("__TIMEOUT__");
    expect(patch.challengerScore).toBe(0);
  });

  it("is a no-op once the player has already answered", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0, 1],
        mistakes: 0,
        completed: true,
        finalized: false,
      },
    ]);
    duel.challengerAnswered = true;
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: false,
      questionIndex: 0,
    });
    expect(patch).toEqual({});
  });

  it("deducts lives equal to mistakes on a boss attempt", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0, 1],
        mistakes: 2,
        completed: true,
        finalized: false,
      },
    ]);
    duel.sourceType = "boss";
    duel.weeklyGoalId = "goal_1" as Id<"weeklyGoals">;
    duel.bossType = "mini";
    duel.livesRemaining = 5;
    duel.livesTotal = 5;
    duel.challengerPerfectRun = true;
    duel.opponentPerfectRun = true;
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: false,
      questionIndex: 0,
    });
    expect(patch.livesRemaining).toBe(3);
    expect(patch.challengerPerfectRun).toBe(false);
  });

  it("does not deduct extra HP on timeout (HP mirrors word: wrong taps only)", () => {
    const duel = sentenceDuel([
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0],
        mistakes: 1,
        completed: false,
        finalized: false,
      },
    ]);
    duel.sourceType = "boss";
    duel.weeklyGoalId = "goal_1" as Id<"weeklyGoals">;
    duel.bossType = "mini";
    duel.livesRemaining = 5;
    duel.challengerPerfectRun = true;
    duel.opponentPerfectRun = true;
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: true,
      questionIndex: 0,
    });
    expect(patch.livesRemaining).toBe(4);
  });

  it("deducts zero HP on a timeout with zero wrong taps", () => {
    const duel = sentenceDuel();
    duel.sourceType = "boss";
    duel.weeklyGoalId = "goal_1" as Id<"weeklyGoals">;
    duel.bossType = "mini";
    duel.livesRemaining = 5;
    duel.challengerPerfectRun = true;
    duel.opponentPerfectRun = true;
    const patch = buildSentenceAnswerPatch({
      duel,
      playerRole: "challenger",
      isChallenger: true,
      timedOut: true,
      questionIndex: 0,
    });
    expect(patch.livesRemaining).toBeUndefined();
  });
});

describe("validateTimedOutFlag", () => {
  it("accepts boolean values", () => {
    expect(() => validateTimedOutFlag(true)).not.toThrow();
    expect(() => validateTimedOutFlag(false)).not.toThrow();
  });
  it("rejects non-boolean values", () => {
    expect(() => validateTimedOutFlag("yes")).toThrow(/boolean/i);
    expect(() => validateTimedOutFlag(0)).toThrow(/boolean/i);
  });
});
