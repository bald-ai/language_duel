import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { FriendFilterModal } from "@/app/themes/components/FriendFilterModal";

it("opens the filter choices, reports friend identity and supports an empty friend list", () => {
  const props = {
    isOpen: false,
    friends: [{ friendshipId: "friendship" as Id<"friends">, friendId: "friend" as Id<"users">, nickname: "Bee", discriminator: 4321, createdAt: 1, isOnline: true }],
    onSelectFriend: vi.fn(), onShowAll: vi.fn(), onShowMyThemes: vi.fn(), onClose: vi.fn(),
  };
  const view = render(<FriendFilterModal {...props} />);
  expect(screen.queryByTestId("theme-friend-filter-modal")).toBeNull();
  view.rerender(<FriendFilterModal {...props} isOpen />);
  expect(screen.queryByText("Bee#4321")).not.toBeNull();
  fireEvent.click(screen.getByTestId("theme-filter-friend-friend"));
  expect(props.onSelectFriend).toHaveBeenCalledExactlyOnceWith("friend");
  fireEvent.click(screen.getByTestId("theme-filter-all"));
  fireEvent.click(screen.getByTestId("theme-filter-mine"));
  fireEvent.click(screen.getByTestId("theme-friend-filter-close"));
  expect(props.onShowAll).toHaveBeenCalledOnce();
  expect(props.onShowMyThemes).toHaveBeenCalledOnce();
  expect(props.onClose).toHaveBeenCalledOnce();
  view.rerender(<FriendFilterModal {...props} isOpen friends={[]} />);
  expect(screen.queryByText("No friends yet")).not.toBeNull();
  expect(screen.queryByTestId("theme-filter-friend-friend")).toBeNull();
});
