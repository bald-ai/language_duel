import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { setGoalEndDate, createDraftExpiryNotification, getDraftGoalsExpiringSoon } from "@/convex/weeklyGoals";
import { MIN_GOAL_DURATION_MS, WEEKLY_GOAL_DRAFT_TTL_MS, DRAFT_EXPIRY_REMINDER_LEAD_MS, DRAFT_EXPIRY_REMINDER_WINDOW_MS } from "@/convex/constants";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";
const now = 2_000_000_000_000;
const userId = "creator" as Id<"users">;
const goalId = "goal" as Id<"weeklyGoals">;
const dateHandler = (setGoalEndDate as unknown as { _handler: (ctx: unknown, args: { goalId: Id<"weeklyGoals">; endDate: number }) => Promise<void> })._handler;
const expiryHandler = (createDraftExpiryNotification as unknown as { _handler: (ctx: unknown, args: { goalId: Id<"weeklyGoals">; now: number }) => Promise<{ created: boolean }> })._handler;
const expiring = (getDraftGoalsExpiringSoon as unknown as { _handler: (ctx: unknown, args: object) => Promise<Doc<"weeklyGoals">[]> })._handler;
function fixture() {
  const goal: Doc<"weeklyGoals"> = { _id: goalId, _creationTime: 1, createdAt: now, mode: "shared", creatorId: userId, partnerId: "partner" as Id<"users">, status: "draft", creatorLocked: false, partnerLocked: false, miniBossStatus: "unavailable", bigBossStatus: "unavailable", themes: [] };
  const goals = [goal];
  const users = [{ _id: userId, clerkId: "clerk" }, { _id: goal.partnerId!, clerkId: "partner" }, { _id: "outsider", clerkId: "outsider" }];
  const notifications: Doc<"notifications">[] = [];
  const patch = vi.fn(async (_id: string, fields: Record<string, unknown>) => { Object.assign(goal, fields); });
  const insert = vi.fn(async (_table: string, fields: Omit<Doc<"notifications">, "_id" | "_creationTime">) => { notifications.push({ ...fields, _id: "notice" as Id<"notifications">, _creationTime: now }); return "notice"; });
  const db = { get: async (id: string) => goals.find(g => g._id === id) ?? null, query: (table: string) => table === "users" ? createIndexedQuery(users) : table === "notifications" ? createIndexedQuery(notifications) : createIndexedQuery(goals), patch, insert };
  return { goal, goals, notifications, patch, insert, ctx: (identity: string | null = "clerk") => createAuthCtx(db, identity) };
}
describe("goal date and draft-expiry lifecycle", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
  afterEach(() => vi.useRealTimers());
  it.each(["clerk", "partner"])("lets either draft participant set the inclusive minimum end date (%s)", async identity => {
    const f = fixture();
    await expect(dateHandler(f.ctx(identity), { goalId, endDate: now + MIN_GOAL_DURATION_MS })).resolves.toBeUndefined();
    expect(f.patch).toHaveBeenCalledExactlyOnceWith(goalId, { endDate: now + MIN_GOAL_DURATION_MS });
  });
  it.each([NaN, Infinity, now + MIN_GOAL_DURATION_MS - 1])("rejects an invalid end date %s without writes", async endDate => {
    const f = fixture();
    await expect(dateHandler(f.ctx(), { goalId, endDate })).rejects.toThrow(Number.isFinite(endDate) ? "at least 24 hours" : "Invalid end date");
    expect(f.patch).not.toHaveBeenCalled();
  });
  it.each(["locked", "completed", "grace_period"] as const)("rejects an end-date edit to a %s goal", async status => {
    const f = fixture(); f.goal.status = status; f.goal.endDate = now + MIN_GOAL_DURATION_MS;
    await expect(dateHandler(f.ctx(), { goalId, endDate: now + MIN_GOAL_DURATION_MS * 2 })).rejects.toThrow("can no longer be changed");
    expect(f.patch).not.toHaveBeenCalled();
  });
  it("rejects outsiders and missing goals", async () => {
    const f = fixture();
    await expect(dateHandler(f.ctx("outsider"), { goalId, endDate: now + MIN_GOAL_DURATION_MS })).rejects.toThrow("Not authorized");
    f.goals.length = 0;
    await expect(dateHandler(f.ctx(), { goalId, endDate: now + MIN_GOAL_DURATION_MS })).rejects.toThrow("Goal not found");
    expect(f.patch).not.toHaveBeenCalled();
  });
  it("creates one creator reminder and does not duplicate pending or read reminders", async () => {
    const f = fixture();
    await expect(expiryHandler(f.ctx(), { goalId, now })).resolves.toEqual({ created: true });
    expect(f.notifications[0]).toMatchObject({ type: "weekly_goal_draft_expiring", fromUserId: userId, toUserId: userId, status: "pending", payload: { goalId, themeCount: 0 }, createdAt: now });
    await expect(expiryHandler(f.ctx(), { goalId, now })).resolves.toEqual({ created: false });
    f.notifications[0].status = "read";
    await expect(expiryHandler(f.ctx(), { goalId, now })).resolves.toEqual({ created: false });
    expect(f.insert).toHaveBeenCalledOnce();
  });
  it("does not let dismissed, other-goal or other-recipient reminders suppress a new reminder", async () => {
    const f = fixture();
    await expiryHandler(f.ctx(), { goalId, now });
    const saved = f.notifications[0];
    saved.status = "dismissed";
    f.notifications.push({ ...saved, _id: "othergoal" as Id<"notifications">, status: "pending", payload: { goalId: "other" as Id<"weeklyGoals">, themeCount: 1 } }, { ...saved, _id: "otheruser" as Id<"notifications">, status: "pending", toUserId: "partner" as Id<"users"> });
    await expect(expiryHandler(f.ctx(), { goalId, now })).resolves.toEqual({ created: true });
    expect(f.insert).toHaveBeenCalledTimes(2);
  });
  it.each(["missing", "locked"])("does not notify a %s draft", async state => {
    const f = fixture(); if (state === "missing") f.goals.length = 0; else f.goal.status = "locked";
    await expect(expiryHandler(f.ctx(), { goalId, now })).resolves.toEqual({ created: false });
    expect(f.insert).not.toHaveBeenCalled();
  });
  it("selects only draft goals within the inclusive-start/exclusive-end reminder window", async () => {
    const f = fixture();
    const end = now - WEEKLY_GOAL_DRAFT_TTL_MS + DRAFT_EXPIRY_REMINDER_LEAD_MS;
    const start = end - DRAFT_EXPIRY_REMINDER_WINDOW_MS;
    f.goals.splice(0, 1, ...[start - 1, start, end - 1, end].map((createdAt, i) => ({ ...f.goal, _id: `g${i}` as Id<"weeklyGoals">, createdAt })), { ...f.goal, _id: "locked" as Id<"weeklyGoals">, status: "locked", createdAt: start });
    expect((await expiring(f.ctx(), {})).map(g => g._id)).toEqual(["g1", "g2"]);
  });
});
