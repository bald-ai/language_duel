import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserPreferencesProvider, useUserPreferences } from "@/app/components/UserPreferencesProvider";
const state = vi.hoisted(() => ({ preferences: undefined as unknown, mutations: new Map<string, ReturnType<typeof vi.fn>>() }));
vi.mock("convex/react", () => ({ useQuery: () => state.preferences, useMutation: (ref: Parameters<typeof getFunctionName>[0]) => { const name = getFunctionName(ref); if (!state.mutations.has(name)) state.mutations.set(name, vi.fn()); return state.mutations.get(name); } }));
const wrapper = ({ children }: { children: ReactNode }) => <UserPreferencesProvider>{children}</UserPreferencesProvider>;
beforeEach(() => { state.preferences = undefined; state.mutations.clear(); });
describe("user preferences context", () => {
  it("requires the provider and distinguishes loading from signed-out state", () => {
    expect(() => renderHook(useUserPreferences)).toThrow("useUserPreferences must be used within UserPreferencesProvider");
    const hook = renderHook(useUserPreferences, { wrapper }); expect(hook.result.current.isLoading).toBe(true);
    state.preferences = null; hook.rerender(); expect(hook.result.current).toMatchObject({ userPreferences: null, isLoading: false });
    state.preferences = { selectedColorSet: "warm-mischief", selectedBackground: "background.jpg", ttsProvider: "resemble", showExperimentalFeatures: false }; hook.rerender();
    expect(hook.result.current.userPreferences).toBe(state.preferences);
  });
  it("sends each preference using its specific endpoint argument and preserves the response", async () => {
    const hook = renderHook(useUserPreferences, { wrapper });
    const color = state.mutations.get("userPreferences:updateColorSet")!;
    const background = state.mutations.get("userPreferences:updateBackground")!;
    const voice = state.mutations.get("userPreferences:updateTtsProvider")!;
    const experimental = state.mutations.get("userPreferences:updateShowExperimentalFeatures")!;
    color.mockResolvedValue({ selectedColorSet: "warm-mischief" }); background.mockResolvedValue({ selectedBackground: "background_2.jpg" });
    voice.mockResolvedValue({ ttsProvider: "resemble" }); experimental.mockResolvedValue({ showExperimentalFeatures: true });
    await expect(hook.result.current.updateColorSet("warm-mischief")).resolves.toEqual({ selectedColorSet: "warm-mischief" });
    await expect(hook.result.current.updateBackground("background_2.jpg")).resolves.toEqual({ selectedBackground: "background_2.jpg" });
    await expect(hook.result.current.updateTtsProvider("resemble")).resolves.toEqual({ ttsProvider: "resemble" });
    await expect(hook.result.current.updateShowExperimentalFeatures(true)).resolves.toEqual({ showExperimentalFeatures: true });
    expect(color).toHaveBeenCalledExactlyOnceWith({ colorSet: "warm-mischief" });
    expect(background).toHaveBeenCalledExactlyOnceWith({ background: "background_2.jpg" });
    expect(voice).toHaveBeenCalledExactlyOnceWith({ ttsProvider: "resemble" });
    expect(experimental).toHaveBeenCalledExactlyOnceWith({ showExperimentalFeatures: true });
    const error = new Error("Preferences unavailable"); voice.mockRejectedValue(error);
    await expect(hook.result.current.updateTtsProvider("resemble")).rejects.toBe(error);
  });
});
