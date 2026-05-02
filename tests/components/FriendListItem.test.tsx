import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FriendListItem } from "@/app/notifications/components/FriendListItem";
import type { Id } from "@/convex/_generated/dataModel";

const friend = {
  friendshipId: "friendship_1" as Id<"friends">,
  friendId: "user_2" as Id<"users">,
  nickname: "Alex",
  discriminator: 1234,
  name: "Alex",
  email: "alex@example.com",
  createdAt: Date.now(),
  isOnline: false,
  lastSeenAt: Date.now(),
} as const;

describe("FriendListItem", () => {
  it("shows confirmation dialog when clicking remove, then removes friend on confirm", async () => {
    const user = userEvent.setup();
    const onRemoveFriend = vi.fn();

    render(
      <FriendListItem
        friend={friend}
        hasExistingGoal={false}
        onQuickDuel={vi.fn()}
        onScheduleDuel={vi.fn()}
        onRemoveFriend={onRemoveFriend}
      />
    );

    await user.click(screen.getByTestId("notifications-friend-user_2-menu"));
    await user.click(await screen.findByTestId("notifications-friend-user_2-remove"));

    const confirmButton = await screen.findByTestId(
      "notifications-friend-user_2-remove-confirm"
    );
    expect(confirmButton).toBeInTheDocument();

    await user.click(confirmButton);
    expect(onRemoveFriend).toHaveBeenCalledTimes(1);
  });

  it("warns that the weekly plan will be closed", async () => {
    const user = userEvent.setup();

    render(
      <FriendListItem
        friend={friend}
        hasExistingGoal={true}
        onQuickDuel={vi.fn()}
        onScheduleDuel={vi.fn()}
        onRemoveFriend={vi.fn()}
      />
    );

    await user.click(screen.getByTestId("notifications-friend-user_2-menu"));
    await user.click(await screen.findByTestId("notifications-friend-user_2-remove"));

    expect(
      await screen.findByText(
        "You also have a weekly plan together. Removing this friend will close it."
      )
    ).toBeInTheDocument();
  });
});
