import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { MutationCtx } from "@/convex/_generated/server";
import { completeBigBoss, completeMiniBoss, handleCompleteBossSoloPractice } from "@/convex/weeklyGoals/bossWorkflows";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";

const effects = vi.hoisted(() => ({ ensure: vi.fn(), upsert: vi.fn(), dismiss: vi.fn() }));
vi.mock("@/convex/weeklyGoalRepetitions", () => ({ ensureRepetitionRecordsForCompletedGoal: effects.ensure }));
vi.mock("@/convex/weeklyGoals/notifications", () => ({ dismissChallengeNotifications: effects.dismiss }));
vi.mock("@/convex/notificationHelpers", () => ({ upsertWeeklyGoalNotificationForGoal: effects.upsert, createChallengeInviteNotificationAndEmail: vi.fn() }));
const userId = "user" as Id<"users">;
const goalId = "goal" as Id<"weeklyGoals">;
const sessionId = "session" as Id<"soloPracticeSessions">;
const now = 1_000_000;
function fixture(options: { session?: Partial<Doc<"soloPracticeSessions">>; goal?: Partial<Doc<"weeklyGoals">>; missingSession?: boolean; missingGoal?: boolean; identity?: string | null } = {}) {
  const user = { _id: userId, clerkId: "clerk" };
  const goal = { _id: goalId, mode: "solo", creatorId: userId, status: "locked", createdAt: 1,
    endDate: now + 100_000, creatorLocked: true, lockedAt: 1,
    miniBossStatus: "ready", bigBossStatus: "ready", themes: [
      { themeId: "a", themeName: "A", creatorCompleted: true },
      { themeId: "b", themeName: "B", creatorCompleted: true },
    ], ...options.goal } as Doc<"weeklyGoals">;
  const session = { _id: sessionId, userId, weeklyGoalId: goalId, sourceType: "boss", bossType: "mini", status: "active", ...options.session } as Doc<"soloPracticeSessions">;
  const db = {
    query: (table: string) => createIndexedQuery(table === "users" ? [user] : []),
    get: async (id: string) => id === sessionId ? options.missingSession ? null : session : id === goalId && !options.missingGoal ? goal : null,
    patch: vi.fn(async (id: string, patch: object) => Object.assign(id === sessionId ? session : goal, patch)),
  };
  return { goal, session, db, ctx: createAuthCtx(db, options.identity === undefined ? "clerk" : options.identity) as unknown as MutationCtx };
}
beforeEach(() => { vi.clearAllMocks(); vi.spyOn(Date, "now").mockReturnValue(now); });
afterEach(() => vi.restoreAllMocks());

describe("boss solo completion boundaries", () => {
  it.each([
    [{ identity: null }, "Unauthorized"], [{ missingSession: true }, "Solo practice session not found"],
    [{ session: { userId: "other" } }, "Not authorized"], [{ session: { sourceType: "spaced_repetition" } }, "Session is not a boss practice session"],
    [{ session: { bossType: undefined } }, "Session is not a boss practice session"], [{ missingGoal: true }, "Weekly goal not found"],
    [{ goal: { status: "draft" } }, "This goal is not playable"],
  ])("rejects invalid completion %j before writes", async (options, message) => {
    const f = fixture(options as Parameters<typeof fixture>[0]);
    await expect(handleCompleteBossSoloPractice(f.ctx, sessionId)).rejects.toThrow(message as string);
    expect(f.db.patch).not.toHaveBeenCalled();
    expect(effects.ensure).not.toHaveBeenCalled();
    expect(effects.upsert).not.toHaveBeenCalled();
  });
  it("treats an already completed session as idempotent even after its goal is removed", async () => {
    const f = fixture({ session: { status: "completed" }, missingGoal: true });
    expect(await handleCompleteBossSoloPractice(f.ctx, sessionId)).toEqual({ completed: false });
    expect(f.db.patch).not.toHaveBeenCalled();
  });
  it("records a shared-goal warmup without advancing either boss", async () => {
    const f = fixture({ goal: { mode: "shared", partnerId: "partner" as Id<"users">, partnerLocked: true } });
    expect(await handleCompleteBossSoloPractice(f.ctx, sessionId)).toEqual({ completed: false });
    expect(f.session).toMatchObject({ status: "completed", completedAt: now });
    expect(f.db.patch).toHaveBeenCalledTimes(1);
    expect(f.goal.miniBossStatus).toBe("ready");
    expect(effects.upsert).not.toHaveBeenCalled();
  });
  it("completes a solo mini boss and does not schedule repetitions or goal completion notices", async () => {
    const f = fixture();
    expect(await handleCompleteBossSoloPractice(f.ctx, sessionId)).toEqual({ completed: true });
    expect(f.session.status).toBe("completed");
    expect(f.goal).toMatchObject({ status: "locked", miniBossStatus: "defeated" });
    expect(effects.ensure).not.toHaveBeenCalled();
    expect(effects.upsert).not.toHaveBeenCalled();
  });
  it("completes a solo big boss, starts repetitions and sends the solo completion notice", async () => {
    const f = fixture({ session: { bossType: "big" } });
    expect(await handleCompleteBossSoloPractice(f.ctx, sessionId)).toEqual({ completed: true });
    expect(f.goal).toMatchObject({ status: "completed", bigBossStatus: "defeated", completedAt: now });
    expect(effects.ensure).toHaveBeenCalledWith(f.ctx, f.goal, now);
    expect(effects.upsert).toHaveBeenCalledExactlyOnceWith(f.ctx, { toUserId: userId, fromUserId: userId, goalId, themeCount: 2, event: "goal_completed_solo", createdAt: now });
    expect(effects.dismiss).not.toHaveBeenCalled();
  });
  it("does not repeat already recorded mini or big completion effects", async () => {
    const f = fixture({ goal: { miniBossStatus: "defeated", bigBossStatus: "defeated", status: "completed" } });
    const mini = fixture({ goal: { miniBossStatus: "defeated", themes: [
      { themeId: "a" as Id<"themes">, themeName: "A", creatorCompleted: true },
      { themeId: "b" as Id<"themes">, themeName: "B", creatorCompleted: false },
    ] } });
    await completeMiniBoss(mini.ctx, mini.goal); await completeBigBoss(f.ctx, f.goal);
    expect(mini.db.patch).not.toHaveBeenCalled();
    expect(f.db.patch).not.toHaveBeenCalled();
    expect(effects.upsert).not.toHaveBeenCalled();
  });
  it("notifies both shared participants and dismisses their outstanding boss invites", async () => {
    const partnerId = "partner" as Id<"users">;
    const f = fixture({ goal: { mode: "shared", partnerId, partnerLocked: true } });
    await completeBigBoss(f.ctx, f.goal);
    expect(effects.upsert.mock.calls).toEqual([
      [f.ctx, { toUserId: userId, fromUserId: partnerId, goalId, themeCount: 2, event: "goal_completed", createdAt: now }],
      [f.ctx, { toUserId: partnerId, fromUserId: userId, goalId, themeCount: 2, event: "goal_completed", createdAt: now }],
    ]);
    expect(effects.dismiss).toHaveBeenCalledWith(f.ctx, [userId, partnerId], []);
  });
});
