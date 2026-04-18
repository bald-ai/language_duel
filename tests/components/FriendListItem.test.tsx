import { useEffect, useRef } from "react";
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

function NotificationPanelHarness({
  onPanelClose,
  onRemoveFriend,
  hasExistingGoal = false,
}: {
  onPanelClose: () => void;
  onRemoveFriend: () => void;
  hasExistingGoal?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-modal-shell="true"], [data-modal-portal="true"]')
      ) {
        return;
      }

      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onPanelClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onPanelClose]);

  return (
    <div ref={panelRef}>
      <FriendListItem
        friend={friend}
        hasExistingGoal={hasExistingGoal}
        onQuickDuel={vi.fn()}
        onScheduleDuel={vi.fn()}
        onRemoveFriend={onRemoveFriend}
      />
    </div>
  );
}

describe("FriendListItem", () => {
  it("keeps the parent panel open while confirming friend removal", async () => {
    const user = userEvent.setup();
    const onPanelClose = vi.fn();
    const onRemoveFriend = vi.fn();

    render(
      <NotificationPanelHarness
        onPanelClose={onPanelClose}
        onRemoveFriend={onRemoveFriend}
      />
    );

    await user.click(screen.getByTestId("notifications-friend-user_2-menu"));

    const removeButton = await screen.findByTestId("notifications-friend-user_2-remove");
    expect(removeButton.closest('[data-modal-portal="true"]')).not.toBeNull();

    await user.click(removeButton);

    const confirmButton = await screen.findByTestId(
      "notifications-friend-user_2-remove-confirm"
    );
    expect(confirmButton.closest('[data-modal-portal="true"]')).not.toBeNull();
    expect(onPanelClose).not.toHaveBeenCalled();

    await user.click(confirmButton);

    expect(onPanelClose).not.toHaveBeenCalled();
    expect(onRemoveFriend).toHaveBeenCalledTimes(1);
  });

  it("warns that the weekly plan will be closed", async () => {
    const user = userEvent.setup();

    render(
      <NotificationPanelHarness
        onPanelClose={vi.fn()}
        onRemoveFriend={vi.fn()}
        hasExistingGoal={true}
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
