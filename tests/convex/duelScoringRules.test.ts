import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  getLimitedLivesMissPatch,
  getHintProviderBonusPatch,
  hasLivesLeft,
  isBossAttempt,
} from "@/convex/rules/duelScoringRules";

function duelDoc(overrides: Partial<Doc<"duels">> = {}): Doc<"duels"> {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionItems: [
      {
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "mesa", "casa"],
        themeId: "theme_1" as Id<"themes">,
      },
    ],
    duelQuestions: [
      {
        kind: "word" as const, options: ["gato", "perro", "mesa", "casa"],
        correctOption: "gato",
        difficulty: "easy",
        points: 1,
      },
    ],
    sourceType: "normal",
    status: "active",
    createdAt: 1,
    currentItemIndex: 0,
    itemOrder: [0],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    questionStartTime: 1,
    seed: 123,
    ...overrides,
  } as Doc<"duels">;
}

describe("duel scoring rules", () => {
  it("detects boss attempts and remaining lives", () => {
    const bossDuel = duelDoc({
      sourceType: "boss",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      livesRemaining: 2,
    });

    expect(isBossAttempt(bossDuel)).toBe(true);
    expect(hasLivesLeft(bossDuel)).toBe(true);
  });

  it("decrements lives and marks perfect-run loss on misses", () => {
    const duel = duelDoc({
      sourceType: "boss",
      weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      bossType: "mini",
      livesRemaining: 2,
      challengerPerfectRun: true,
      opponentPerfectRun: true,
    });

    expect(getLimitedLivesMissPatch(duel, "challenger")).toMatchObject({
      challengerPerfectRun: false,
      livesRemaining: 1,
    });
  });

  it("ends attempt state when the final life is lost", () => {
    const duel = duelDoc({
      sourceType: "spaced_repetition",
      livesRemaining: 1,
      challengerPerfectRun: true,
      opponentPerfectRun: true,
    });

    expect(getLimitedLivesMissPatch(duel, "opponent")).toMatchObject({
      opponentPerfectRun: false,
      livesRemaining: 0,
      status: "completed",
    });
  });

  it("awards hint provider bonus only when requester answered correctly", () => {
    const correctRequester = duelDoc({
      hintRequestedBy: "challenger",
      hintAccepted: true,
      eliminatedOptions: ["mesa"],
      challengerLastAnswer: "gato",
      opponentScore: 1,
    });
    const wrongRequester = duelDoc({
      hintRequestedBy: "challenger",
      hintAccepted: true,
      eliminatedOptions: ["mesa"],
      challengerLastAnswer: "perro",
      opponentScore: 1,
    });

    expect(getHintProviderBonusPatch(correctRequester)).toMatchObject({
      opponentScore: 1.5,
    });
    expect(getHintProviderBonusPatch(wrongRequester)).toEqual({});
  });
});
