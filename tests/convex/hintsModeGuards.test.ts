import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { HINT_TIME_BONUS_MS } from "@/convex/constants";
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

describe("PvP hint lifecycle and rejected writes", () => {
  it.each([
    [{ status: "completed" }, "Duel is not active"],
    [{ challengerAnswered: true }, "You already answered"],
    [{ opponentAnswered: false }, "Opponent hasn't answered yet"],
    [{ hintRequestedBy: "opponent" }, "Hint already requested"],
  ] as const)("rejects request %j without changing the duel", async (override, message) => {
    const db = dbWithDuel(duelDoc(override));
    const before = structuredClone(db.duels);
    await expect(requestHintHandler(createCtx(db), { duelId: db.duels[0]._id })).rejects.toThrow(message);
    expect(db.duels).toEqual(before);
  });

  it.each([
    [{ status: "completed" }, "Duel is not active"],
    [{ challengerAnswered: false }, "You haven't answered yet"],
    [{ hintRequestedBy: "challenger" }, "No hint request from opponent"],
    [{ hintAccepted: true }, "Hint already accepted"],
  ] as const)("rejects acceptance %j without changing the duel", async (override, message) => {
    const db = dbWithDuel(duelDoc({ challengerAnswered: true, hintRequestedBy: "opponent", ...override }));
    const before = structuredClone(db.duels);
    await expect(acceptHintHandler(createCtx(db), { duelId: db.duels[0]._id })).rejects.toThrow(message);
    expect(db.duels).toEqual(before);
  });

  it.each([
    [{ status: "completed" }, "dog", "Duel is not active"],
    [{ hintRequestedBy: "opponent" }, "dog", "You are not the hint provider"],
    [{ hintAccepted: false }, "dog", "Hint not accepted yet"],
    [{ duelQuestions: [] }, "dog", "Duel question data is missing"],
    [{}, "absent", "Invalid option"],
    [{}, "cat", "Cannot eliminate the correct answer"],
    [{ eliminatedOptions: ["dog"] }, "dog", "Option already eliminated"],
    [{ eliminatedOptions: ["bird", "fish"] }, "dog", "Maximum 2 options can be eliminated"],
  ] as const)("rejects elimination %j/%s without a write", async (override, option, message) => {
    const db = dbWithDuel(duelDoc({ hintRequestedBy: "challenger", hintAccepted: true, ...override } as Partial<DuelDoc>));
    const before = structuredClone(db.duels);
    await expect(eliminateOptionHandler(createCtx(db, "clerk_2"), { duelId: db.duels[0]._id, option })).rejects.toThrow(message);
    expect(db.duels).toEqual(before);
  });

  it("adds the time bonus once, holds for the first pick, and resumes after two", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(10_000);
    try {
      const db = dbWithDuel(duelDoc());
      const args = { duelId: db.duels[0]._id };
      await requestHintHandler(createCtx(db), args);
      await acceptHintHandler(createCtx(db, "clerk_2"), args);
      expect(db.duels[0]).toMatchObject({ hintAccepted: true, eliminatedOptions: [], questionTimerPausedAt: 10_000, questionTimerPausedBy: "opponent", questionStartTime: 1_000 + HINT_TIME_BONUS_MS });
      clock.mockReturnValue(12_000);
      await eliminateOptionHandler(createCtx(db, "clerk_2"), { ...args, option: "dog" });
      expect(db.duels[0]).toMatchObject({ eliminatedOptions: ["dog"], questionTimerPausedAt: 10_000 });
      clock.mockReturnValue(14_000);
      await eliminateOptionHandler(createCtx(db, "clerk_2"), { ...args, option: "bird" });
      expect(db.duels[0]).toMatchObject({ eliminatedOptions: ["dog", "bird"], questionStartTime: 5_000 + HINT_TIME_BONUS_MS });
      expect(db.duels[0].questionTimerPausedAt).toBeUndefined();
      expect(db.duels[0].questionTimerPausedBy).toBeUndefined();
    } finally { clock.mockRestore(); }
  });

  it("anchors an accepted hint to now when the question has no start timestamp", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(50_000);
    try {
      const db = dbWithDuel(duelDoc({ questionStartTime: undefined, hintRequestedBy: "challenger" }));
      await acceptHintHandler(createCtx(db, "clerk_2"), { duelId: db.duels[0]._id });
      expect(db.duels[0].questionStartTime).toBe(50_000 + HINT_TIME_BONUS_MS);
    } finally { clock.mockRestore(); }
  });

  it.each([undefined, 0, 5_000])("resumes with pause timestamp %s and no question timestamp", async (pausedAt) => {
    const db = dbWithDuel(duelDoc({ questionStartTime: undefined, questionTimerPausedAt: pausedAt,
      questionTimerPausedBy: "opponent", hintRequestedBy: "challenger", hintAccepted: true, eliminatedOptions: ["dog"] }));
    await eliminateOptionHandler(createCtx(db, "clerk_2"), { duelId: db.duels[0]._id, option: "bird" });
    expect(db.duels[0].questionStartTime).toBeUndefined();
    expect(db.duels[0].questionTimerPausedAt).toBeUndefined();
    expect(db.duels[0].questionTimerPausedBy).toBeUndefined();
    expect(db.duels[0].eliminatedOptions).toEqual(["dog", "bird"]);
  });
});
