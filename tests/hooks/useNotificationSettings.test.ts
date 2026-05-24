import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPreferences";
import { useNotificationSettings } from "@/app/settings/notifications/hooks/useNotificationSettings";

const useQueryMock = vi.fn();
const updatePreferencesMutationMock = vi.fn();
const toastErrorMock = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => useQueryMock(...args),
  useMutation: () => updatePreferencesMutationMock,
}));

vi.mock("@/convex/_generated/api", () => ({
  api: {
    notificationPreferences: {
      getMyNotificationPreferences: "getMyNotificationPreferences",
      updateNotificationPreferences: "updateNotificationPreferences",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}));

describe("useNotificationSettings", () => {
  beforeEach(() => {
    useQueryMock.mockReset();
    updatePreferencesMutationMock.mockReset();
    toastErrorMock.mockClear();
  });

  it("surfaces save failures with a toast", async () => {
    useQueryMock.mockReturnValue(DEFAULT_NOTIFICATION_PREFS);
    updatePreferencesMutationMock.mockRejectedValue(new Error("Invalid reminder offset"));

    const { result } = renderHook(() => useNotificationSettings());

    await act(async () => {
      await result.current.updatePrefs({ weeklyGoalReminder1OffsetMinutes: -1 });
    });

    expect(toastErrorMock).toHaveBeenCalledWith("Invalid reminder offset");
  });

  it("fills missing preference fields from defaults", () => {
    useQueryMock.mockReturnValue({
      weeklyGoalEmailsEnabled: false,
      weeklyGoalReminder1OffsetMinutes: 777,
    });

    const { result } = renderHook(() => useNotificationSettings());

    expect(result.current.prefs.weeklyGoalEmailsEnabled).toBe(false);
    expect(result.current.prefs.weeklyGoalReminder1OffsetMinutes).toBe(777);
    expect(result.current.prefs.challengeInviteEmailsEnabled).toBe(
      DEFAULT_NOTIFICATION_PREFS.challengeInviteEmailsEnabled
    );
    expect(result.current.prefs.weeklyGoalReminder2OffsetMinutes).toBe(
      DEFAULT_NOTIFICATION_PREFS.weeklyGoalReminder2OffsetMinutes
    );
  });
});
