import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExperimentalFeaturesToggle } from "@/app/settings/components/ExperimentalFeaturesToggle";
import { TTSProviderSelector } from "@/app/settings/components/TTSProviderSelector";
import { ReminderOffsetInput } from "@/app/settings/notifications/components/ReminderOffsetInput";
import { useExperimentalFeatures } from "@/app/settings/hooks/useExperimentalFeatures";
import { useTTSProvider } from "@/app/settings/hooks/useTTSProvider";
import { WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES } from "@/lib/notificationPreferencesDefaults";
const state = vi.hoisted(() => ({ preferences: undefined as undefined | { showExperimentalFeatures?: boolean; ttsProvider?: "resemble" | "elevenlabs" }, experiment: vi.fn(), provider: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/app/components/UserPreferencesProvider", () => ({ useUserPreferences: () => ({ userPreferences: state.preferences, updateShowExperimentalFeatures: state.experiment, updateTtsProvider: state.provider }) }));
vi.mock("sonner", () => ({ toast: { success: state.success, error: state.error } }));
beforeEach(() => { state.preferences = undefined; vi.resetAllMocks(); state.experiment.mockResolvedValue(undefined); state.provider.mockResolvedValue(undefined); });
describe("preference controls with real update hooks", () => {
  it.each([false, true])("toggles experimental features from %s and reports success", async current => {
    state.preferences = { showExperimentalFeatures: current };
    render(<ExperimentalFeaturesToggle />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", String(current));
    await act(async () => fireEvent.click(screen.getByRole("switch")));
    expect(state.experiment).toHaveBeenCalledExactlyOnceWith(!current);
    expect(state.success).toHaveBeenCalledWith(current ? "Experimental features are now hidden" : "Experimental features are now visible");
  });
  it("disables the switch while its write is pending and releases it on failure", async () => {
    let reject!: (error: Error) => void;
    state.experiment.mockImplementation(() => new Promise((_, fail) => { reject = fail; }));
    render(<ExperimentalFeaturesToggle />);
    fireEvent.click(screen.getByRole("switch"));
    expect(screen.getByRole("switch")).toBeDisabled();
    fireEvent.click(screen.getByRole("switch"));
    expect(state.experiment).toHaveBeenCalledOnce();
    await act(async () => reject(new Error("Update failed")));
    expect(state.error).toHaveBeenCalledWith("Update failed");
    expect(screen.getByRole("switch")).toBeEnabled();
  });
  it("ignores unchanged and pending hook requests", async () => {
    let resolve!: () => void;
    state.experiment.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    const h = renderHook(() => useExperimentalFeatures());
    await act(async () => h.result.current.setShowExperimentalFeatures(false));
    expect(state.experiment).not.toHaveBeenCalled();
    act(() => { void h.result.current.setShowExperimentalFeatures(true); });
    await act(async () => h.result.current.setShowExperimentalFeatures(true));
    expect(state.experiment).toHaveBeenCalledOnce();
    await act(async () => resolve());
    expect(h.result.current.isUpdating).toBe(false);
  });
  it("marks the default voice active and keeps the disabled provider unavailable", async () => {
    render(<TTSProviderSelector />);
    expect(screen.getByTestId("settings-tts-resemble")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("settings-tts-elevenlabs")).toBeDisabled();
    await act(async () => { fireEvent.click(screen.getByTestId("settings-tts-resemble")); fireEvent.click(screen.getByTestId("settings-tts-elevenlabs")); });
    expect(state.provider).not.toHaveBeenCalled();
  });
  it("changes an existing alternative provider and disables all choices while saving", async () => {
    state.preferences = { ttsProvider: "elevenlabs" };
    let resolve!: () => void;
    state.provider.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    render(<TTSProviderSelector />);
    expect(screen.getByTestId("settings-tts-elevenlabs")).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByTestId("settings-tts-resemble"));
    expect(screen.getAllByRole("button").every(button => button.hasAttribute("disabled"))).toBe(true);
    expect(state.provider).toHaveBeenCalledExactlyOnceWith("resemble");
    await act(async () => resolve());
    expect(state.success).toHaveBeenCalledWith("TTS provider changed to Resemble AI");
    expect(screen.getByTestId("settings-tts-resemble")).toBeEnabled();
  });
  it("shows a provider error and allows another attempt", async () => {
    state.preferences = { ttsProvider: "elevenlabs" }; state.provider.mockRejectedValue(new Error("Voice save failed"));
    render(<TTSProviderSelector />);
    await act(async () => fireEvent.click(screen.getByTestId("settings-tts-resemble")));
    expect(state.error).toHaveBeenCalledWith("Voice save failed");
    expect(screen.getByTestId("settings-tts-resemble")).toBeEnabled();
  });
  it("does not submit another provider request during an update", async () => {
    let resolve!: () => void;
    state.provider.mockImplementation(() => new Promise<void>(done => { resolve = done; }));
    const h = renderHook(() => useTTSProvider());
    act(() => { void h.result.current.setProvider("elevenlabs"); });
    await act(async () => h.result.current.setProvider("elevenlabs"));
    expect(state.provider).toHaveBeenCalledOnce();
    await act(async () => resolve());
  });
});
describe("reminder offset units", () => {
  it.each([[120, "hours", 2], [90, "minutes", 90], [30, "minutes", 30]] as const)("displays %s minutes with appropriate initial units", (valueMinutes, unit, value) => {
    render(<ReminderOffsetInput label="Before deadline" valueMinutes={valueMinutes} disabled={false} onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toHaveValue(unit);
    expect(screen.getByRole("spinbutton")).toHaveValue(value);
    expect(screen.getByRole("spinbutton")).toHaveAttribute("max", String(unit === "hours" ? WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES / 60 : WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES));
  });
  it("switches display units without changing saved minutes and converts subsequent edits", () => {
    const change = vi.fn();
    render(<ReminderOffsetInput label="Before deadline" valueMinutes={120} disabled={false} onChange={change} data-testid="offset" />);
    fireEvent.change(screen.getByTestId("offset"), { target: { value: "3" } });
    expect(change).toHaveBeenLastCalledWith(180);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "minutes" } });
    expect(change).toHaveBeenCalledOnce();
    expect(screen.getByTestId("offset")).toHaveValue(120);
    fireEvent.change(screen.getByTestId("offset"), { target: { value: "45" } });
    expect(change).toHaveBeenLastCalledWith(45);
    fireEvent.change(screen.getByTestId("offset"), { target: { value: "" } });
    expect(change).toHaveBeenLastCalledWith(1);
  });
  it("disables both value and unit while settings are unavailable", () => {
    render(<ReminderOffsetInput label="Before deadline" valueMinutes={30} disabled onChange={vi.fn()} />);
    expect(screen.getByRole("combobox")).toBeDisabled(); expect(screen.getByRole("spinbutton")).toBeDisabled();
  });
});
