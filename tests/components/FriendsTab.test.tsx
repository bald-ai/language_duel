import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { FriendsTab } from "@/app/notifications/components/FriendsTab";
const state = vi.hoisted(() => ({ rows: {} as Record<string, unknown>, remove: vi.fn(), success: vi.fn(), error: vi.fn(), challenge: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: (ref: Parameters<typeof getFunctionName>[0]) => state.rows[getFunctionName(ref)], useMutation: () => state.remove }));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
vi.mock("@/app/notifications/components/AddFriendSection", () => ({ AddFriendSection: () => <div>Add friend search</div> }));
vi.mock("@/app/notifications/components/FriendDuelLauncher", () => ({ FriendDuelLauncher: ({ children }: { children: (open: (id: string) => void) => React.ReactNode }) => children(state.challenge) }));
const friend = { friendshipId: "friendship", friendId: "friend", name: "Alice Example", createdAt: 1, isOnline: true };
beforeEach(() => { vi.resetAllMocks(); state.rows = { "friends:getFriends": [friend], "weeklyGoals:getVisibleGoals": [], "friends:getSentRequests": [] }; state.remove.mockResolvedValue({ closedGoalCount: 0 }); });
const mount = () => render(<FriendsTab onClose={vi.fn()} />);
async function removeFriend() {
  fireEvent.click(screen.getByTestId("notifications-friend-friend-menu"));
  fireEvent.click(screen.getByTestId("notifications-friend-friend-remove"));
  await act(async () => fireEvent.click(screen.getByTestId("notifications-friend-friend-remove-confirm")));
}
describe("friends tab data and actions", () => {
  it.each(["friends:getFriends", "weeklyGoals:getVisibleGoals"])("waits for %s before rendering rows", query => {
    state.rows[query] = undefined; mount();
    expect(screen.getByText("Add friend search")).toBeInTheDocument();
    expect(screen.queryByTestId("notifications-friend-friend")).not.toBeInTheDocument();
    expect(screen.queryByText("No friends yet")).not.toBeInTheDocument();
  });
  it("displays a loaded empty list and omits pending requests before they load", () => {
    state.rows["friends:getFriends"] = []; state.rows["friends:getSentRequests"] = undefined; mount();
    expect(screen.getByText("Friends (0)")).toBeInTheDocument();
    expect(screen.getByText("No friends yet")).toBeInTheDocument();
    expect(screen.queryByText(/Pending Requests/)).not.toBeInTheDocument();
  });
  it("shows friends and pending outgoing requests and opens the selected friend challenge", () => {
    state.rows["friends:getSentRequests"] = [{ requestId: "request", receiverId: "peer", name: "Bob Example" }]; mount();
    expect(screen.getByText("Friends (1)")).toBeInTheDocument(); expect(screen.getByText("Pending Requests (1)")).toBeInTheDocument();
    expect(screen.getByText("Bob Example")).toBeInTheDocument(); expect(screen.getByText("BE")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Start Duel")); expect(state.challenge).toHaveBeenCalledExactlyOnceWith("friend");
  });
  it.each(["creator", "partner"])("warns about a goal when the friend is its %s", role => {
    state.rows["weeklyGoals:getVisibleGoals"] = [{ creator: null, partner: null }, { creator: { _id: "other" }, partner: null, [role]: { _id: "friend" } }]; mount();
    fireEvent.click(screen.getByTestId("notifications-friend-friend-menu")); fireEvent.click(screen.getByTestId("notifications-friend-friend-remove"));
    expect(screen.getByText(/also close that shared goal/)).toBeInTheDocument();
  });
  it.each([0, 1])("removes a friend and reports %s closed goals", async closedGoalCount => {
    state.remove.mockResolvedValue({ closedGoalCount }); mount(); await removeFriend();
    expect(state.remove).toHaveBeenCalledExactlyOnceWith({ friendId: "friend", alsoCleanupSharedWeeklyGoals: true });
    expect(state.success).toHaveBeenCalledWith(closedGoalCount ? "Friend removed and shared goal closed" : "Friend removed");
  });
  it("reports a failed removal without a success message", async () => {
    const error = new Error("Removal failed"); state.remove.mockRejectedValue(error);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      mount(); await removeFriend();
      expect(state.error).toHaveBeenCalledWith("Failed to remove friend"); expect(state.success).not.toHaveBeenCalled(); expect(logged).toHaveBeenCalledWith(error);
    } finally { logged.mockRestore(); }
  });
});
