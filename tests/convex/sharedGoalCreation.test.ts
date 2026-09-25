import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { handleCreateSharedGoal } from "@/convex/weeklyGoals/createGoal";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";
const creator = "creator" as Id<"users">;
const partner = "partner" as Id<"users">;
const now = 2_000_000_000_000;
function existingGoal(overrides: Partial<Doc<"weeklyGoals">> = {}): Doc<"weeklyGoals"> {
  return { _id: "existing" as Id<"weeklyGoals">, _creationTime: 1, createdAt: now, mode: "shared", creatorId: creator, partnerId: partner, status: "draft", creatorLocked: false, partnerLocked: false, miniBossStatus: "unavailable", bigBossStatus: "unavailable", themes: [], ...overrides };
}
function fixture() {
  const users = [{ _id: creator, clerkId: "clerk" }, { _id: partner, clerkId: "partner" }];
  const friends = [{ _id: "friendship", userId: creator, friendId: partner }];
  const goals: Doc<"weeklyGoals">[] = [];
  const insert = vi.fn(async (table: string, _fields: Record<string, unknown>) => `${table}_created`);
  const runAfter = vi.fn();
  const db = {
    query: (table: "users" | "friends" | "weeklyGoals") => {
      if (table === "users") return createIndexedQuery(users);
      if (table === "friends") return createIndexedQuery(friends);
      return createIndexedQuery(goals);
    },
    get: async (id: string) => users.find(user => user._id === id) ?? null,
    insert,
  };
  const ctx = createAuthCtx(db, "clerk", { scheduler: { runAfter } });
  return { users, friends, goals, insert, runAfter, run: () => handleCreateSharedGoal(ctx as never, partner) };
}
describe("shared goal creation", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
  afterEach(() => vi.useRealTimers());
  it("creates a shared draft and links the partner invitation and scheduled email", async () => {
    const f = fixture();
    f.goals.push(existingGoal({ status: "completed" }), existingGoal({ _id: "finished_boss" as Id<"weeklyGoals">, bigBossStatus: "defeated" }));
    await expect(f.run()).resolves.toBe("weeklyGoals_created");
    expect(f.insert.mock.calls).toEqual([
      ["weeklyGoals", { creatorId: creator, partnerId: partner, mode: "shared", themes: [], creatorLocked: false, partnerLocked: false, miniBossStatus: "unavailable", bigBossStatus: "unavailable", status: "draft", createdAt: now }],
      ["notifications", { type: "weekly_goal_invitation", fromUserId: creator, toUserId: partner, payload: { goalId: "weeklyGoals_created", themeCount: 0, event: "invite" }, status: "pending", createdAt: now }],
    ]);
    expect(f.runAfter).toHaveBeenCalledOnce();
    expect(f.runAfter.mock.calls[0][0]).toBe(0);
    expect(getFunctionName(f.runAfter.mock.calls[0][1])).toBe("emails/notificationEmails:sendNotificationEmail");
    expect(f.runAfter.mock.calls[0][2]).toEqual({ trigger: "weekly_goal_invite", toUserId: partner, fromUserId: creator, weeklyGoalId: "weeklyGoals_created" });
  });
  it.each(["missing partner", "not friends"])("rejects %s before writes", async state => {
    const f = fixture();
    if (state === "missing partner") f.users.pop();
    else f.friends.length = 0;
    await expect(f.run()).rejects.toThrow(state === "missing partner" ? "Partner not found" : "only create goals with friends");
    expect(f.insert).not.toHaveBeenCalled();
    expect(f.runAfter).not.toHaveBeenCalled();
  });
  it.each(["draft", "locked", "grace_period"] as const)("rejects an existing %s goal in either creator direction", async status => {
    for (const reversed of [false, true]) {
      const f = fixture();
      f.goals.push(existingGoal({ status, creatorId: reversed ? partner : creator, partnerId: reversed ? creator : partner, endDate: now + 1000 }));
      await expect(f.run()).rejects.toThrow("already have a goal with this partner");
      expect(f.insert).not.toHaveBeenCalled();
      expect(f.runAfter).not.toHaveBeenCalled();
    }
  });
});
