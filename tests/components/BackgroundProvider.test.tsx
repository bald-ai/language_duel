import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BackgroundProvider, useBackground } from "@/app/components/BackgroundProvider";
const state = vi.hoisted(() => ({ preferences: undefined as undefined | null | { selectedBackground?: string }, save: vi.fn(), error: vi.fn(), loading: true }));
vi.mock("@/app/components/UserPreferencesProvider", () => ({ useUserPreferences: () => ({ userPreferences: state.preferences, isLoading: state.loading, updateBackground: state.save }) }));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
const wrapper = ({ children }: { children: ReactNode }) => <BackgroundProvider>{children}</BackgroundProvider>;
beforeEach(() => { localStorage.clear(); vi.resetAllMocks(); state.preferences = undefined; state.loading = true; state.save.mockResolvedValue(undefined); });
describe("background preferences", () => {
  it("requires its provider", () => {
    expect(() => renderHook(useBackground)).toThrow("useBackground must be used within BackgroundProvider");
  });
  it("hydrates local preference before server loading completes and applies the server selection", async () => {
    localStorage.setItem("language-duel-background", "background_2.jpg");
    const hook = renderHook(useBackground, { wrapper });
    await act(async () => {});
    expect(hook.result.current).toMatchObject({ background: "background_2.jpg", isLoading: true });
    state.preferences = { selectedBackground: "background.jpg" }; state.loading = false; hook.rerender();
    await act(async () => {});
    expect(hook.result.current).toMatchObject({ background: "background.jpg", isLoading: false });
    await act(async () => hook.result.current.setBackground("background_2.jpg"));
    expect(state.save).toHaveBeenCalledExactlyOnceWith("background_2.jpg");
    expect(localStorage.getItem("language-duel-background")).toBe("background_2.jpg");
  });
  it("supports local changes while signed out without submitting a server mutation", async () => {
    state.preferences = null; state.loading = false;
    const hook = renderHook(useBackground, { wrapper }); await act(async () => {});
    await act(async () => hook.result.current.setBackground("background_2.jpg"));
    expect(hook.result.current.background).toBe("background_2.jpg"); expect(state.save).not.toHaveBeenCalled();
  });
  it("reports a failed server write and retains the selected local backdrop", async () => {
    state.preferences = { selectedBackground: "background.jpg" }; state.save.mockRejectedValue(new Error("Background save failed"));
    const hook = renderHook(useBackground, { wrapper }); await act(async () => {});
    await act(async () => hook.result.current.setBackground("background_2.jpg"));
    expect(state.error).toHaveBeenCalledExactlyOnceWith("Background save failed");
    expect(hook.result.current.background).toBe("background_2.jpg");
  });
});
