import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import {
  buildChallengeInvite,
  buildDuelSession,
  buildSoloPracticeSession,
} from "@/convex/helpers/sessionCreation";
import type { SessionItem, SessionWordEntry } from "@/lib/sessionWords";

const sessionWords: SessionWordEntry[] = [
  {
    kind: "word" as const, word: "cat",
    answer: "gato",
    wrongAnswers: ["perro", "pez", "pajaro"],
    themeId: "theme_1" as Id<"themes">,
    themeName: "Animals",
  },
  {
    kind: "word" as const, word: "dog",
    answer: "perro",
    wrongAnswers: ["gato", "pez", "pajaro"],
    themeId: "theme_1" as Id<"themes">,
    themeName: "Animals",
  },
  {
    kind: "word" as const, word: "bread",
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
      sourceType: "normal",
      duelMode: "pvp",
      createdAt: 123,
    });

    expect(result).toMatchObject({
      challengerId: "user_1",
      opponentId: "user_2",
      status: "pending",
      sourceType: "normal",
      duelMode: "pvp",
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
      livesTotal: 3,
      livesRemaining: 3,
      duelDifficultyPreset: "medium",
      duelMode: "pve",
      createdAt: 456,
    });

    expect(result.status).toBe("active");
    expect(result.themeIds).toEqual(["theme_1", "theme_2"]);
    expect(result.sessionWords).toHaveLength(3);
    expect(result.wordOrder).toHaveLength(3);
    expect([...result.wordOrder].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(result.duelQuestions).toHaveLength(3);
    const firstQuestion = result.duelQuestions[0];
    if (firstQuestion.kind !== "word") throw new Error("expected word question");
    expect(firstQuestion.options).toHaveLength(4);
    expect(result.duelDifficultyPreset).toBe("medium");
    expect(result.duelMode).toBe("pve");
    expect(result.hintPoolUsed).toEqual([]);
    expect(result.currentQuestionHintFired).toBe(false);
    expect(result.challengerScore).toBe(0);
    expect(result.opponentScore).toBe(0);
    expect(result.challengerPerfectRun).toBe(true);
    expect(result.opponentPerfectRun).toBe(true);
    expect(result.questionStartTime).toBe(456);
    expect(typeof result.seed).toBe("number");
  });

  it("builds relay duel sessions with turn state and flat-point 6-option questions", () => {
    const relayWords: SessionWordEntry[] = [
      { kind: "word" as const, word: "cat", answer: "gato", wrongAnswers: ["a", "b", "c", "d", "e"], themeId: "theme_1" as Id<"themes">, themeName: "Animals" },
      { kind: "word" as const, word: "dog", answer: "perro", wrongAnswers: ["a", "b", "c", "d", "e"], themeId: "theme_1" as Id<"themes">, themeName: "Animals" },
    ];

    const result = buildDuelSession({
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      sessionWords: relayWords,
      sourceType: "normal",
      duelMode: "relay",
      createdAt: 1,
    });

    expect(result.duelMode).toBe("relay");
    expect(result.relayPicker).toBe("challenger");
    expect(result.relayPhase).toBe("pick");
    expect(result.relayResolvedIndices).toEqual([]);
    expect(result.relayHardUpgradeIndices).toEqual([]);
    expect(result.relayHardBudget).toEqual({ challenger: 1, opponent: 1 });
    expect(result.relayHardQuestions).toHaveLength(2);
    // Base and hard relay snapshots are both 6 options, worth a flat point.
    const baseQ = result.duelQuestions[0];
    const hardQ = result.relayHardQuestions?.[0];
    if (baseQ.kind !== "word") throw new Error("expected word question");
    if (!hardQ || hardQ.kind !== "word") throw new Error("expected word question");
    expect(baseQ.options).toHaveLength(6);
    expect(baseQ.points).toBe(1);
    expect(hardQ.options).toHaveLength(6);
    expect(hardQ.points).toBe(1);
  });

  it("builds relay duel sessions with mixed word + sentence items", () => {
    const mixedItems: SessionItem[] = [
      sessionWords[0],
      {
        kind: "sentence",
        englishPrompt: "I eat bread",
        spanishSentence: "Yo como pan",
        distractors: ["tú", "bebes"],
        themeId: "theme_2" as Id<"themes">,
        themeName: "Sentences",
      },
    ];

    const result = buildDuelSession({
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      sessionWords: mixedItems,
      sourceType: "normal",
      duelMode: "relay",
      createdAt: 1,
    });

    // The sentence position is present in both the base and hard sets, with an
    // identical pool (never 🔥-upgraded → served board == validated board).
    const sentenceBaseIndex = result.wordOrder?.findIndex(
      (sessionIndex) => mixedItems[sessionIndex].kind === "sentence"
    );
    expect(sentenceBaseIndex).toBeGreaterThanOrEqual(0);
    const base = result.duelQuestions?.[sentenceBaseIndex as number];
    const hard = result.relayHardQuestions?.[sentenceBaseIndex as number];
    if (base?.kind !== "sentence" || hard?.kind !== "sentence") {
      throw new Error("expected sentence questions in both sets");
    }
    expect(base.tilePool).toEqual(hard.tilePool);
  });

  it("builds Tag Team duel sessions with sentence-only turn state", () => {
    const sentenceItems: SessionItem[] = [
      {
        kind: "sentence",
        englishPrompt: "I eat bread",
        spanishSentence: "Yo como pan",
        distractors: ["tú", "bebes"],
        themeId: "theme_2" as Id<"themes">,
        themeName: "Sentences",
      },
    ];

    const result = buildDuelSession({
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      sessionWords: sentenceItems,
      sourceType: "normal",
      duelMode: "tbt",
      createdAt: 1,
    });

    expect(result.duelMode).toBe("tbt");
    expect(result.tbtTurn).toBe("challenger");
    expect(result.relayPhase).toBeUndefined();
    expect(result.duelQuestions).toHaveLength(1);
    expect(result.duelQuestions[0].kind).toBe("sentence");
  });

  it("rejects Tag Team duel sessions with word entries", () => {
    expect(() =>
      buildDuelSession({
        challengerId: "user_1" as Id<"users">,
        opponentId: "user_2" as Id<"users">,
        sessionWords,
        sourceType: "normal",
        duelMode: "tbt",
        createdAt: 1,
      })
    ).toThrow("Tag Team duels require an all-sentence deck");
  });

  it("omits relay state for non-relay duels", () => {
    const result = buildDuelSession({
      challengerId: "user_1" as Id<"users">,
      opponentId: "user_2" as Id<"users">,
      sessionWords,
      sourceType: "normal",
      duelMode: "pvp",
      createdAt: 1,
    });

    expect(result.relayPicker).toBeUndefined();
    expect(result.relayPhase).toBeUndefined();
    expect(result.relayHardQuestions).toBeUndefined();
    expect(result.relayHardBudget).toBeUndefined();
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
        opponentId: "user_1" as Id<"users">,
        themeIds: ["theme_1" as Id<"themes">],
        sourceType: "normal",
        duelMode: "pvp",
        createdAt: 1,
      })
    ).toThrow("Cannot challenge yourself");

    expect(() =>
      buildChallengeInvite({
        challengerId: "user_1" as Id<"users">,
        opponentId: "user_2" as Id<"users">,
        themeIds: [],
        sourceType: "normal",
        duelMode: "pvp",
        createdAt: 1,
      })
    ).toThrow("Challenge requires at least one theme");

    expect(() =>
      buildDuelSession({
        challengerId: "user_1" as Id<"users">,
        opponentId: "user_2" as Id<"users">,
        sessionWords: [],
        sourceType: "normal",
        duelMode: "pvp",
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
