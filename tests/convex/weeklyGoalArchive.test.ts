import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { MutationCtx } from "@/convex/_generated/server";
import { handleArchiveCompletedGoalThemesFromNotification as archive, handleDismissWeeklyGoalInvitation as dismiss } from "@/convex/weeklyGoals/invitationMutations";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";

const userId = "user" as Id<"users">;
const notificationId = "notice" as Id<"notifications">;
const goalId = "goal" as Id<"weeklyGoals">;
const themeId = (id: string) => id as Id<"themes">;
function fixture(options: { archived?: Id<"themes">[]; mode?: "solo" | "shared"; status?: Doc<"weeklyGoals">["status"]; event?: string; missingGoal?: boolean; notice?: Partial<Doc<"notifications">> } = {}) {
  const user = { _id: userId, clerkId: "clerk", archivedThemeIds: options.archived };
  const notice = { _id: notificationId, toUserId: userId, type: "weekly_goal_invitation", status: "pending",
    payload: { goalId, event: options.event ?? "goal_completed", themeCount: 3 }, ...options.notice };
  const goal = { _id: goalId, mode: options.mode ?? "shared", status: options.status ?? "completed",
    themes: ["a", "b", "a", "c", "b"].map(id => ({ themeId: themeId(id) })) };
  const db = {
    query: () => createIndexedQuery([user]),
    get: async (id: string) => id === notificationId ? notice : id === goalId && !options.missingGoal ? goal : null,
    patch: vi.fn(async (id: string, patch: object) => Object.assign(id === userId ? user : notice, patch)),
  };
  return { user, notice, goal, db, ctx: createAuthCtx(db, "clerk") as unknown as MutationCtx };
}

describe("archive themes from completed goal notifications", () => {
  it.each(["shared", "solo"] as const)("archives distinct %s goal themes in order and dismisses notification", async (mode) => {
    const f = fixture({ mode, event: mode === "solo" ? "goal_completed_solo" : "goal_completed", archived: [themeId("older"), themeId("b")] });
    expect(await archive(f.ctx, notificationId)).toEqual({ archivedCount: 2 });
    expect(f.user.archivedThemeIds).toEqual(["older", "b", "a", "c"]);
    expect(f.notice.status).toBe("dismissed");
    expect(f.db.patch).toHaveBeenCalledTimes(2);
    expect(await archive(f.ctx, notificationId)).toEqual({ archivedCount: 0 });
    expect(f.db.patch).toHaveBeenCalledTimes(3);
  });
  it("initializes optional archives and counts only new entries", async () => {
    const f = fixture();
    expect(await archive(f.ctx, notificationId)).toEqual({ archivedCount: 3 });
    expect(f.user.archivedThemeIds).toEqual(["a", "b", "c"]);
  });
  it("dismisses a notification for a deleted goal without editing the user", async () => {
    const f = fixture({ missingGoal: true });
    expect(await archive(f.ctx, notificationId)).toEqual({ archivedCount: 0 });
    expect(f.db.patch.mock.calls).toEqual([[notificationId, { status: "dismissed" }]]);
  });
  it.each([
    [{ event: "invite" }, "Invalid completed goal notification"],
    [{ mode: "solo", event: "goal_completed" }, "Invalid solo completed goal notification"],
    [{ mode: "shared", event: "goal_completed_solo" }, "Invalid shared completed goal notification"],
    [{ status: "locked" }, "Weekly goal is not completed"],
    [{ notice: { toUserId: "other" } }, "Not authorized"],
    [{ notice: { type: "friend_request" } }, "Invalid notification type"],
    [{ notice: { payload: undefined } }, "Weekly goal data is missing"],
  ] as const)("rejects invalid notification %j before writing", async (options, message) => {
    const f = fixture(options as Parameters<typeof fixture>[0]);
    await expect(archive(f.ctx, notificationId)).rejects.toThrow(message);
    expect(f.db.patch).not.toHaveBeenCalled();
    expect(f.notice.status).toBe("pending");
  });
  it("requires authentication", async () => {
    const f = fixture();
    await expect(archive(createAuthCtx(f.db, null) as unknown as MutationCtx, notificationId)).rejects.toThrow("Unauthorized");
    expect(f.db.patch).not.toHaveBeenCalled();
  });
  it("requires the notification to exist", async () => {
    const f = fixture();
    await expect(archive(f.ctx, "missing" as Id<"notifications">)).rejects.toThrow("Notification not found");
    expect(f.db.patch).not.toHaveBeenCalled();
  });
  it("dismisses a caller-owned invitation without archiving", async () => {
    const f = fixture({ event: "invite" });
    expect(await dismiss(f.ctx, notificationId)).toEqual({ success: true });
    expect(f.db.patch.mock.calls).toEqual([[notificationId, { status: "dismissed" }]]);
  });
});
