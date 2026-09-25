import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { completeWeeklyGoalMilestoneDuelInternal } from "@/convex/gameplay";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";

const creatorId = "creator" as Id<"users">;
const partnerId = "partner" as Id<"users">;
const goalId = "goal" as Id<"weeklyGoals">;
const now = 2_000_000_000_000;
const complete = (
  completeWeeklyGoalMilestoneDuelInternal as unknown as {
    _handler: (
      ctx: unknown,
      args: { duelId: Id<"duels"> },
    ) => Promise<{ completed: boolean }>;
  }
)._handler;
function fixture(bossType: "mini" | "big") {
  const users: Doc<"users">[] = [creatorId, partnerId].map((id) => ({
    _id: id,
    _creationTime: 1,
    clerkId: String(id),
    email: `${id}@example.test`,
  }));
  const goal: Doc<"weeklyGoals"> = {
    _id: goalId,
    _creationTime: 1,
    creatorId,
    partnerId,
    mode: "shared",
    status: "locked",
    createdAt: 1,
    lockedAt: 1,
    endDate: now + 100_000,
    creatorLocked: true,
    partnerLocked: true,
    miniBossStatus: "ready",
    bigBossStatus: "ready",
    themes: ["first", "second"].map((id, index) => ({
      themeId: id as Id<"themes">,
      themeName: id,
      creatorCompleted: bossType === "big" || index === 0,
      partnerCompleted: bossType === "big" || index === 0,
    })),
  };
  const duel: Doc<"duels"> = {
    _id: "duel" as Id<"duels">,
    _creationTime: 1,
    challengerId: creatorId,
    opponentId: partnerId,
    themeIds: ["first" as Id<"themes">],
    sessionItems: [
      {
        kind: "word",
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "pez", "oso"],
        themeId: "first" as Id<"themes">,
        themeName: "first",
      },
    ],
    sourceType: "boss",
    bossType,
    weeklyGoalId: goalId,
    duelMode: "pve",
    status: "completed",
    currentItemIndex: 0,
    challengerAnswered: true,
    opponentAnswered: true,
    challengerScore: 1,
    opponentScore: 1,
    createdAt: 1,
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 1,
    itemOrder: [0],
    livesTotal: 3,
    livesRemaining: 1,
  };
  const goals = [goal];
  const repetitions: Doc<"weeklyGoalRepetitions">[] = [];
  const notifications: Doc<"notifications">[] = [];
  const insert = vi.fn(async (table: string, fields: object) => {
    if (table === "weeklyGoalRepetitions") {
      const id = `rep${repetitions.length}` as Id<"weeklyGoalRepetitions">;
      repetitions.push({
        _id: id,
        _creationTime: now,
        ...fields,
      } as Doc<"weeklyGoalRepetitions">);
      return id;
    }
    if (table === "notifications") {
      const id = `notice${notifications.length}` as Id<"notifications">;
      notifications.push({
        _id: id,
        _creationTime: now,
        ...fields,
      } as Doc<"notifications">);
      return id;
    }
    throw new Error(`Unexpected insert ${table}`);
  });
  const db = {
    get: async (id: string) =>
      [...users, ...goals, duel, ...repetitions, ...notifications].find(
        (row) => row._id === id,
      ) ?? null,
    query: (table: string) => {
      if (table === "users") return createIndexedQuery(users);
      if (table === "weeklyGoalRepetitions")
        return createIndexedQuery(repetitions);
      if (table === "notifications") return createIndexedQuery(notifications);
      if (table === "challenges")
        return createIndexedQuery<Doc<"challenges">>([]);
      throw new Error(`Unexpected query ${table}`);
    },
    insert,
    patch: vi.fn(async (id: string, updates: object) => {
      const row = [...goals, ...repetitions, ...notifications].find(
        (row) => row._id === id,
      );
      if (!row) throw new Error(`Unexpected patch ${id}`);
      Object.assign(row, updates);
    }),
  };
  return {
    goal,
    goals,
    repetitions,
    notifications,
    db,
    run: () => complete(createAuthCtx(db, "partner"), { duelId: duel._id }),
  };
}
describe("boss duel completion persistence", () => {
  beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(now));
  afterEach(() => vi.restoreAllMocks());
  it("records a mini victory without completing the goal or scheduling repetitions", async () => {
    const f = fixture("mini");
    await expect(f.run()).resolves.toEqual({ completed: true });
    expect(f.goal).toMatchObject({
      status: "locked",
      miniBossStatus: "defeated",
      bigBossStatus: "ready",
    });
    expect(f.repetitions).toEqual([]);
    expect(f.notifications).toEqual([]);
  });
  it("completes the big boss and creates one repetition record and notice per participant, once", async () => {
    const f = fixture("big");
    await expect(f.run()).resolves.toEqual({ completed: true });
    expect(f.goal).toMatchObject({
      status: "completed",
      bigBossStatus: "defeated",
      completedAt: now,
    });
    expect(f.repetitions).toEqual(
      [creatorId, partnerId].map((userId) =>
        expect.objectContaining({
          weeklyGoalId: goalId,
          userId,
          completedSteps: [],
          createdAt: now,
          updatedAt: now,
        }),
      ),
    );
    expect(f.notifications).toEqual(
      [creatorId, partnerId].map((toUserId) =>
        expect.objectContaining({
          toUserId,
          status: "pending",
          payload: { goalId, themeCount: 2, event: "goal_completed" },
        }),
      ),
    );
    await f.run();
    expect(f.db.insert).toHaveBeenCalledTimes(4);
    expect(f.db.patch).toHaveBeenCalledTimes(1);
  });
  it("preserves existing repetition progress while creating the other participant's record", async () => {
    const f = fixture("big");
    const existing: Doc<"weeklyGoalRepetitions"> = {
      _id: "existing" as Id<"weeklyGoalRepetitions">,
      _creationTime: 1,
      weeklyGoalId: goalId,
      userId: creatorId,
      completedSteps: [{ completedAt: 2, completedVia: "duel", duelId: "prior" as Id<"duels"> }],
      createdAt: 1,
      updatedAt: 2,
    };
    f.repetitions.push(existing);
    await f.run();
    expect(f.repetitions).toHaveLength(2);
    expect(f.repetitions[0]).toEqual(existing);
    expect(f.repetitions[0].completedSteps).toEqual([{ completedAt: 2, completedVia: "duel", duelId: "prior" }]);
    expect(f.repetitions[0].updatedAt).toBe(2);
    expect(f.repetitions[1]).toMatchObject({
      userId: partnerId,
      completedSteps: [],
    });
  });
  it("returns an incomplete result when the goal was deleted before the completion job", async () => {
    const f = fixture("big");
    f.goals.length = 0;
    await expect(f.run()).resolves.toEqual({ completed: false });
    expect(f.db.insert).not.toHaveBeenCalled();
    expect(f.db.patch).not.toHaveBeenCalled();
  });
});
