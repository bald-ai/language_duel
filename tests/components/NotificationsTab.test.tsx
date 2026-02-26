import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationsTab } from "@/app/notifications/components/NotificationsTab";
import { NOTIFICATION_TYPES } from "@/app/notifications/constants";

const pushMock = vi.fn();
const useNotificationsMock = vi.fn();
const useScheduledDuelMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();
const toastInfoMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
    info: (...args: unknown[]) => toastInfoMock(...args),
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
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    toastInfoMock.mockClear();
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

  it("renders loading state while notifications are being fetched", () => {
    useNotificationsMock.mockReturnValue({
      notifications: [],
      notificationCount: 0,
      isLoading: true,
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

    const { container } = render(<NotificationsTab onClose={vi.fn()} />);

    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });

  it("renders empty state when there are no notifications", () => {
    useNotificationsMock.mockReturnValue({
      notifications: [],
      notificationCount: 0,
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

    render(<NotificationsTab onClose={vi.fn()} />);

    expect(screen.getByTestId("notifications-empty-state")).toBeInTheDocument();
  });

  it("shows both ready-state success messages", async () => {
    const setReadyMock = vi
      .fn()
      .mockResolvedValueOnce({ bothReady: true })
      .mockResolvedValueOnce({ bothReady: false });

    useNotificationsMock.mockReturnValue({
      notifications: [
        {
          ...notification,
          payload: {
            ...notification.payload,
            scheduledDuelStatus: "accepted",
          },
        },
      ],
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
      setReady: setReadyMock,
      cancelReady: vi.fn(),
      cancelScheduledDuel: vi.fn(),
      scheduledDuels: [
        {
          _id: "sched_1",
          isProposer: true,
          proposerReady: false,
          recipientReady: false,
        },
      ],
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    fireEvent.click(await screen.findByTestId("notification-notif_1-set-ready"));
    await waitFor(() => {
      expect(setReadyMock).toHaveBeenCalledTimes(1);
    });
    expect(toastSuccessMock).toHaveBeenCalledWith(
      "Both players ready! Starting duel..."
    );

    fireEvent.click(await screen.findByTestId("notification-notif_1-set-ready"));
    await waitFor(() => {
      expect(setReadyMock).toHaveBeenCalledTimes(2);
    });

    expect(toastSuccessMock).toHaveBeenCalledWith(
      "You're ready! Waiting for opponent..."
    );
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
