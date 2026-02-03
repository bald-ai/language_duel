import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NotificationsTab } from "@/app/notifications/components/NotificationsTab";
import { NOTIFICATION_TYPES } from "@/app/notifications/constants";

const pushMock = vi.fn();
const useNotificationsMock = vi.fn();
const useScheduledDuelMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/app/notifications/hooks/useNotifications", () => ({
  useNotifications: () => useNotificationsMock(),
}));

vi.mock("@/app/notifications/hooks/useScheduledDuel", () => ({
  useScheduledDuel: () => useScheduledDuelMock(),
}));

const notification = {
  _id: "notif_1",
  type: NOTIFICATION_TYPES.SCHEDULED_DUEL,
  fromUser: { nickname: "Alex" },
  payload: {
    scheduledDuelId: "sched_1",
    themeId: "theme_1",
    themeName: "Test Theme",
    scheduledTime: Date.now() + 60_000,
  },
  createdAt: Date.now(),
  status: "unread",
};

describe("NotificationsTab theme actions", () => {
  beforeEach(() => {
    pushMock.mockClear();
    useNotificationsMock.mockReturnValue({
      notifications: [notification],
      notificationCount: 1,
      isLoading: false,
      actions: {
        dismissNotification: vi.fn(),
        markAsRead: vi.fn(),
        acceptFriendRequest: vi.fn(),
        rejectFriendRequest: vi.fn(),
        acceptDuelChallenge: vi.fn(),
        declineDuelChallenge: vi.fn(),
        dismissWeeklyPlanInvitation: vi.fn(),
        acceptScheduledDuel: vi.fn(),
        counterProposeScheduledDuel: vi.fn(),
        declineScheduledDuel: vi.fn(),
      },
    });
    useScheduledDuelMock.mockReturnValue({
      setReady: vi.fn(),
      cancelReady: vi.fn(),
      cancelScheduledDuel: vi.fn(),
      scheduledDuels: [],
    });
  });

  it("navigates to study when selecting Solo Study", () => {
    const onClose = vi.fn();

    render(<NotificationsTab onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Test Theme" }));
    fireEvent.click(screen.getByRole("button", { name: "Solo Study" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith("/study?themeId=theme_1");
  });

  it("navigates to solo challenge when selecting Solo Challenge", () => {
    const onClose = vi.fn();

    render(<NotificationsTab onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Test Theme" }));
    fireEvent.click(screen.getByRole("button", { name: "Solo Challenge" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(
      "/?openSolo=true&themeId=theme_1&soloMode=challenge_only"
    );
  });
});