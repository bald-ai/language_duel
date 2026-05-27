import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  buildInitialRelayState,
  buildRelayAdvancePatch,
  buildRelayAnswerPatch,
  buildRelayPickPatch,
  buildRelayTimeoutPatch,
  isRelayFinished,
  relayAnswerer,
  relayHardBudgetForPool,
  relayRemainingPositions,
  relayServedQuestion,
} from "@/lib/duel/relayEngine";

type DuelDoc = Doc<"duels">;

function question(correctOption: string): NonNullable<DuelDoc["duelQuestions"]>[number] {
  return {
    kind: "word" as const,
    options: ["a", "b", "c", "d", "e", correctOption],
    correctOption,
    difficulty: "medium",
    points: 1,
  };
}

function relayDuel(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    _id: "duel_1" as DuelDoc["_id"],
    _creationTime: 1,
    challengerId: "user_1" as DuelDoc["challengerId"],
    opponentId: "user_2" as DuelDoc["opponentId"],
    themeIds: [],
    sessionWords: [
      { kind: "word" as const, word: "w0", answer: "base0", wrongAnswers: [], themeId: "t" as never, themeName: "T" },
      { kind: "word" as const, word: "w1", answer: "base1", wrongAnswers: [], themeId: "t" as never, themeName: "T" },
    ],
    sourceType: "normal",
    status: "active",
    createdAt: 1,
    currentWordIndex: 0,
    wordOrder: [0, 1],
    duelQuestions: [question("base0"), question("base1")],
    relayHardQuestions: [question("hard0"), question("hard1")],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    duelDifficultyPreset: "medium",
    duelMode: "relay",
    hintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 1,
    relayPicker: "challenger",
    relayPhase: "pick",
    relayResolvedIndices: [],
    relayHardUpgradeIndices: [],
    relayHardBudget: { challenger: 1, opponent: 1 },
    ...overrides,
  } as DuelDoc;
}

describe("relayEngine", () => {
  describe("relayHardBudgetForPool", () => {
    it("is ceil(poolSize / 10)", () => {
      expect(relayHardBudgetForPool(10)).toBe(1);
      expect(relayHardBudgetForPool(11)).toBe(2);
      expect(relayHardBudgetForPool(20)).toBe(2);
      expect(relayHardBudgetForPool(5)).toBe(1);
      expect(relayHardBudgetForPool(0)).toBe(0);
    });
  });

  describe("buildInitialRelayState", () => {
    it("starts with the challenger picking and equal hard budgets", () => {
      const items = [
        {
          kind: "word" as const,
          word: "cat",
          answer: "gato",
          wrongAnswers: ["a", "b", "c", "d", "e"],
          themeId: "theme_1" as Id<"themes">,
          themeName: "Animals",
        },
        {
          kind: "word" as const,
          word: "dog",
          answer: "perro",
          wrongAnswers: ["a", "b", "c", "d", "e"],
          themeId: "theme_1" as Id<"themes">,
          themeName: "Animals",
        },
      ];
      const state = buildInitialRelayState(items, [1, 0]);

      expect(state.relayPicker).toBe("challenger");
      expect(state.relayPhase).toBe("pick");
      expect(state.relayResolvedIndices).toEqual([]);
      expect(state.relayHardUpgradeIndices).toEqual([]);
      expect(state.relayHardBudget).toEqual({ challenger: 1, opponent: 1 });
      expect(state.relayHardQuestions).toHaveLength(2);
      // Hard relay snapshots are 6 options, same as the base set.
      for (const snapshot of state.relayHardQuestions) {
        if (snapshot.kind !== "word") throw new Error("expected word question");
        expect(snapshot.options).toHaveLength(6);
        expect(snapshot.points).toBe(1);
      }
    });
  });

  describe("turn helpers", () => {
    it("relayAnswerer is the rival of the picker", () => {
      expect(relayAnswerer(relayDuel({ relayPicker: "challenger" }))).toBe("opponent");
      expect(relayAnswerer(relayDuel({ relayPicker: "opponent" }))).toBe("challenger");
    });

    it("relayRemainingPositions excludes resolved and assigned positions", () => {
      const duel = relayDuel({
        wordOrder: [0, 1, 2, 3],
        relayResolvedIndices: [1],
        relayAssignedIndex: 2,
        duelQuestions: [question("a"), question("b"), question("c"), question("d")],
        relayHardQuestions: [question("a"), question("b"), question("c"), question("d")],
      });
      expect(relayRemainingPositions(duel)).toEqual([0, 3]);
    });

    it("isRelayFinished only when every position resolved and none assigned", () => {
      expect(isRelayFinished(relayDuel({ relayResolvedIndices: [0] }))).toBe(false);
      expect(
        isRelayFinished(relayDuel({ relayResolvedIndices: [0, 1], relayAssignedIndex: undefined }))
      ).toBe(true);
      expect(
        isRelayFinished(relayDuel({ relayResolvedIndices: [0, 1], relayAssignedIndex: 1 }))
      ).toBe(false);
    });
  });

  describe("relayServedQuestion (index semantics)", () => {
    it("serves the base snapshot for a normal position", () => {
      const duel = relayDuel({ relayAssignedIndex: 1, relayHardUpgradeIndices: [] });
      const served = relayServedQuestion(duel);
      expect(served?.kind === "word" ? served.correctOption : null).toBe("base1");
    });

    it("serves the hard snapshot for an upgraded position", () => {
      const duel = relayDuel({ relayAssignedIndex: 1, relayHardUpgradeIndices: [1] });
      const served = relayServedQuestion(duel);
      expect(served?.kind === "word" ? served.correctOption : null).toBe("hard1");
    });

    it("is undefined when nothing is assigned", () => {
      expect(relayServedQuestion(relayDuel({ relayAssignedIndex: undefined }))).toBeUndefined();
    });
  });

  describe("buildRelayPickPatch", () => {
    it("hands the word over and starts the answer phase", () => {
      const duel = relayDuel();
      const patch = buildRelayPickPatch({ duel, wordIndex: 0, hardUpgrade: false, now: 5000 });
      expect(patch.relayAssignedIndex).toBe(0);
      expect(patch.relayPhase).toBe("answer");
      expect(patch.relayAnswerStartedAt).toBe(5000);
      expect(patch.relayHardUpgradeIndices).toBeUndefined();
      expect(patch.relayHardBudget).toBeUndefined();
    });

    it("consumes a hard token from the picker on upgrade", () => {
      const duel = relayDuel({ relayPicker: "challenger", relayHardBudget: { challenger: 2, opponent: 3 } });
      const patch = buildRelayPickPatch({ duel, wordIndex: 1, hardUpgrade: true, now: 1 });
      expect(patch.relayHardUpgradeIndices).toEqual([1]);
      expect(patch.relayHardBudget).toEqual({ challenger: 1, opponent: 3 });
    });

    it("clamps the consumed budget at zero", () => {
      const duel = relayDuel({ relayPicker: "opponent", relayHardBudget: { challenger: 1, opponent: 0 } });
      const patch = buildRelayPickPatch({ duel, wordIndex: 0, hardUpgrade: true, now: 1 });
      expect(patch.relayHardBudget).toEqual({ challenger: 1, opponent: 0 });
    });
  });

  describe("buildRelayAnswerPatch", () => {
    it("scores the answerer on a correct answer and parks in feedback", () => {
      const duel = relayDuel({
        relayPicker: "challenger",
        relayPhase: "answer",
        relayAssignedIndex: 0,
        challengerScore: 2,
        opponentScore: 4,
      });
      const patch = buildRelayAnswerPatch({ duel, value: "base0" });
      expect(patch.relayPhase).toBe("feedback");
      // The opponent is the answerer; only their score moves, by a flat point.
      expect(patch.opponentScore).toBe(5);
      expect(patch.challengerScore).toBeUndefined();
      expect(patch.relayLastResult).toEqual({
        wordIndex: 0,
        chosen: "base0",
        correct: true,
        scorer: "opponent",
      });
      expect(patch.relayAnswerStartedAt).toBeUndefined();
    });

    it("does not score a wrong answer", () => {
      const duel = relayDuel({
        relayPicker: "opponent",
        relayPhase: "answer",
        relayAssignedIndex: 0,
      });
      const patch = buildRelayAnswerPatch({ duel, value: "wrong" });
      expect(patch.challengerScore).toBeUndefined();
      expect(patch.opponentScore).toBeUndefined();
      expect(patch.relayLastResult).toMatchObject({ correct: false, scorer: null });
    });

    it("scores against the served hard variant when upgraded", () => {
      const duel = relayDuel({
        relayPicker: "challenger",
        relayPhase: "answer",
        relayAssignedIndex: 0,
        relayHardUpgradeIndices: [0],
      });
      // The base answer is wrong for an upgraded position; only the hard key scores.
      expect(buildRelayAnswerPatch({ duel, value: "base0" }).relayLastResult).toMatchObject({
        correct: false,
      });
      expect(buildRelayAnswerPatch({ duel, value: "hard0" }).relayLastResult).toMatchObject({
        correct: true,
      });
    });
  });

  describe("hand-off patches", () => {
    it("advance resolves the word and the answerer becomes the next picker", () => {
      const duel = relayDuel({
        relayPicker: "challenger",
        relayPhase: "feedback",
        relayAssignedIndex: 0,
        relayResolvedIndices: [],
      });
      const patch = buildRelayAdvancePatch(duel);
      expect(patch.relayPicker).toBe("opponent");
      expect(patch.relayPhase).toBe("pick");
      expect(patch.relayAssignedIndex).toBeUndefined();
      expect(patch.relayResolvedIndices).toEqual([0]);
      expect(patch.relayLastResult).toBeUndefined();
    });

    it("timeout resolves like advance and clears the scheduled handle", () => {
      const duel = relayDuel({
        relayPicker: "opponent",
        relayPhase: "answer",
        relayAssignedIndex: 1,
        relayResolvedIndices: [0],
        relayTimeoutScheduledFunctionId: "sched_1" as DuelDoc["relayTimeoutScheduledFunctionId"],
      });
      const patch = buildRelayTimeoutPatch(duel);
      expect(patch.relayPicker).toBe("challenger");
      expect(patch.relayPhase).toBe("pick");
      expect(patch.relayResolvedIndices).toEqual([0, 1]);
      expect(patch.relayTimeoutScheduledFunctionId).toBeUndefined();
    });
  });
});
