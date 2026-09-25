import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsPage from "@/app/settings/page";
import NotificationSettingsPage from "@/app/settings/notifications/page";
import { UserPreferencesProvider } from "@/app/components/UserPreferencesProvider";
import { AppearanceProvider } from "@/app/components/AppearanceProvider";
import { BackgroundProvider } from "@/app/components/BackgroundProvider";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notificationPreferencesDefaults";
const state = vi.hoisted(() => ({ data: new Map<string, unknown>(), mutations: new Map<string, ReturnType<typeof vi.fn>>(), push: vi.fn(), error: vi.fn(), success: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("convex/react", () => ({ useQuery: (ref: Parameters<typeof getFunctionName>[0]) => state.data.get(getFunctionName(ref)), useMutation: (ref: Parameters<typeof getFunctionName>[0]) => { const name = getFunctionName(ref); if (!state.mutations.has(name)) state.mutations.set(name, vi.fn().mockResolvedValue(undefined)); return state.mutations.get(name); } }));
vi.mock("sonner", () => ({ toast: { error: state.error, success: state.success } }));
const providers = ({ children }: { children: ReactNode }) => <UserPreferencesProvider><AppearanceProvider><BackgroundProvider>{children}</BackgroundProvider></AppearanceProvider></UserPreferencesProvider>;
beforeEach(() => { vi.clearAllMocks(); state.data.clear(); state.mutations.clear(); localStorage.clear(); });
describe("settings page integration", () => {
  it("shows loading and signed-out navigation before user details are available", async () => {
    const view = render(<SettingsPage />, { wrapper: providers }); await act(async () => {});
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    state.data.set("users:getCurrentUser", null); view.rerender(<SettingsPage />);
    expect(screen.getByText("Please sign in to access settings")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("settings-go-home")); expect(state.push).toHaveBeenCalledExactlyOnceWith("/");
  });
  it("renders a profile, saves a nickname and navigates to notification settings and home", async () => {
    state.data.set("users:getCurrentUser", { nickname: "Sammy", discriminator: 1234, name: "Sam", email: "sam@example.test", llmCreditsRemaining: 25, ttsGenerationsRemaining: 40 });
    state.data.set("userPreferences:getUserPreferences", { selectedColorSet: "playful-duo", selectedBackground: "background.jpg", ttsProvider: "resemble", showExperimentalFeatures: false });
    render(<SettingsPage />, { wrapper: providers }); await act(async () => {});
    expect(screen.getByText("sam@example.test")).toBeInTheDocument();
    const save = state.mutations.get("users:updateNickname")!; save.mockResolvedValue({ nickname: "TravelSam", discriminator: 1234 });
    fireEvent.change(screen.getByTestId("settings-nickname-input"), { target: { value: "TravelSam" } });
    await act(async () => fireEvent.click(screen.getByTestId("settings-nickname-submit")));
    expect(save).toHaveBeenCalledExactlyOnceWith({ nickname: "TravelSam" });
    expect(state.success).toHaveBeenCalledWith("Nickname updated to TravelSam#1234");
    fireEvent.click(screen.getByTestId("settings-notifications")); fireEvent.click(screen.getByTestId("settings-back")); fireEvent.click(screen.getByTestId("settings-back-menu"));
    expect(state.push.mock.calls).toEqual([["/settings/notifications"], ["/"], ["/"]]);
  });
});
describe("notification settings page integration", () => {
  it("loads preferences and persists category, trigger and reminder edits through the real hook", async () => {
    const view = render(<NotificationSettingsPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    state.data.set("notificationPreferences:getMyNotificationPreferences", DEFAULT_NOTIFICATION_PREFS); view.rerender(<NotificationSettingsPage />);
    const save = state.mutations.get("notificationPreferences:updateNotificationPreferences")!;
    await act(async () => fireEvent.click(screen.getByTestId("category-challenge-invites")));
    expect(save).toHaveBeenLastCalledWith({ challengeInviteEmailsEnabled: false });
    await act(async () => fireEvent.click(screen.getByRole("switch", { name: "Goal invite received" })));
    expect(save).toHaveBeenLastCalledWith({ weeklyGoalInviteEmailEnabled: false });
    await act(async () => fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "48" } }));
    expect(save).toHaveBeenLastCalledWith({ weeklyGoalReminder1OffsetMinutes: 2880 });
    fireEvent.click(screen.getByTestId("notifications-back")); expect(state.push).toHaveBeenCalledExactlyOnceWith("/settings");
  });
  it("disables weekly-goal controls when their category is off", () => {
    state.data.set("notificationPreferences:getMyNotificationPreferences", { ...DEFAULT_NOTIFICATION_PREFS, weeklyGoalEmailsEnabled: false });
    render(<NotificationSettingsPage />);
    expect(screen.getByRole("switch", { name: "Goal invite received" })).toBeDisabled();
    for (const input of screen.getAllByRole("spinbutton")) expect(input).toBeDisabled();
  });
});
