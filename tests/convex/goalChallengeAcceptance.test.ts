import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { acceptChallenge } from "@/convex/challenges";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";
const now = 2_000_000_000_000;
const creatorId = "creator" as Id<"users">,
  partnerId = "partner" as Id<"users">,
  goalId = "goal" as Id<"weeklyGoals">,
  themeId = "theme" as Id<"themes">;
const accept = (
  acceptChallenge as unknown as {
    _handler: (
      ctx: unknown,
      args: { challengeId: Id<"challenges"> },
    ) => Promise<{ duelId: Id<"duels"> }>;
  }
)._handler;
function fixture(
  sourceType: "boss" | "spaced_repetition",
  bossType: "mini" | "big" = "mini",
  miniDefeated = false,
) {
  const goal: Doc<"weeklyGoals"> = {
    _id: goalId,
    _creationTime: 1,
    createdAt: now,
    mode: "shared",
    creatorId,
    partnerId,
    status: sourceType === "boss" ? "locked" : "completed",
    creatorLocked: true,
    partnerLocked: true,
    miniBossStatus: miniDefeated ? "defeated" : "ready",
    bigBossStatus: "ready",
    themes: [themeId, "extra" as Id<"themes">].map((id) => ({
      themeId: id,
      themeName: String(id),
      creatorCompleted: true,
      partnerCompleted: true,
    })),
  };
  const challenge: Doc<"challenges"> = {
    _id: "challenge" as Id<"challenges">,
    _creationTime: 1,
    challengerId: creatorId,
    opponentId: partnerId,
    themeIds: [themeId],
    sourceType,
    weeklyGoalId: goalId,
    ...(sourceType === "boss" ? { bossType } : { spacedRepetitionStep: 2 }),
    duelMode: "pve",
    status: "pending",
    createdAt: now,
  };
  const goals = [goal];
  const users: Doc<"users">[] = [
    {
      _id: creatorId,
      _creationTime: 1,
      clerkId: "creator",
      email: "creator@example.test",
    },
    {
      _id: partnerId,
      _creationTime: 1,
      clerkId: "partner",
      email: "partner@example.test",
    },
  ];
  const snapshots: Doc<"weeklyGoalThemeSnapshots">[] = [
    {
      _id: "snapshot" as Id<"weeklyGoalThemeSnapshots">,
      _creationTime: 1,
      weeklyGoalId: goalId,
      originalThemeId: themeId,
      order: 0,
      name: "Frozen Animals",
      description: "Snapshot",
      contentType: "word",
      wordType: "nouns",
      words: [
        {
          word: "cat",
          answer: "gato",
          wrongAnswers: ["perro", "pez", "ave", "oso", "vaca", "caballo"],
        },
      ],
      lockedAt: now - 1000,
      createdAt: now - 1000,
    },
  ];
  const insert = vi.fn(
    async (_table: string, _fields: Record<string, unknown>) =>
      "duel" as Id<"duels">,
  );
  const patch = vi.fn(async (id: string, updates: Record<string, unknown>) => {
    if (id !== challenge._id) throw new Error(`Unexpected patch ${id}`);
    Object.assign(challenge, updates);
  });
  const db = {
    get: async (id: string) =>
      [...users, ...goals, challenge].find((row) => row._id === id) ?? null,
    query: (table: string) => {
      if (table === "users") return createIndexedQuery(users);
      if (table === "weeklyGoalThemeSnapshots")
        return createIndexedQuery(snapshots);
      if (table === "notifications")
        return createIndexedQuery<{ _id: string }>([]);
      throw new Error(`Unexpected query ${table}`);
    },
    insert,
    patch,
  };
  return {
    goal,
    goals,
    challenge,
    snapshots,
    insert,
    patch,
    run: () =>
      accept(createAuthCtx(db, "partner"), { challengeId: challenge._id }),
  };
}
describe("goal-linked challenge acceptance", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());
  it.each([
    ["mini", false, 2],
    ["big", false, 3],
    ["big", true, 4],
  ] as const)(
    "starts a %s boss with %s prior mini victory and %s lives",
    async (bossType, miniDefeated, lives) => {
      const f = fixture("boss", bossType, miniDefeated);
      await expect(f.run()).resolves.toEqual({ duelId: "duel" });
      expect(f.insert).toHaveBeenCalledExactlyOnceWith(
        "duels",
        expect.objectContaining({
          sourceType: "boss",
          weeklyGoalId: goalId,
          bossType,
          livesTotal: lives,
          livesRemaining: lives,
          themeIds: [themeId],
          sessionItems: [
            expect.objectContaining({
              kind: "word",
              themeName: "Frozen Animals",
              answer: "gato",
            }),
          ],
        }),
      );
      expect(f.challenge).toMatchObject({
        status: "accepted",
        duelId: "duel",
        acceptedAt: now,
        resolvedAt: now,
      });
    },
  );
  it("allocates repetition lives from the full completed goal while keeping the requested source step", async () => {
    const f = fixture("spaced_repetition");
    await f.run();
    expect(f.insert).toHaveBeenCalledWith(
      "duels",
      expect.objectContaining({
        sourceType: "spaced_repetition",
        weeklyGoalId: goalId,
        spacedRepetitionStep: 2,
        livesTotal: 3,
        livesRemaining: 3,
        themeIds: [themeId],
      }),
    );
  });
  it.each(["goal", "snapshot"])(
    "rejects a missing %s before creating a duel or resolving the invite",
    async (missing) => {
      const f = fixture("boss");
      if (missing === "goal") f.goals.length = 0;
      else f.snapshots.length = 0;
      await expect(f.run()).rejects.toThrow(
        missing === "goal" ? "Weekly goal not found" : "snapshot is missing",
      );
      expect(f.insert).not.toHaveBeenCalled();
      expect(f.patch).not.toHaveBeenCalled();
      expect(f.challenge.status).toBe("pending");
    },
  );
});
