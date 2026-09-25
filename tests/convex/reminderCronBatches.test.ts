import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { FunctionReference } from "convex/server";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { sendWeeklyGoalReminders, sendDailyWeeklyGoalReminderEmails, sendDraftExpiryReminders } from "@/convex/emails/reminderCrons";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPreferences";
const now = Date.parse("2026-09-25T10:00:00Z");
const creator = "creator" as Id<"users">;
const partner = "partner" as Id<"users">;
function goal(id: string, overrides: Partial<Doc<"weeklyGoals">> = {}): Doc<"weeklyGoals"> {
  return { _id: id as Id<"weeklyGoals">, _creationTime: 1, createdAt: now, mode: "shared", creatorId: creator, partnerId: partner, status: "locked", creatorLocked: true, partnerLocked: true, miniBossStatus: "unavailable", bigBossStatus: "unavailable", themes: [], endDate: now + 60 * 60_000, ...overrides };
}
type Ref = FunctionReference<"query" | "mutation" | "action">;
function fixture() {
  const locked: Doc<"weeklyGoals">[] = [];
  const grace: Doc<"weeklyGoals">[] = [];
  const drafts: Doc<"weeklyGoals">[] = [];
  const alreadySent = new Set<string>();
  const runQuery = vi.fn(async (ref: Ref, args: Record<string, unknown>) => {
    switch (getFunctionName(ref)) {
      case "weeklyGoals:getLockedGoalsWithEndDate": return locked;
      case "weeklyGoals:getGoalsInGraceWindow": return grace;
      case "weeklyGoals:getDraftGoalsExpiringSoon": return drafts;
      case "notificationPreferences:getByUserId": return { ...DEFAULT_NOTIFICATION_PREFS, weeklyGoalReminder1OffsetMinutes: 60, weeklyGoalReminder2OffsetMinutes: 60 };
      case "emails/emailNotificationLog:checkNotificationSent": return alreadySent.has(String(args.weeklyGoalId));
      default: throw new Error("Unexpected query");
    }
  });
  const runAction = vi.fn(async (_ref: Ref, _args: Record<string, unknown>) => ({ sent: true }));
  const runMutation = vi.fn(async (_ref: Ref, _args: Record<string, unknown>) => undefined);
  return { locked, grace, drafts, alreadySent, runQuery, runAction, runMutation, ctx: { runQuery, runAction, runMutation } };
}
function call(fn: unknown, ctx: unknown) {
  return (fn as { _handler: (ctx: unknown, args: Record<string, never>) => Promise<unknown> })._handler(ctx, {});
}
describe("reminder cron batches", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.spyOn(console, "error").mockImplementation(() => undefined); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  it("sends both due offsets to each participant and continues after one delivery fails", async () => {
    const f = fixture();
    f.locked.push(goal("shared"), goal("solo", { mode: "solo", partnerId: undefined, partnerLocked: undefined }));
    f.runAction.mockRejectedValueOnce(new Error("first recipient failed"));
    await expect(call(sendWeeklyGoalReminders, f.ctx)).resolves.toBeUndefined();
    expect(f.runAction.mock.calls.map(([, args]) => args)).toEqual([
      ...[creator, partner].flatMap(toUserId => ["weekly_goal_reminder_1", "weekly_goal_reminder_2"].map(trigger => ({ trigger, toUserId, weeklyGoalId: "shared", reminderOffsetMinutes: 60 }))),
      ...["weekly_goal_reminder_1", "weekly_goal_reminder_2"].map(trigger => ({ trigger, toUserId: creator, weeklyGoalId: "solo", reminderOffsetMinutes: 60 })),
    ]);
    expect(console.error).toHaveBeenCalledOnce();
  });
  it("does not schedule fixed reminders outside the offset window", async () => {
    const f = fixture();
    f.locked.push(goal("future", { endDate: now + 24 * 60 * 60_000 }));
    await call(sendWeeklyGoalReminders, f.ctx);
    expect(f.runAction).not.toHaveBeenCalled();
  });
  it("returns before querying outside the local daily reminder hour", async () => {
    vi.setSystemTime(Date.parse("2026-09-25T09:00:00Z"));
    const f = fixture();
    await call(sendDailyWeeklyGoalReminderEmails, f.ctx);
    expect(f.runQuery).not.toHaveBeenCalled();
    expect(f.runAction).not.toHaveBeenCalled();
  });
  it("uses the same local-date key for daily and grace reminders while isolating failures", async () => {
    const f = fixture();
    f.locked.push(goal("active"));
    f.grace.push(goal("grace", { mode: "solo", partnerId: undefined, partnerLocked: undefined, status: "grace_period" }));
    f.runAction.mockRejectedValueOnce(new Error("recipient failed"));
    await expect(call(sendDailyWeeklyGoalReminderEmails, f.ctx)).resolves.toBeUndefined();
    expect(f.runAction.mock.calls.map(([, args]) => args)).toEqual([
      { trigger: "weekly_goal_daily_reminder", toUserId: creator, weeklyGoalId: "active", dedupeKey: "2026-09-25" },
      { trigger: "weekly_goal_daily_reminder", toUserId: partner, weeklyGoalId: "active", dedupeKey: "2026-09-25" },
      { trigger: "weekly_goal_grace_period_reminder", toUserId: creator, weeklyGoalId: "grace", dedupeKey: "2026-09-25" },
    ]);
    expect(console.error).toHaveBeenCalledOnce();
  });
  it("skips already-sent drafts and creates in-app notifications before attempted email delivery", async () => {
    const f = fixture();
    f.drafts.push(goal("sent", { status: "draft" }), goal("failed", { status: "draft" }), goal("later", { status: "draft" }));
    f.alreadySent.add("sent");
    f.runAction.mockRejectedValueOnce(new Error("delivery failed"));
    await expect(call(sendDraftExpiryReminders, f.ctx)).resolves.toBeUndefined();
    expect(f.runMutation.mock.calls.map(([, args]) => args)).toEqual([{ goalId: "failed", now }, { goalId: "later", now }]);
    expect(f.runAction.mock.calls.map(([, args]) => args)).toEqual([
      { trigger: "weekly_goal_draft_expiring", toUserId: creator, weeklyGoalId: "failed" },
      { trigger: "weekly_goal_draft_expiring", toUserId: creator, weeklyGoalId: "later" },
    ]);
    expect(f.runMutation.mock.invocationCallOrder[0]).toBeLessThan(f.runAction.mock.invocationCallOrder[0]);
    expect(console.error).toHaveBeenCalledOnce();
  });
  it.each([sendWeeklyGoalReminders, sendDailyWeeklyGoalReminderEmails, sendDraftExpiryReminders])("does no delivery or notification writes for empty batches", async fn => {
    const f = fixture();
    await call(fn, f.ctx);
    expect(f.runAction).not.toHaveBeenCalled();
    expect(f.runMutation).not.toHaveBeenCalled();
  });
});
