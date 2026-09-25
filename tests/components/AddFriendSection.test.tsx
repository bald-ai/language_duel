import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AddFriendSection } from "@/app/notifications/components/AddFriendSection";
const mocks = vi.hoisted(() => ({ results: undefined as undefined | Array<{ _id: string; nickname: string; discriminator: number; imageUrl?: string; isFriend: boolean; isPending: boolean }>, query: vi.fn(), send: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: (_reference: unknown, args: unknown) => { mocks.query(args); return args === "skip" ? undefined : mocks.results; }, useMutation: () => mocks.send }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
beforeEach(() => { vi.clearAllMocks(); mocks.send.mockReset().mockResolvedValue(undefined); mocks.results = undefined; });
function search(term = "Al") { fireEvent.change(screen.getByTestId("notifications-friend-search"), { target: { value: term } }); }
describe("friend search and invitation", () => {
  it("waits for two characters, then distinguishes loading and empty search results", () => {
    const { rerender } = render(<AddFriendSection />); expect(mocks.query).toHaveBeenLastCalledWith("skip");
    search("A"); expect(mocks.query).toHaveBeenLastCalledWith("skip");
    search(); expect(mocks.query).toHaveBeenLastCalledWith({ searchTerm: "Al" }); expect(screen.queryByText("No users found")).toBeNull();
    mocks.results = []; rerender(<AddFriendSection />); expect(screen.getByText("No users found")).toBeInTheDocument();
    search(""); expect(screen.queryByText("No users found")).toBeNull();
  });
  it("shows existing friendships and pending requests while offering Add for another user", () => {
    mocks.results = [
      { _id: "friend", nickname: "Alice", discriminator: 1234, imageUrl: "/alice.png", isFriend: true, isPending: false },
      { _id: "pending", nickname: "Alan", discriminator: 1234, isFriend: false, isPending: true },
      { _id: "new", nickname: "Alba", discriminator: 1234, isFriend: false, isPending: false },
    ];
    render(<AddFriendSection />); search();
    expect(screen.getByText("Friends")).toBeInTheDocument(); expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByTestId("notifications-friend-add-friend")).toBeNull(); expect(screen.queryByTestId("notifications-friend-add-pending")).toBeNull();
    expect(screen.getByTestId("notifications-friend-add-new")).toBeEnabled();
    expect(screen.getByText("Alice#1234")).toBeInTheDocument(); expect(screen.getByRole("presentation")).toHaveAttribute("alt", "");
  });
  it("sends the selected user's id and clears the search after success", async () => {
    mocks.results = [{ _id: "alba", nickname: "Alba", discriminator: 1234, isFriend: false, isPending: false }];
    render(<AddFriendSection />); search(); fireEvent.click(screen.getByTestId("notifications-friend-add-alba"));
    await waitFor(() => expect((screen.getByTestId("notifications-friend-search") as HTMLInputElement).value).toBe(""));
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith({ receiverId: "alba" }); expect(mocks.success).toHaveBeenCalledWith("Friend request sent!");
  });
  it("retains the search and offers retry after a request fails", async () => {
    mocks.results = [{ _id: "alba", nickname: "Alba", discriminator: 1234, isFriend: false, isPending: false }]; mocks.send.mockRejectedValueOnce(new Error("Invite failed"));
    render(<AddFriendSection />); search(); fireEvent.click(screen.getByTestId("notifications-friend-add-alba"));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Invite failed"));
    expect((screen.getByTestId("notifications-friend-search") as HTMLInputElement).value).toBe("Al"); expect(mocks.success).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("notifications-friend-add-alba")); await waitFor(() => expect(mocks.success).toHaveBeenCalledOnce());
  });
});
