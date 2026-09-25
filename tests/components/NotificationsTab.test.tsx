import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
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
  dismissWeeklyGoalInvitation: vi.fn(),
  declineWeeklyGoalInvitation: vi.fn(),
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

  it("renders goal unlocked weekly-goal notifications with review actions", () => {
    useNotificationsMock.mockReturnValue({
      notifications: [
        {
          _id: "notif_goal_unlock",
          type: NOTIFICATION_TYPES.WEEKLY_GOAL_INVITATION,
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

    expect(screen.getByTestId("notification-notif_goal_unlock-view-weekly-goal")).toBeInTheDocument();
    expect(screen.getByTestId("notification-notif_goal_unlock-dismiss-weekly-goal")).toBeInTheDocument();
  });

  it("archives completed weekly-goal themes from the notification", async () => {
    const archiveCompletedGoalThemes = vi.fn().mockResolvedValue({ archivedCount: 2 });
    useNotificationsMock.mockReturnValue({
      notifications: [
        {
          _id: "notif_goal_completed",
          type: NOTIFICATION_TYPES.WEEKLY_GOAL_INVITATION,
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
          type: NOTIFICATION_TYPES.WEEKLY_GOAL_INVITATION,
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

  it("renders PvE and PvP mode chips on challenge invites", () => {
    useNotificationsMock.mockReturnValue({
      notifications: [
        {
          ...challengeNotification,
          _id: "notif_pve",
          payload: {
            ...challengeNotification.payload,
            duelMode: "pve",
          },
        },
        {
          ...challengeNotification,
          _id: "notif_pvp",
          payload: {
            ...challengeNotification.payload,
            duelMode: "pvp",
          },
        },
      ],
      notificationCount: 2,
      isLoading: false,
      actions: makeActions(),
    });

    render(<NotificationsTab onClose={vi.fn()} />);

    expect(screen.getByText("PvE")).toBeInTheDocument();
    expect(screen.getByText("PvP")).toBeInTheDocument();
  });

  it("shows decline action for weekly goal invites and no view action for declined event", () => {
    useNotificationsMock.mockReturnValue({
      notifications: [
        {
          _id: "notif_goal_invite",
          type: NOTIFICATION_TYPES.WEEKLY_GOAL_INVITATION,
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
          type: NOTIFICATION_TYPES.WEEKLY_GOAL_INVITATION,
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

    expect(screen.getByTestId("notification-notif_goal_invite-decline-weekly-goal")).toBeInTheDocument();
    expect(screen.queryByTestId("notification-notif_goal_declined-view-weekly-goal")).not.toBeInTheDocument();
    expect(screen.getByTestId("notification-notif_goal_declined-dismiss-weekly-goal")).toBeInTheDocument();
  });
  it("accepts a challenge, closes the panel and opens the returned duel", async () => {
    const acceptChallenge = vi.fn().mockResolvedValue({ duelId: "duel_123" }); const close = vi.fn();
    useNotificationsMock.mockReturnValue({ notifications: [challengeNotification], isLoading: false, actions: makeActions({ acceptChallenge }) });
    render(<NotificationsTab onClose={close} />);
    await act(async () => fireEvent.click(screen.getByTestId("notification-notif_1-accept-challenge")));
    expect(acceptChallenge).toHaveBeenCalledExactlyOnceWith("notif_1");
    expect(toastSuccessMock).toHaveBeenCalledWith("Challenge accepted!");
    expect(close).toHaveBeenCalledOnce(); expect(pushMock).toHaveBeenCalledExactlyOnceWith("/duel/duel_123");
  });
  it.each([
    ["acceptFriendRequest", "accept-friend", NOTIFICATION_TYPES.FRIEND_REQUEST, undefined, "Friend request accepted!"],
    ["rejectFriendRequest", "reject-friend", NOTIFICATION_TYPES.FRIEND_REQUEST, undefined, "Friend request rejected"],
    ["declineChallenge", "decline-challenge", NOTIFICATION_TYPES.CHALLENGE_INVITE, undefined, "Challenge declined"],
    ["declineWeeklyGoalInvitation", "decline-weekly-goal", NOTIFICATION_TYPES.WEEKLY_GOAL_INVITATION, "invite", "Weekly goal invitation declined"],
    ["dismissWeeklyGoalInvitation", "dismiss-weekly-goal", NOTIFICATION_TYPES.WEEKLY_GOAL_INVITATION, "partner_locked", undefined],
    ["dismissNotification", "dismiss", NOTIFICATION_TYPES.WEEKLY_GOAL_DRAFT_EXPIRING, undefined, undefined],
  ] as const)("dispatches %s and handles rejection without closing the panel", async (actionName, suffix, type, event, successMessage) => {
    const action = vi.fn().mockResolvedValue(undefined); const close = vi.fn();
    const notification = { ...challengeNotification, type, payload: type === NOTIFICATION_TYPES.CHALLENGE_INVITE ? challengeNotification.payload : { goalId: "goal_1", event } };
    useNotificationsMock.mockReturnValue({ notifications: [notification], isLoading: false, actions: makeActions({ [actionName]: action }) });
    render(<NotificationsTab onClose={close} />);
    const button = screen.getByTestId(`notification-notif_1-${suffix}`);
    await act(async () => fireEvent.click(button));
    expect(action).toHaveBeenCalledExactlyOnceWith("notif_1");
    if (successMessage) expect(toastSuccessMock).toHaveBeenCalledWith(successMessage);
    else expect(toastSuccessMock).not.toHaveBeenCalled();
    action.mockRejectedValue(new Error("Action unavailable"));
    await act(async () => fireEvent.click(button));
    expect(toastErrorMock).toHaveBeenCalledExactlyOnceWith("Action unavailable");
    expect(action).toHaveBeenCalledTimes(2);
    expect(close).not.toHaveBeenCalled(); expect(pushMock).not.toHaveBeenCalled();
  });
  it("opens the goals page from an expiring draft notification", () => {
    const close = vi.fn();
    useNotificationsMock.mockReturnValue({ notifications: [{ ...challengeNotification, type: NOTIFICATION_TYPES.WEEKLY_GOAL_DRAFT_EXPIRING, payload: { goalId: "goal_1" } }], isLoading: false, actions: makeActions() });
    render(<NotificationsTab onClose={close} />);
    fireEvent.click(screen.getByTestId("notification-notif_1-view-weekly-goal"));
    expect(close).toHaveBeenCalledOnce(); expect(pushMock).toHaveBeenCalledExactlyOnceWith("/goals");
  });
  it("reports archive failures without claiming success", async () => {
    const archiveCompletedGoalThemes = vi.fn().mockRejectedValue(new Error("Archive failed"));
    useNotificationsMock.mockReturnValue({ notifications: [{ ...challengeNotification, type: NOTIFICATION_TYPES.WEEKLY_GOAL_INVITATION, payload: { goalId: "goal_1", event: "goal_completed_solo", themeCount: 2 } }], isLoading: false, actions: makeActions({ archiveCompletedGoalThemes }) });
    render(<NotificationsTab onClose={vi.fn()} />);
    await act(async () => fireEvent.click(screen.getByTestId("notification-notif_1-archive-completed-goal-themes")));
    expect(archiveCompletedGoalThemes).toHaveBeenCalledExactlyOnceWith("notif_1");
    expect(toastErrorMock).toHaveBeenCalledExactlyOnceWith("Archive failed");
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

});
