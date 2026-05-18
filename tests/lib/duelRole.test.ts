import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { forRole } from "@/lib/duelRole";

function duelDoc(overrides: Partial<Doc<"duels">> = {}): Doc<"duels"> {
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
    challengerAnswered: true,
    opponentAnswered: false,
    challengerScore: 3,
    opponentScore: 1,
    challengerLastAnswer: "gato",
    opponentLastAnswer: "perro",
    challengerSabotage: { effect: "sticky", timestamp: 10 },
    opponentSabotage: { effect: "reverse", timestamp: 20 },
    challengerSabotagesUsed: 2,
    opponentSabotagesUsed: 4,
    hintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 123,
    ...overrides,
  };
}

describe("forRole", () => {
  it("projects challenger fields as mine and opponent fields as theirs", () => {
    const view = forRole(duelDoc(), "challenger");

    expect(view).toMatchObject({
      myScore: 3,
      theirScore: 1,
      myAnswered: true,
      theirAnswered: false,
      myLastAnswer: "gato",
      theirLastAnswer: "perro",
      mySabotage: { effect: "sticky", timestamp: 10 },
      theirSabotage: { effect: "reverse", timestamp: 20 },
      mySabotagesUsed: 2,
      theirSabotagesUsed: 4,
      theirRole: "opponent",
    });
  });

  it("projects opponent fields as mine and defaults missing sabotage counts to zero", () => {
    const view = forRole(
      duelDoc({
        challengerSabotagesUsed: undefined,
        opponentSabotagesUsed: undefined,
      }),
      "opponent"
    );

    expect(view).toMatchObject({
      myScore: 1,
      theirScore: 3,
      myAnswered: false,
      theirAnswered: true,
      myLastAnswer: "perro",
      theirLastAnswer: "gato",
      mySabotagesUsed: 0,
      theirSabotagesUsed: 0,
      theirRole: "challenger",
    });
  });
});
