import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  planConfirmUnpauseCountdown,
  planSkipCountdown,
} from "@/convex/rules/countdownPlanners";

function duelDoc(overrides: Partial<Doc<"duels">> = {}): Doc<"duels"> {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionItems: [],
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
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 123,
    duelDifficultyPreset: "easy",
    questionStartTime: 0,
    ...overrides,
  } as Doc<"duels">;
}

describe("planConfirmUnpauseCountdown", () => {
  it("returns noop when not paused", () => {
    expect(planConfirmUnpauseCountdown(duelDoc(), 1000)).toEqual({ kind: "noop" });
  });

  it("returns clearImmediately for self-duel with adjusted questionStartTime", () => {
    const duel = duelDoc({
      opponentId: "user_1" as Id<"users">,
      countdownPausedBy: "challenger",
      countdownPausedAt: 1_000,
      questionStartTime: 500,
    });
    expect(planConfirmUnpauseCountdown(duel, 1_300)).toEqual({
      kind: "clearImmediately",
      questionStartTime: 500 + 300,
    });
  });

  it("returns clearImmediately for self-duel regardless of unpauseRequestedBy", () => {
    const duel = duelDoc({
      opponentId: "user_1" as Id<"users">,
      countdownPausedBy: "challenger",
      countdownUnpauseRequestedBy: "challenger",
      countdownPausedAt: 1_000,
      questionStartTime: 500,
    });
    const plan = planConfirmUnpauseCountdown(duel, 2_000);
    expect(plan.kind).toBe("clearImmediately");
  });

  it("returns requirePeer for non-self-duel", () => {
    const duel = duelDoc({
      countdownPausedBy: "challenger",
      countdownPausedAt: 1_000,
    });
    expect(planConfirmUnpauseCountdown(duel, 2_000)).toEqual({ kind: "requirePeer" });
  });

  it("handles undefined questionStartTime", () => {
    const duel = duelDoc({
      opponentId: "user_1" as Id<"users">,
      countdownPausedBy: "challenger",
      countdownPausedAt: 1_000,
      questionStartTime: undefined as unknown as number,
    });
    expect(planConfirmUnpauseCountdown(duel, 2_000)).toEqual({
      kind: "clearImmediately",
      questionStartTime: undefined,
    });
  });
});

describe("planSkipCountdown", () => {
  it("returns both flagged for self-duel", () => {
    const duel = duelDoc({ opponentId: "user_1" as Id<"users"> });
    expect(planSkipCountdown(duel, "challenger")).toEqual({
      skipRequestedBy: ["challenger", "opponent"],
      bothSkipped: true,
      alreadyRequested: false,
    });
  });

  it("dedupes already-requested skips for non-self-duel", () => {
    const duel = duelDoc({ countdownSkipRequestedBy: ["challenger"] });
    expect(planSkipCountdown(duel, "challenger")).toEqual({
      skipRequestedBy: ["challenger"],
      bothSkipped: false,
      alreadyRequested: true,
    });
  });

  it("appends and marks bothSkipped when second player joins for non-self-duel", () => {
    const duel = duelDoc({ countdownSkipRequestedBy: ["challenger"] });
    expect(planSkipCountdown(duel, "opponent")).toEqual({
      skipRequestedBy: ["challenger", "opponent"],
      bothSkipped: true,
      alreadyRequested: false,
    });
  });
});
