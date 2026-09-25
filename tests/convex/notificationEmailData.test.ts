import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEmailData, type BuildEmailArgs } from "@/convex/emails/notificationEmailData";
import type { Doc, Id } from "@/convex/_generated/dataModel";
const creatorId = "creator" as Id<"users">;
const partnerId = "partner" as Id<"users">;
const goalId = "goal" as Id<"weeklyGoals">;
const user: Doc<"users"> = { _id: creatorId, _creationTime: 1, clerkId: "creator", email: "creator@example.test", name: "Creator" };
const partner: Doc<"users"> = { ...user, _id: partnerId, name: "Partner" };
const hour = 3600000;
function goal(changes: Partial<Doc<"weeklyGoals">> = {}): Doc<"weeklyGoals"> {
  return { _id: goalId, _creationTime: 1, createdAt: 1, mode: "shared", creatorId, partnerId,
    creatorLocked: false, partnerLocked: false, status: "locked", miniBossStatus: "unavailable", bigBossStatus: "unavailable",
    endDate: 1000 + 10 * hour, themes: [
      { themeId: "a" as Id<"themes">, themeName: "A", creatorCompleted: true, partnerCompleted: false },
      { themeId: "b" as Id<"themes">, themeName: "B", creatorCompleted: true, partnerCompleted: true },
    ], ...changes };
}
function ctx(rows: Record<string, unknown>) {
  return { runQuery: vi.fn(async (_query: unknown, { id }: { id: string }) => rows[id] ?? null) };
}
const args = (changes: Partial<BuildEmailArgs> = {}): BuildEmailArgs => ({ trigger: "weekly_goal_daily_reminder", toUser: user, ...changes });
beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(1000));
afterEach(() => vi.restoreAllMocks());
describe("notification email data", () => {
  it("builds recipient-only data without querying", async () => {
    const context = ctx({});
    expect(await buildEmailData(context as never, args())).toEqual({ recipientName: "Creator" });
    expect(context.runQuery).not.toHaveBeenCalled();
  });
  it("uses sender identity and tolerates a deleted sender", async () => {
    const present = await buildEmailData(ctx({ partner }) as never, args({ fromUserId: partnerId }));
    expect(present).toMatchObject({ senderName: "Partner", partnerName: "Partner", senderPalette: { bg: expect.any(String), primary: expect.any(String), accent: expect.any(String) } });
    expect(await buildEmailData(ctx({}) as never, args({ fromUserId: partnerId }))).toMatchObject({ senderName: "Player", partnerName: "Player" });
  });
  it("uses a default palette for an unavailable saved palette", async () => {
    const result = await buildEmailData(ctx({ partner: { ...partner, selectedColorSet: "unavailable" } }) as never, args({ fromUserId: partnerId }));
    expect(result.senderPalette).toEqual({ bg: "#FFF8F1", primary: "#FB7185", accent: "#22C55E" });
  });
  it("summarizes challenge themes and ignores deleted theme documents", async () => {
    const context = ctx({ challenge: { themeIds: ["a", "b", "deleted"] }, a: { name: "Animals" }, b: { name: "Food" } });
    const result = await buildEmailData(context as never, args({ challengeId: "challenge" as Id<"challenges"> }));
    expect(result.themeName).toBe("2 themes");
    expect(context.runQuery).toHaveBeenCalledTimes(4);
  });
  it.each([{}, { challenge: { themeIds: [] } }, { challenge: { themeIds: ["deleted"] } }])("omits absent challenge content", async rows => {
    expect(await buildEmailData(ctx(rows) as never, args({ challengeId: "challenge" as Id<"challenges"> }))).toEqual({ recipientName: "Creator" });
  });
  it.each([[user, 2, "Partner"], [partner, 1, "Creator"]] as const)("counts the recipient's own completed themes", async (toUser, completedCount, partnerName) => {
    const result = await buildEmailData(ctx({ goal: goal(), creator: user, partner }) as never, args({ toUser, weeklyGoalId: goalId }));
    expect(result).toMatchObject({ mode: "shared", completedCount, totalCount: 2, partnerName, hoursLeft: 10 });
    expect(result.scheduledTime).toEqual(expect.any(String));
  });
  it("does not fabricate deadline fields or a missing partner", async () => {
    const result = await buildEmailData(ctx({ goal: goal({ endDate: undefined }) }) as never, args({ weeklyGoalId: goalId }));
    expect(result.scheduledTime).toBeUndefined();
    expect(result.hoursLeft).toBeUndefined();
    expect(result.partnerName).toBeUndefined();
  });
  it("counts solo progress and calculates the remaining grace period", async () => {
    const result = await buildEmailData(ctx({ goal: goal({ mode: "solo", partnerId: undefined, endDate: 1000 - hour }) }) as never,
      args({ weeklyGoalId: goalId, trigger: "weekly_goal_grace_period_reminder" }));
    expect(result).toMatchObject({ mode: "solo", completedCount: 2, totalCount: 2, hoursLeft: 0, graceHoursLeft: 47 });
    expect(result.deleteAt).toEqual(expect.any(String));
    expect(result.partnerName).toBeUndefined();
  });
  it("clamps expired grace hours to zero", async () => {
    const result = await buildEmailData(ctx({ goal: goal({ endDate: 1000 - 49 * hour }) }) as never,
      args({ weeklyGoalId: goalId, trigger: "weekly_goal_grace_period_reminder" }));
    expect(result.graceHoursLeft).toBe(0);
  });
  it.each(["weekly_goal_invite", "weekly_goal_locked", "weekly_goal_accepted"] as const)("rejects shared-only trigger %s on solo goals", async trigger => {
    await expect(buildEmailData(ctx({ goal: goal({ mode: "solo", partnerId: undefined }) }) as never,
      args({ weeklyGoalId: goalId, trigger }))).rejects.toThrow("solo goal hit shared-only email trigger");
  });
  it.each(["weekly_goal_daily_reminder", "weekly_goal_reminder_1", "weekly_goal_reminder_2", "weekly_goal_grace_period_reminder"] as const)("rejects a sender on solo reminder %s", async trigger => {
    await expect(buildEmailData(ctx({ goal: goal({ mode: "solo", partnerId: undefined }), partner }) as never,
      args({ weeklyGoalId: goalId, fromUserId: partnerId, trigger }))).rejects.toThrow("cannot have fromUserId");
  });
  it("ignores a removed goal", async () => {
    expect(await buildEmailData(ctx({}) as never, args({ weeklyGoalId: goalId }))).toEqual({ recipientName: "Creator" });
  });
});
