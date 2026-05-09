import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildChallengeInvite,
  buildDuelSession,
  buildSoloPracticeSession,
} from "@/convex/helpers/sessionCreation";
import type { SessionWordEntry } from "@/lib/sessionWords";

const sessionWords: SessionWordEntry[] = [
  {
    word: "cat",
    answer: "gato",
    wrongAnswers: ["perro", "pez", "pajaro"],
    themeId: "theme_1" as Id<"themes">,
    themeName: "Animals",
  },
  {
    word: "dog",
    answer: "perro",
    wrongAnswers: ["gato", "pez", "pajaro"],
    themeId: "theme_1" as Id<"themes">,
    themeName: "Animals",
  },
  {
    word: "bread",
    answer: "pan",
    wrongAnswers: ["agua", "carne", "leche"],
    themeId: "theme_2" as Id<"themes">,
    themeName: "Food",
  },
];

describe("session creation helpers", () => {
  it("builds pending challenge invites without gameplay state", () => {
    const result = buildChallengeInvite({
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      themeIds: ["theme_1" as Id<"themes">, "theme_1" as Id<"themes">],
      createdAt: 123,
    });

    expect(result).toMatchObject({
      challengerId: "user_1",
      opponentId: "user_2",
      status: "pending",
      sourceType: "normal",
      duelDifficultyPreset: "easy",
      createdAt: 123,
    });
    expect(result.themeIds).toEqual(["theme_1"]);
    expect("sessionWords" in result).toBe(false);
    expect("duelQuestions" in result).toBe(false);
  });

  it("builds active duel sessions with shuffled order and question snapshots", () => {
    const result = buildDuelSession({
      challengeId: "challenge_1" as Id<"challenges">,
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      sessionWords,
      sourceType: "boss",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      bossLivesTotal: 3,
      bossLivesRemaining: 3,
      duelDifficultyPreset: "medium",
      createdAt: 456,
    });

    expect(result.status).toBe("active");
    expect(result.themeIds).toEqual(["theme_1", "theme_2"]);
    expect(result.sessionWords).toHaveLength(3);
    expect(result.wordOrder).toHaveLength(3);
    expect([...result.wordOrder].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(result.duelQuestions).toHaveLength(3);
    expect(result.duelQuestions[0].options).toHaveLength(4);
    expect(result.duelDifficultyPreset).toBe("medium");
    expect(result.challengerScore).toBe(0);
    expect(result.opponentScore).toBe(0);
    expect(result.challengerPerfectRun).toBe(true);
    expect(result.opponentPerfectRun).toBe(true);
    expect(result.questionStartTime).toBe(456);
    expect(typeof result.seed).toBe("number");
  });

  it("builds persisted solo-practice sessions without challenge or duel fields", () => {
    const result = buildSoloPracticeSession({
      userId: "user_1" as Id<"users">,
      sessionWords,
      sourceType: "spaced_repetition",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      spacedRepetitionStep: 2,
      startsInLearning: true,
      createdAt: 789,
    });

    expect(result).toMatchObject({
      userId: "user_1",
      sourceType: "spaced_repetition",
      weeklyGoalId: "goal_1",
      spacedRepetitionStep: 2,
      status: "learning",
      createdAt: 789,
    });
    expect(result.themeIds).toEqual(["theme_1", "theme_2"]);
    expect(result.sessionWords).toHaveLength(3);
    expect("currentWordIndex" in result).toBe(false);
    expect("questionStartTime" in result).toBe(false);
    expect("seed" in result).toBe(false);
    expect("challengerId" in result).toBe(false);
    expect("opponentId" in result).toBe(false);
    expect("duelQuestions" in result).toBe(false);
  });

  it("rejects empty inputs at each creation boundary", () => {
    expect(() =>
      buildChallengeInvite({
        challengerId: "user_1" as Id<"users">,
        opponentId: "user_2" as Id<"users">,
        themeIds: [],
        createdAt: 1,
      })
    ).toThrow("Challenge requires at least one theme");

    expect(() =>
      buildDuelSession({
        challengerId: "user_1" as Id<"users">,
        opponentId: "user_2" as Id<"users">,
        sessionWords: [],
        sourceType: "normal",
        createdAt: 1,
      })
    ).toThrow("Duel requires at least one session word");

    expect(() =>
      buildSoloPracticeSession({
        userId: "user_1" as Id<"users">,
        sessionWords: [],
        sourceType: "weekly_goal",
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        startsInLearning: false,
        createdAt: 1,
      })
    ).toThrow("Solo practice requires at least one session word");
  });
});
