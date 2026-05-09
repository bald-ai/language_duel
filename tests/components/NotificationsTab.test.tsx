import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotificationsTab } from "@/app/notifications/components/NotificationsTab";
import { NOTIFICATION_TYPES } from "@/app/notifications/constants";

const pushMock = vi.fn();
const useNotificationsMock = vi.fn();
const toastSuccessMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccessMock(...args),
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

vi.mock("@/app/notifications/hooks/useNotifications", () => ({
  useNotifications: () => useNotificationsMock(),
}));

const makeActions = (overrides: Record<string, unknown> = {}) => ({
  dismissNotification: vi.fn(),
  markAsRead: vi.fn(),
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  acceptChallenge: vi.fn(),
  declineChallenge: vi.fn(),
  dismissWeeklyPlanInvitation: vi.fn(),
  declineWeeklyPlanInvitation: vi.fn(),
  archiveCompletedGoalThemes: vi.fn(),
  ...overrides,
});

const challengeNotification = {
  _id: "notif_1",
  type: NOTIFICATION_TYPES.CHALLENGE_INVITE,
  fromUser: { nickname: "Alex" },
  payload: {
    challengeId: "challenge_1",
    themeName: "Test Theme",
  },
  createdAt: Date.now(),
  status: "pending",
};

describe("NotificationsTab theme actions", () => {
  beforeEach(() => {
    pushMock.mockClear();
    toastSuccessMock.mockClear();
    toastErrorMock.mockClear();
    useNotificationsMock.mockReturnValue({
      notifications: [challengeNotification],
      notificationCount: 1,
      isLoading: false,
      actions: makeActions(),
    });
  });

  it("renders loading state while notifications are being fetched", () => {
    useNotificationsMock.mockReturnValue({
      notifications: [],
      notificationCount: 0,
      isLoading: true,
      actions: makeActions(),
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    expect(screen.queryByTestId("notifications-empty-state")).not.toBeInTheDocument();
    expect(screen.queryByTestId("notifications-tab")).not.toBeInTheDocument();
  });

  it("renders empty state when there are no notifications", () => {
    useNotificationsMock.mockReturnValue({
      notifications: [],
      notificationCount: 0,
      isLoading: false,
      actions: makeActions(),
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    expect(screen.getByTestId("notifications-empty-state")).toBeInTheDocument();
  });

  it("renders goal unlocked weekly-plan notifications with review actions", () => {
    useNotificationsMock.mockReturnValue({
      notifications: [
        {
          _id: "notif_goal_unlock",
          type: NOTIFICATION_TYPES.WEEKLY_PLAN_INVITATION,
          fromUser: { nickname: "Alex" },
          payload: {
            goalId: "goal_1",
            themeCount: 2,
            event: "goal_unlocked",
          },
          createdAt: Date.now(),
          status: "pending",
        },
      ],
      notificationCount: 1,
      isLoading: false,
      actions: makeActions(),
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    expect(screen.getByTestId("notification-notif_goal_unlock-view-weekly-plan")).toBeInTheDocument();
    expect(screen.getByTestId("notification-notif_goal_unlock-dismiss-weekly-plan")).toBeInTheDocument();
  });

  it("archives completed weekly-goal themes from the notification", async () => {
    const archiveCompletedGoalThemes = vi.fn().mockResolvedValue({ archivedCount: 2 });
    useNotificationsMock.mockReturnValue({
      notifications: [
        {
          _id: "notif_goal_completed",
          type: NOTIFICATION_TYPES.WEEKLY_PLAN_INVITATION,
          fromUser: { nickname: "Alex" },
          payload: {
            goalId: "goal_1",
            themeCount: 2,
            event: "goal_completed",
          },
          createdAt: Date.now(),
          status: "pending",
        },
      ],
      notificationCount: 1,
      isLoading: false,
      actions: makeActions({ archiveCompletedGoalThemes }),
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Archive 2 themes" }));

    await waitFor(() => {
      expect(archiveCompletedGoalThemes).toHaveBeenCalledWith("notif_goal_completed");
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Archived 2 themes");
  });

  it("shows singular archive copy and already-archived toast", async () => {
    const archiveCompletedGoalThemes = vi.fn().mockResolvedValue({ archivedCount: 0 });
    useNotificationsMock.mockReturnValue({
      notifications: [
        {
          _id: "notif_goal_completed",
          type: NOTIFICATION_TYPES.WEEKLY_PLAN_INVITATION,
          fromUser: { nickname: "Alex" },
          payload: {
            goalId: "goal_1",
            themeCount: 1,
            event: "goal_completed",
          },
          createdAt: Date.now(),
          status: "pending",
        },
      ],
      notificationCount: 1,
      isLoading: false,
      actions: makeActions({ archiveCompletedGoalThemes }),
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Archive 1 theme" }));

    await waitFor(() => {
      expect(archiveCompletedGoalThemes).toHaveBeenCalledWith("notif_goal_completed");
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Themes already archived");
  });

  it("surfaces server error messages from notification actions", async () => {
    const acceptChallenge = vi
      .fn()
      .mockRejectedValue(new Error("Challenge is no longer pending"));
    useNotificationsMock.mockReturnValue({
      notifications: [challengeNotification],
      notificationCount: 1,
      isLoading: false,
      actions: makeActions({ acceptChallenge }),
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId("notification-notif_1-accept-challenge"));

    await waitFor(() => {
      expect(acceptChallenge).toHaveBeenCalledWith("notif_1");
    });
    expect(toastErrorMock).toHaveBeenCalledWith("Challenge is no longer pending");
  });

  it("shows decline action for weekly goal invites and no view action for declined event", () => {
    useNotificationsMock.mockReturnValue({
      notifications: [
        {
          _id: "notif_goal_invite",
          type: NOTIFICATION_TYPES.WEEKLY_PLAN_INVITATION,
          fromUser: { nickname: "Alex" },
          payload: {
            goalId: "goal_1",
            event: "invite",
          },
          createdAt: Date.now(),
          status: "pending",
        },
        {
          _id: "notif_goal_declined",
          type: NOTIFICATION_TYPES.WEEKLY_PLAN_INVITATION,
          fromUser: { nickname: "Alex" },
          payload: {
            goalId: "goal_2",
            event: "declined",
          },
          createdAt: Date.now(),
          status: "pending",
        },
      ],
      notificationCount: 2,
      isLoading: false,
      actions: makeActions(),
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    expect(screen.getByTestId("notification-notif_goal_invite-decline-weekly-plan")).toBeInTheDocument();
    expect(screen.queryByTestId("notification-notif_goal_declined-view-weekly-plan")).not.toBeInTheDocument();
    expect(screen.getByTestId("notification-notif_goal_declined-dismiss-weekly-plan")).toBeInTheDocument();
  });
});
