import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { cleanupDismissedNotifications } from "@/convex/notifications";
import { DISMISSED_NOTIFICATION_TTL_MS } from "@/convex/constants";
import { createIndexedQuery } from "./testUtils/inMemoryDb";
const cleanup = (cleanupDismissedNotifications as unknown as { _handler: (ctx: unknown, args: object) => Promise<{ deletedCount: number }> })._handler;
const now = 2_000_000_000_000;
function notification(id: string, createdAt: number, status: Doc<"notifications">["status"] = "dismissed"): Doc<"notifications"> {
  return { _id: id as Id<"notifications">, _creationTime: createdAt, type: "friend_request", fromUserId: "from" as Id<"users">, toUserId: "to" as Id<"users">, status, createdAt, payload: { friendRequestId: "request" as Id<"friendRequests"> } };
}
afterEach(() => vi.restoreAllMocks());
describe("dismissed notification cleanup", () => {
  it("deletes only dismissed records strictly older than the indexed retention cutoff", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const cutoff = now - DISMISSED_NOTIFICATION_TTL_MS;
    const rows = [notification("old", cutoff - 1), notification("boundary", cutoff), notification("recent", cutoff + 1), notification("pending", cutoff - 1, "pending"), notification("read", cutoff - 1, "read")];
    const remove = vi.fn(async (id: string) => { const index = rows.findIndex(row => row._id === id); rows.splice(index, 1); });
    const ctx = { db: { query: () => createIndexedQuery(rows), delete: remove } };
    await expect(cleanup(ctx, {})).resolves.toEqual({ deletedCount: 1 });
    expect(remove).toHaveBeenCalledExactlyOnceWith("old"); expect(rows.map(row => row._id)).toEqual(["boundary", "recent", "pending", "read"]);
    await expect(cleanup(ctx, {})).resolves.toEqual({ deletedCount: 0 });
    expect(remove).toHaveBeenCalledOnce();
  });
  it("collects each dismissible notification type", async () => {
    vi.spyOn(Date, "now").mockReturnValue(now);
    const rows: Doc<"notifications">[] = [
      notification("friend", 1),
      { ...notification("goal", 1), type: "weekly_goal_invitation", payload: { goalId: "goal" as Id<"weeklyGoals">, themeCount: 1, event: "goal_completed" } },
      { ...notification("expiry", 1), type: "weekly_goal_draft_expiring", payload: { goalId: "goal" as Id<"weeklyGoals">, themeCount: 1 } },
      { ...notification("challenge", 1), type: "challenge_invite", payload: { challengeId: "challenge" as Id<"challenges">, themeName: "Animals", duelMode: "pvp" } },
    ];
    const remove = vi.fn();
    await expect(cleanup({ db: { query: () => createIndexedQuery(rows), delete: remove } }, {})).resolves.toEqual({ deletedCount: 4 });
    expect(remove.mock.calls.map(([id]) => id).sort()).toEqual(["challenge", "expiry", "friend", "goal"]);
  });
});
