import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { acceptHint, eliminateOption, requestHint } from "@/convex/hints";
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

function createCtx(db: InMemoryDb, subject = "clerk_1") {
  return {
    db,
    auth: {
      getUserIdentity: async () => ({ subject }),
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
    sessionItems: [],
    sourceType: "normal",
    duelMode: "pvp",
    status: "active",
    createdAt: 1,
    currentItemIndex: 0,
    itemOrder: [0],
    duelQuestions: [
      {
        kind: "word" as const, options: ["cat", "dog", "bird", "fish"],
        correctOption: "cat",
        difficulty: "easy",
        points: 1,
      },
    ],
    challengerAnswered: false,
    opponentAnswered: true,
    challengerScore: 0,
    opponentScore: 0,
    duelDifficultyPreset: "easy",
    questionStartTime: 1_000,
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 123,
    ...overrides,
  };
}

function dbWithDuel(duel: DuelDoc) {
  return new InMemoryDb(
    [
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" }),
    ],
    [duel]
  );
}

const requestHintHandler = (requestHint as unknown as {
  _handler: (ctx: unknown, args: { duelId: Id<"duels"> }) => Promise<void>;
})._handler;
const acceptHintHandler = (acceptHint as unknown as {
  _handler: (ctx: unknown, args: { duelId: Id<"duels"> }) => Promise<void>;
})._handler;
const eliminateOptionHandler = (eliminateOption as unknown as {
  _handler: (ctx: unknown, args: { duelId: Id<"duels">; option: string }) => Promise<void>;
})._handler;

describe("PvP hint mode guards", () => {
  it("allows requestHint in PvP and blocks it in PvE", async () => {
    const pvpDb = dbWithDuel(duelDoc());
    await requestHintHandler(createCtx(pvpDb), { duelId: "duel_1" as Id<"duels"> });
    expect(pvpDb.duels[0].hintRequestedBy).toBe("challenger");

    const pveDb = dbWithDuel(duelDoc({ duelMode: "pve" }));
    await expect(
      requestHintHandler(createCtx(pveDb), { duelId: "duel_1" as Id<"duels"> })
    ).rejects.toThrow("requestHint is only available in PVP duels");
  });

  it("allows acceptHint in PvP and blocks it in PvE", async () => {
    const pvpDb = dbWithDuel(duelDoc({
      challengerAnswered: true,
      opponentAnswered: false,
      hintRequestedBy: "opponent",
    }));
    await acceptHintHandler(createCtx(pvpDb), { duelId: "duel_1" as Id<"duels"> });
    expect(pvpDb.duels[0].hintAccepted).toBe(true);

    const pveDb = dbWithDuel(duelDoc({
      duelMode: "pve",
      challengerAnswered: true,
      opponentAnswered: false,
      hintRequestedBy: "opponent",
    }));
    await expect(
      acceptHintHandler(createCtx(pveDb), { duelId: "duel_1" as Id<"duels"> })
    ).rejects.toThrow("acceptHint is only available in PVP duels");
  });

  it("allows eliminateOption in PvP and blocks it in PvE", async () => {
    const pvpDb = dbWithDuel(duelDoc({
      hintRequestedBy: "challenger",
      hintAccepted: true,
    }));
    await eliminateOptionHandler(createCtx(pvpDb, "clerk_2"), {
      duelId: "duel_1" as Id<"duels">,
      option: "dog",
    });
    expect(pvpDb.duels[0].eliminatedOptions).toEqual(["dog"]);

    const pveDb = dbWithDuel(duelDoc({
      duelMode: "pve",
      hintRequestedBy: "challenger",
      hintAccepted: true,
    }));
    await expect(
      eliminateOptionHandler(createCtx(pveDb, "clerk_2"), {
        duelId: "duel_1" as Id<"duels">,
        option: "dog",
      })
    ).rejects.toThrow("eliminateOption is only available in PVP duels");
  });
});
