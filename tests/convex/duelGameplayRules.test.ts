import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  buildAnswerPatch,
  buildFinalCompletionPatch,
  buildNextRoundPatch,
  buildTimeoutPatch,
  haveBothPlayersAnswered,
  shouldCompleteSpacedRepetitionDuel,
  shouldCompleteWeeklyGoalBoss,
} from "@/convex/rules/duelGameplayRules";

type DuelDoc = Doc<"duels">;

function duelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionItems: [],
    sourceType: "normal",
    duelMode: "pvp",
    status: "active",
    createdAt: 1,
    currentItemIndex: 0,
    itemOrder: [0],
    duelQuestions: [
      {
        kind: "word" as const, options: ["gato", "perro"],
        correctOption: "gato",
        difficulty: "easy",
        points: 1,
      },
    ],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 123,
    ...overrides,
  };
}

describe("duel gameplay rules", () => {
  it("builds answer and timeout patches", () => {
    expect(
      buildAnswerPatch({
        duel: duelDoc(),
        playerRole: "challenger",
        isChallenger: true,
        selectedAnswer: "gato",
        questionIndex: 0,
      })
    ).toMatchObject({
      challengerAnswered: true,
      challengerScore: 1,
      challengerLastAnswer: "gato",
    });

    expect(
      buildTimeoutPatch({
        duel: duelDoc(),
        playerRole: "opponent",
        isChallenger: false,
      })
    ).toMatchObject({
      opponentAnswered: true,
      opponentLastAnswer: "__TIMEOUT__",
    });
  });

  it("detects both answered and builds next round reset patch", () => {
    const duel = duelDoc({
      challengerAnswered: true,
      opponentAnswered: true,
      // A sabotage sent during this question must not survive the advance, or it
      // re-applies on the next question (the sentence-board re-mount bug).
      challengerSabotage: { effect: "bounce", timestamp: 10 },
      opponentSabotage: { effect: "reverse", timestamp: 20 },
      challengerSabotagesUsed: 2,
      opponentSabotagesUsed: 1,
    });

    expect(haveBothPlayersAnswered(duel)).toBe(true);

    const patch = buildNextRoundPatch(duel, 1, 500);
    expect(patch).toMatchObject({
      currentItemIndex: 1,
      challengerAnswered: false,
      opponentAnswered: false,
      questionStartTime: 500,
      hintRequestedBy: undefined,
    });

    // Clearing a Convex field requires the key to be present and set to
    // `undefined`; a missing key would leave the stale sabotage in place.
    expect(Object.prototype.hasOwnProperty.call(patch, "challengerSabotage")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(patch, "opponentSabotage")).toBe(true);
    expect(patch.challengerSabotage).toBeUndefined();
    expect(patch.opponentSabotage).toBeUndefined();
    // The cumulative per-duel budget is NOT reset on advance.
    expect(patch).not.toHaveProperty("challengerSabotagesUsed");
    expect(patch).not.toHaveProperty("opponentSabotagesUsed");
  });

  it("builds final completion patch and completion decisions", () => {
    const bossDuel = duelDoc({
      sourceType: "boss",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "big",
      livesRemaining: 1,
    });
    const spacedRepetitionDuel = duelDoc({ sourceType: "spaced_repetition" });

    // Final completion clamps `currentItemIndex` to the last real position so
    // the completed-state UI doesn't crash narrowing past the last question.
    const completionPatch = buildFinalCompletionPatch(bossDuel, 1);
    expect(completionPatch).toMatchObject({
      status: "completed",
      currentItemIndex: 0,
      challengerAnswered: false,
      opponentAnswered: false,
      questionStartTime: undefined,
    });
    expect(Object.prototype.hasOwnProperty.call(completionPatch, "challengerSabotage")).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(completionPatch, "opponentSabotage")).toBe(true);
    expect(completionPatch.challengerSabotage).toBeUndefined();
    expect(completionPatch.opponentSabotage).toBeUndefined();
    expect(shouldCompleteWeeklyGoalBoss(bossDuel)).toBe(true);
    expect(shouldCompleteSpacedRepetitionDuel(spacedRepetitionDuel)).toBe(true);
  });
});
