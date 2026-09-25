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
        kind: "word",
        themeName: "Animals",
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
    duelMode: "pvp",
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
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
  };
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


it.each([
  { hintAccepted: false },
  { hintRequestedBy: undefined },
  { eliminatedOptions: undefined },
  { eliminatedOptions: [] },
] satisfies Partial<Doc<"duels">>[])("does not award a bonus without an accepted, applied hint (%#)", overrides => {
  const duel = duelDoc({ hintAccepted: true, hintRequestedBy: "opponent", eliminatedOptions: ["mesa"], opponentLastAnswer: "gato", ...overrides });
  expect(getHintProviderBonusPatch(duel)).toEqual({});
});

it.each([0, 3])("awards the challenger provider from an opponent request at score %i", score => {
  const duel = duelDoc({ hintAccepted: true, hintRequestedBy: "opponent", eliminatedOptions: ["mesa"], opponentLastAnswer: "gato", challengerScore: score });
  expect(getHintProviderBonusPatch(duel)).toEqual({ challengerScore: score + 0.5 });
});

it("awards a provider starting at zero and ignores sentence-round bonuses", () => {
  const duel = duelDoc({ hintAccepted: true, hintRequestedBy: "challenger", eliminatedOptions: ["mesa"], challengerLastAnswer: "gato" });
  expect(getHintProviderBonusPatch(duel)).toEqual({ opponentScore: 0.5 });
  duel.duelQuestions = [{ kind: "sentence", englishPrompt: "I eat", spanishSentence: "Yo como", tilePool: ["Yo", "como"], tileMeanings: [null, null] }];
  expect(getHintProviderBonusPatch(duel)).toEqual({});
});
