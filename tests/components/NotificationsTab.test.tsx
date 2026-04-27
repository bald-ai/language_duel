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
    mode: "classic",
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
        declineWeeklyPlanInvitation: vi.fn(),
        archiveCompletedGoalThemes: vi.fn(),
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
        declineWeeklyPlanInvitation: vi.fn(),
        archiveCompletedGoalThemes: vi.fn(),
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
        declineWeeklyPlanInvitation: vi.fn(),
        archiveCompletedGoalThemes: vi.fn(),
        acceptScheduledDuel: vi.fn(),
        counterProposeScheduledDuel: vi.fn(),
        declineScheduledDuel: vi.fn(),
      },
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
      actions: {
        dismissNotification: vi.fn(),
        markAsRead: vi.fn(),
        acceptFriendRequest: vi.fn(),
        rejectFriendRequest: vi.fn(),
        acceptDuelChallenge: vi.fn(),
        declineDuelChallenge: vi.fn(),
        dismissWeeklyPlanInvitation: vi.fn(),
        declineWeeklyPlanInvitation: vi.fn(),
        archiveCompletedGoalThemes: vi.fn(),
        acceptScheduledDuel: vi.fn(),
        counterProposeScheduledDuel: vi.fn(),
        declineScheduledDuel: vi.fn(),
      },
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    expect(
      screen.getByText(
        "Alex changed the weekly goal, so your lock was removed. Review it and lock again."
      )
    ).toBeInTheDocument();
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
      actions: {
        dismissNotification: vi.fn(),
        markAsRead: vi.fn(),
        acceptFriendRequest: vi.fn(),
        rejectFriendRequest: vi.fn(),
        acceptDuelChallenge: vi.fn(),
        declineDuelChallenge: vi.fn(),
        dismissWeeklyPlanInvitation: vi.fn(),
        declineWeeklyPlanInvitation: vi.fn(),
        archiveCompletedGoalThemes,
        acceptScheduledDuel: vi.fn(),
        counterProposeScheduledDuel: vi.fn(),
        declineScheduledDuel: vi.fn(),
      },
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Nice" })).toBeInTheDocument();
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
      actions: {
        dismissNotification: vi.fn(),
        markAsRead: vi.fn(),
        acceptFriendRequest: vi.fn(),
        rejectFriendRequest: vi.fn(),
        acceptDuelChallenge: vi.fn(),
        declineDuelChallenge: vi.fn(),
        dismissWeeklyPlanInvitation: vi.fn(),
        declineWeeklyPlanInvitation: vi.fn(),
        archiveCompletedGoalThemes,
        acceptScheduledDuel: vi.fn(),
        counterProposeScheduledDuel: vi.fn(),
        declineScheduledDuel: vi.fn(),
      },
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Archive 1 theme" }));

    await waitFor(() => {
      expect(archiveCompletedGoalThemes).toHaveBeenCalledWith("notif_goal_completed");
    });
    expect(toastSuccessMock).toHaveBeenCalledWith("Themes already archived");
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
        declineWeeklyPlanInvitation: vi.fn(),
        archiveCompletedGoalThemes: vi.fn(),
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
      actions: {
        dismissNotification: vi.fn(),
        markAsRead: vi.fn(),
        acceptFriendRequest: vi.fn(),
        rejectFriendRequest: vi.fn(),
        acceptDuelChallenge: vi.fn(),
        declineDuelChallenge: vi.fn(),
        dismissWeeklyPlanInvitation: vi.fn(),
        declineWeeklyPlanInvitation: vi.fn(),
        archiveCompletedGoalThemes: vi.fn(),
        acceptScheduledDuel: vi.fn(),
        counterProposeScheduledDuel: vi.fn(),
        declineScheduledDuel: vi.fn(),
      },
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    expect(screen.getByTestId("notification-notif_goal_invite-decline-weekly-plan")).toBeInTheDocument();
    expect(screen.queryByTestId("notification-notif_goal_declined-view-weekly-plan")).not.toBeInTheDocument();
    expect(screen.getByTestId("notification-notif_goal_declined-dismiss-weekly-plan")).toBeInTheDocument();
  });
});
