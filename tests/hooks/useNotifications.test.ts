import { renderHook } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { useNotifications } from "@/app/notifications/hooks/useNotifications";
const state = vi.hoisted(() => ({ queries: new Map<string, unknown>(), mutations: new Map<string, ReturnType<typeof vi.fn>>() }));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) => state.queries.get(getFunctionName(ref)),
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (!state.mutations.has(name)) state.mutations.set(name, vi.fn().mockResolvedValue(undefined));
    return state.mutations.get(name);
  },
}));
beforeEach(() => { state.queries.clear(); state.mutations.clear(); });
afterEach(() => vi.restoreAllMocks());
describe("notification data and endpoint actions", () => {
  it("reports loading then exposes the fetched list and unread count", () => {
    const hook = renderHook(useNotifications);
    expect(hook.result.current).toMatchObject({ notifications: [], notificationCount: 0, isLoading: true });
    const notification = { _id: "notice_1", type: "friend_request", status: "pending", payload: {}, createdAt: 1 };
    state.queries.set("notifications:getNotifications", [notification]);
    state.queries.set("notifications:getNotificationCount", 3); hook.rerender();
    expect(hook.result.current).toMatchObject({ notifications: [notification], notificationCount: 3, isLoading: false });
    state.queries.set("notifications:getNotifications", []); state.queries.set("notifications:getNotificationCount", 0); hook.rerender();
    expect(hook.result.current).toMatchObject({ notifications: [], notificationCount: 0, isLoading: false });
  });
  it.each([
    ["dismissNotification", "notifications:dismissNotification", undefined, undefined],
    ["markAsRead", "notifications:markNotificationRead", undefined, undefined],
    ["acceptFriendRequest", "friends:acceptFriendRequestNotification", undefined, { success: true }],
    ["rejectFriendRequest", "friends:rejectFriendRequestNotification", undefined, { success: true }],
    ["acceptChallenge", "challenges:acceptChallengeFromNotification", { duelId: "duel_1" }, { duelId: "duel_1" }],
    ["declineChallenge", "challenges:declineChallengeFromNotification", undefined, { success: true }],
    ["dismissWeeklyGoalInvitation", "weeklyGoals:dismissWeeklyGoalInvitation", undefined, { success: true }],
    ["declineWeeklyGoalInvitation", "weeklyGoals:declineWeeklyGoalInvitation", undefined, { success: true }],
    ["archiveCompletedGoalThemes", "weeklyGoals:archiveCompletedGoalThemesFromNotification", { archivedCount: 2 }, { archivedCount: 2 }],
  ] as const)("routes %s with the notification identity, returns its result and propagates failures", async (actionName, endpoint, response, expected) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const hook = renderHook(useNotifications);
    const call = state.mutations.get(endpoint)!;
    call.mockResolvedValue(response);
    const id = "notification_123" as Id<"notifications">;
    await expect(hook.result.current.actions[actionName](id)).resolves.toEqual(expected);
    expect(call).toHaveBeenCalledExactlyOnceWith({ notificationId: id });
    const error = new Error("Notification no longer available"); call.mockRejectedValue(error);
    await expect(hook.result.current.actions[actionName](id)).rejects.toBe(error);
    expect(call).toHaveBeenCalledTimes(2);
  });
});
