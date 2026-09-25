import { describe, expect, it, vi } from "vitest";
import { sendNotificationEmail } from "@/convex/emails/notificationEmails";
import type { NotificationEmailTrigger } from "@/lib/notificationPreferences";

const handler = (sendNotificationEmail as unknown as { _handler: (ctx: unknown, args: { trigger: NotificationEmailTrigger; toUserId: string; weeklyGoalId?: string; challengeId?: string; dedupeKey?: string; reminderOffsetMinutes?: number }) => Promise<unknown> })._handler;
describe("notification context validation before provider access", () => {
  it.each([
    ["immediate_challenge_invite", {}, "Challenge email requires challengeId"],
    ["weekly_goal_invite", {}, "Weekly-goal email requires weeklyGoalId"],
    ["weekly_goal_daily_reminder", { weeklyGoalId: "goal" }, "Daily reminder email requires dedupeKey"],
    ["weekly_goal_grace_period_reminder", { weeklyGoalId: "goal" }, "Daily reminder email requires dedupeKey"],
    ["weekly_goal_reminder_1", { weeklyGoalId: "goal" }, "Fixed reminder email requires reminderOffsetMinutes"],
    ["weekly_goal_reminder_2", { weeklyGoalId: "goal" }, "Fixed reminder email requires reminderOffsetMinutes"],
  ] as const)("rejects missing required context for %s", async (trigger, extra, message) => {
    const runQuery = vi.fn();
    await expect(handler({ runQuery }, { trigger, toUserId: "user", ...extra })).rejects.toThrow(message);
    expect(runQuery).not.toHaveBeenCalled();
  });
  it.each([
    ["immediate_challenge_invite", { challengeId: "challenge" }],
    ["weekly_goal_daily_reminder", { weeklyGoalId: "goal", dedupeKey: "day" }],
    ["weekly_goal_grace_period_reminder", { weeklyGoalId: "goal", dedupeKey: "day" }],
    ["weekly_goal_reminder_1", { weeklyGoalId: "goal", reminderOffsetMinutes: 0 }],
    ["weekly_goal_reminder_2", { weeklyGoalId: "goal", reminderOffsetMinutes: 60 }],
  ] as const)("accepts valid context for %s then respects missing recipients", async (trigger, extra) => {
    const runQuery = vi.fn().mockResolvedValue(null);
    expect(await handler({ runQuery }, { trigger, toUserId: "user", ...extra })).toEqual({ sent: false, reason: "no_email" });
    expect(runQuery).toHaveBeenCalledOnce();
  });
});
