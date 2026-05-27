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
    sessionWords: [],
    sourceType: "normal",
    duelMode: "pvp",
    status: "active",
    createdAt: 1,
    currentWordIndex: 0,
    wordOrder: [0],
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
    const duel = duelDoc({ challengerAnswered: true, opponentAnswered: true });

    expect(haveBothPlayersAnswered(duel)).toBe(true);
    expect(buildNextRoundPatch(duel, 1, 500)).toMatchObject({
      currentWordIndex: 1,
      challengerAnswered: false,
      opponentAnswered: false,
      questionStartTime: 500,
      hintRequestedBy: undefined,
    });
  });

  it("builds final completion patch and completion decisions", () => {
    const bossDuel = duelDoc({
      sourceType: "boss",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "big",
      livesRemaining: 1,
    });
    const spacedRepetitionDuel = duelDoc({ sourceType: "spaced_repetition" });

    expect(buildFinalCompletionPatch(bossDuel, 1)).toMatchObject({
      status: "completed",
      currentWordIndex: 1,
      challengerAnswered: false,
      opponentAnswered: false,
      questionStartTime: undefined,
    });
    expect(shouldCompleteWeeklyGoalBoss(bossDuel)).toBe(true);
    expect(shouldCompleteSpacedRepetitionDuel(spacedRepetitionDuel)).toBe(true);
  });
});
