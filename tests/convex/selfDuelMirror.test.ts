import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { mirrorPatchForSelfDuel } from "@/convex/rules/selfDuelMirror";

function duelDoc(overrides: Partial<Doc<"duels">> = {}): Doc<"duels"> {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionWords: [],
    sourceType: "normal",
    duelMode: "pve",
    status: "active",
    createdAt: 1,
    currentWordIndex: 0,
    duelQuestions: [],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    hintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 123,
    duelDifficultyPreset: "easy",
    questionStartTime: 0,
    ...overrides,
  } as Doc<"duels">;
}

describe("mirrorPatchForSelfDuel", () => {
  it("returns unchanged patch for non-self-duels", () => {
    const duel = duelDoc();
    const patch = {
      challengerAnswered: true,
      challengerLastAnswer: "gato",
      challengerScore: 1,
    };
    expect(mirrorPatchForSelfDuel(patch, duel)).toEqual(patch);
  });

  it("mirrors answer patch for self-duel", () => {
    const duel = duelDoc({ opponentId: "user_1" as Id<"users"> });
    const patch = {
      challengerAnswered: true,
      challengerLastAnswer: "gato",
      challengerScore: 1.5,
    };
    expect(mirrorPatchForSelfDuel(patch, duel)).toEqual({
      ...patch,
      opponentAnswered: true,
      opponentLastAnswer: "gato",
      opponentScore: 1.5,
    });
  });

  it("mirrors timeout patch for self-duel without touching scores", () => {
    const duel = duelDoc({ opponentId: "user_1" as Id<"users"> });
    const patch = {
      challengerAnswered: true,
      challengerLastAnswer: "__TIMEOUT__",
    };
    const mirrored = mirrorPatchForSelfDuel(patch, duel);
    expect(mirrored).toEqual({
      challengerAnswered: true,
      challengerLastAnswer: "__TIMEOUT__",
      opponentAnswered: true,
      opponentLastAnswer: "__TIMEOUT__",
    });
    expect("opponentScore" in mirrored).toBe(false);
    expect("challengerScore" in mirrored).toBe(false);
  });

  it("is idempotent: applying twice gives the same result", () => {
    const duel = duelDoc({ opponentId: "user_1" as Id<"users"> });
    const patch = {
      challengerAnswered: true,
      challengerLastAnswer: "gato",
      challengerScore: 2,
    };
    const once = mirrorPatchForSelfDuel(patch, duel);
    const twice = mirrorPatchForSelfDuel(once, duel);
    expect(twice).toEqual(once);
  });

  it("returns empty patch unchanged for self-duels", () => {
    const duel = duelDoc({ opponentId: "user_1" as Id<"users"> });
    expect(mirrorPatchForSelfDuel({}, duel)).toEqual({});
  });
});
