import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { fireHint } from "@/convex/hintPool";
import { createIndexedQuery, patchRow } from "./testUtils/inMemoryDb";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email">;
type DuelDoc = Doc<"duels">;

class InMemoryDb {
  constructor(
    public users: UserDoc[],
    public duels: DuelDoc[]
  ) {}

  query(table: "users") {
    if (table !== "users") throw new Error(`Unexpected table: ${table}`);
    return createIndexedQuery(this.users);
  }

  async get(id: Id<"users"> | Id<"duels">) {
    return (
      this.users.find((user) => user._id === id) ??
      this.duels.find((duel) => duel._id === id) ??
      null
    );
  }

  async patch(id: Id<"duels">, value: Partial<DuelDoc>) {
    patchRow(this.duels, id, value);
  }
}

function createCtx(db: InMemoryDb) {
  return {
    db,
    auth: {
      getUserIdentity: async () => ({ subject: "clerk_1" }),
    },
  };
}

function userDoc(overrides: Partial<UserDoc>): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "test@example.com",
    ...overrides,
  };
}

function duelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionItems: [
      {
        kind: "word" as const, word: "gato",
        answer: "cat",
        wrongAnswers: ["dog", "bird", "fish", "horse", "mouse"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    sourceType: "normal",
    duelMode: "pve",
    status: "active",
    createdAt: 1,
    currentWordIndex: 0,
    itemOrder: [0],
    duelQuestions: [
      {
        kind: "word" as const, options: ["cat", "dog", "bird", "fish", "horse", "mouse"],
        correctOption: "cat",
        difficulty: "medium",
        points: 1.5,
      },
    ],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    duelDifficultyPreset: "medium",
    questionStartTime: 1_000,
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 123,
    ...overrides,
  };
}

const fireHintHandler = (fireHint as unknown as {
  _handler: (
    ctx: unknown,
    args: { duelId: Id<"duels">; hintType: "fifty_fifty" | "plus_ten_seconds" | "anagram" | "letter_count" }
  ) => Promise<void>;
})._handler;

describe("hintPool.fireHint", () => {
  it("fires one PvE hint and writes the shared effect", async () => {
    const db = new InMemoryDb(
      [
        userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
        userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" }),
      ],
      [duelDoc()]
    );

    await fireHintHandler(createCtx(db), {
      duelId: "duel_1" as Id<"duels">,
      hintType: "fifty_fifty",
    });

    expect(db.duels[0].hintPoolUsed).toEqual(["fifty_fifty"]);
    expect(db.duels[0].currentQuestionHintFired).toBe(true);
    expect(db.duels[0].eliminatedOptions).toHaveLength(3);
    expect(db.duels[0].eliminatedOptions).not.toContain("cat");
    expect(db.duels[0].questionStartTime).toBe(6_000);
  });

  it("rejects a second hint on the same question", async () => {
    const db = new InMemoryDb(
      [userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" })],
      [duelDoc({ currentQuestionHintFired: true })]
    );

    await expect(
      fireHintHandler(createCtx(db), {
        duelId: "duel_1" as Id<"duels">,
        hintType: "anagram",
      })
    ).rejects.toThrow("Only one hint can be used per question");
  });

  it("rejects PvE hints in PvP duels", async () => {
    const db = new InMemoryDb(
      [userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" })],
      [duelDoc({ duelMode: "pvp" })]
    );

    await expect(
      fireHintHandler(createCtx(db), {
        duelId: "duel_1" as Id<"duels">,
        hintType: "letter_count",
      })
    ).rejects.toThrow("fireHint is only available in PVE duels");
  });
});
