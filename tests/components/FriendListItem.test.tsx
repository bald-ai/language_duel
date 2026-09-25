import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FriendListItem } from "@/app/notifications/components/FriendListItem";
import type { FriendWithDetails } from "@/convex/friends";
import type { Id } from "@/convex/_generated/dataModel";
const friend: FriendWithDetails = { friendId: "friend" as Id<"users">, friendshipId: "friendship" as Id<"friends">, name: "Alice Example", nickname: "Al", discriminator: 12, createdAt: 1, isOnline: true };
function mount(overrides: Partial<FriendWithDetails> = {}, hasExistingGoal = false) {
  const onQuickDuel = vi.fn(), onRemoveFriend = vi.fn();
  const view = render(<FriendListItem friend={{ ...friend, ...overrides }} hasExistingGoal={hasExistingGoal} onQuickDuel={onQuickDuel} onRemoveFriend={onRemoveFriend} />);
  return { ...view, onQuickDuel, onRemoveFriend };
}
const menu = () => screen.getByTestId("notifications-friend-friend-menu");
const remove = () => screen.getByTestId("notifications-friend-friend-remove");
describe("friend row actions", () => {
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  it("shows a handle and starts a duel only for an online friend", () => {
    const f = mount();
    expect(screen.getByText("Al#0012")).toBeInTheDocument();
    expect(screen.getByText("Online")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Start Duel"));
    expect(f.onQuickDuel).toHaveBeenCalledOnce();
    f.unmount();
    mount({ isOnline: false, nickname: undefined, discriminator: undefined });
    expect(screen.getByText("Alice Example")).toBeInTheDocument();
    expect(screen.getByText("AE")).toBeInTheDocument();
    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.queryByTitle("Start Duel")).not.toBeInTheDocument();
  });
  it("renders an available profile image", () => {
    const f = mount({ imageUrl: "/avatar.png" });
    expect(f.container.querySelector("img")).toHaveAttribute("alt", "");
  });
  it("positions a portal menu from its button and closes on outside clicks", () => {
    const f = mount();
    vi.spyOn(menu(), "getBoundingClientRect").mockReturnValue({ left: 25, bottom: 30 } as DOMRect);
    fireEvent.click(menu());
    const portal = remove().parentElement!;
    expect(portal).toHaveStyle({ left: "25px", top: "34px" });
    expect(f.container).not.toContainElement(portal);
    fireEvent.click(portal);
    expect(remove()).toBeInTheDocument();
    fireEvent.click(menu());
    expect(remove()).toBeInTheDocument();
    fireEvent.click(document.body);
    expect(screen.queryByText("Remove Friend")).not.toBeInTheDocument();
  });
  it("clamps the context menu inside the right edge", () => {
    mount();
    fireEvent.contextMenu(screen.getByTestId("notifications-friend-friend"), { clientX: window.innerWidth, clientY: 120 });
    expect(remove().parentElement).toHaveStyle({ left: `${window.innerWidth - 180}px`, top: "120px" });
  });
  it("requires confirmation and warns about a shared goal", () => {
    const f = mount({}, true);
    fireEvent.click(menu()); fireEvent.click(remove());
    expect(screen.getByText(/also close that shared goal/)).toBeInTheDocument();
    expect(f.onRemoveFriend).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Remove Friend?"));
    expect(screen.getByText("Remove Friend?")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("notifications-friend-friend-remove-confirm"));
    expect(f.onRemoveFriend).toHaveBeenCalledOnce();
    expect(screen.queryByText("Remove Friend?")).not.toBeInTheDocument();
  });
  it.each(["cancel", "outside"])("dismisses removal through %s without removing a friend", action => {
    const f = mount();
    fireEvent.click(menu()); fireEvent.click(remove());
    expect(screen.queryByText(/also close that shared goal/)).not.toBeInTheDocument();
    fireEvent.click(action === "cancel" ? screen.getByTestId("notifications-friend-friend-remove-cancel") : document.body);
    expect(screen.queryByText("Remove Friend?")).not.toBeInTheDocument();
    expect(f.onRemoveFriend).not.toHaveBeenCalled();
  });
  it("opens after a full long press and cancels a short press", () => {
    vi.useFakeTimers(); mount();
    const row = screen.getByTestId("notifications-friend-friend");
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({ left: 20, width: 80, bottom: 90 } as DOMRect);
    fireEvent.touchStart(row);
    act(() => vi.advanceTimersByTime(499));
    expect(screen.queryByText("Remove Friend")).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByTestId("notifications-friend-friend-remove")).not.toBeNull();
    expect(remove().parentElement).toHaveStyle({ left: "60px", top: "90px" });
    fireEvent.touchEnd(row); fireEvent.click(document.body);
    fireEvent.touchStart(row); fireEvent.touchCancel(row);
    act(() => vi.advanceTimersByTime(500));
    expect(screen.queryByText("Remove Friend")).not.toBeInTheDocument();
    fireEvent.touchEnd(row);
  });
  it("removes outside-click listeners when the row unmounts", () => {
    const stop = vi.spyOn(document, "removeEventListener");
    const f = mount(); fireEvent.click(menu()); f.unmount();
    expect(stop.mock.calls.some(([type]) => type === "click")).toBe(true);
    expect(screen.queryByText("Remove Friend")).not.toBeInTheDocument();
  });
});
