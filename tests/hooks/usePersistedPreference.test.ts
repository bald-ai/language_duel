import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePersistedPreference } from "@/app/components/usePersistedPreference";
import { isValidBackground, DEFAULT_BACKGROUND } from "@/lib/preferences/backgrounds";
const storageKey = "test-background-preference";
const defaults = { defaultValue: DEFAULT_BACKGROUND, storageKey, serverValue: undefined as string | undefined | null, serverValueLoaded: false, isValid: isValidBackground };
beforeEach(() => { localStorage.clear(); });

describe("persisted preferences", () => {
  it.each([null, "removed-image.jpg", "background_2.jpg"])("hydrates a valid local value from %s", async stored => {
    if (stored !== null) localStorage.setItem(storageKey, stored);
    const hook = renderHook(() => usePersistedPreference(defaults));
    await act(async () => {});
    expect(hook.result.current.value).toBe(stored === "background_2.jpg" ? stored : DEFAULT_BACKGROUND);
  });
  it("applies the loaded server preference once, then preserves a user's newer selection", async () => {
    localStorage.setItem(storageKey, "background_2.jpg");
    const hook = renderHook(props => usePersistedPreference(props), { initialProps: defaults });
    await act(async () => {});
    expect(hook.result.current.value).toBe("background_2.jpg");
    hook.rerender({ ...defaults, serverValueLoaded: true, serverValue: "background.jpg" });
    await act(async () => {});
    expect(hook.result.current.value).toBe("background.jpg");
    expect(localStorage.getItem(storageKey)).toBe("background.jpg");
    act(() => hook.result.current.setValue("background_2.jpg"));
    hook.rerender({ ...defaults, serverValueLoaded: true, serverValue: "background.jpg" });
    await act(async () => {});
    expect(hook.result.current.value).toBe("background_2.jpg");
    expect(localStorage.getItem(storageKey)).toBe("background_2.jpg");
  });
  it.each([null, "unavailable.jpg"])("keeps local choice when the loaded server value is %s", async serverValue => {
    localStorage.setItem(storageKey, "background_2.jpg");
    const hook = renderHook(() => usePersistedPreference({ ...defaults, serverValue, serverValueLoaded: true }));
    await act(async () => {});
    expect(hook.result.current.value).toBe("background_2.jpg");
  });
  it("persists locally before preferences load and saves to the server after they load", async () => {
    const saveValue = vi.fn().mockResolvedValue(undefined);
    const hook = renderHook(({ loaded }) => usePersistedPreference({ ...defaults, serverValueLoaded: loaded, saveValue }), { initialProps: { loaded: false } });
    await act(async () => {});
    act(() => hook.result.current.setValue("background_2.jpg"));
    expect(saveValue).not.toHaveBeenCalled();
    expect(localStorage.getItem(storageKey)).toBe("background_2.jpg");
    hook.rerender({ loaded: true }); await act(async () => {});
    await act(async () => hook.result.current.setValue("background.jpg"));
    expect(saveValue).toHaveBeenCalledExactlyOnceWith("background.jpg");
  });
  it("reports a failed server save while retaining the chosen local value", async () => {
    const error = new Error("Save unavailable"); const onSaveError = vi.fn();
    const saveValue = vi.fn().mockRejectedValue(error);
    const hook = renderHook(() => usePersistedPreference({ ...defaults, serverValueLoaded: true, saveValue, onSaveError }));
    await act(async () => {});
    await act(async () => hook.result.current.setValue("background_2.jpg"));
    expect(onSaveError).toHaveBeenCalledExactlyOnceWith(error);
    expect(hook.result.current.value).toBe("background_2.jpg");
    expect(localStorage.getItem(storageKey)).toBe("background_2.jpg");
  });
});
