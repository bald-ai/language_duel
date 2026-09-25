import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePresence } from "@/hooks/usePresence";

const { update } = vi.hoisted(() => ({ update: vi.fn() }));
vi.mock("convex/react", () => ({ useMutation: () => update }));

beforeEach(() => { vi.useFakeTimers(); update.mockReset().mockResolvedValue(undefined); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("presence owner", () => {
  it("updates immediately, every 30 seconds and when returning to the visible page; cleans up on unmount", async () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    const hook = renderHook(() => usePresence());
    await act(async () => {});
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(29999); });
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(update).toHaveBeenCalledTimes(2);
    visibility.mockReturnValue("hidden");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(update).toHaveBeenCalledTimes(2);
    visibility.mockReturnValue("visible");
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(update).toHaveBeenCalledTimes(3);
    hook.unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(update).toHaveBeenCalledTimes(3);
  });

  it("coalesces updates in flight and allows later updates after completion", async () => {
    let finish!: () => void;
    update.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    const hook = renderHook(() => usePresence());
    await act(async () => {
      await hook.result.current.updatePresence();
      await vi.advanceTimersByTimeAsync(30000);
    });
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    await act(async () => { await hook.result.current.updatePresence(); });
    expect(update).toHaveBeenCalledTimes(2);
    hook.unmount();
  });

  it("logs a noncritical failure and retries on the next scheduled update", async () => {
    const failure = new Error("offline");
    update.mockRejectedValueOnce(failure);
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    const hook = renderHook(() => usePresence());
    await act(async () => {});
    expect(debug).toHaveBeenCalledWith("Failed to update presence:", failure);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(update).toHaveBeenCalledTimes(2);
    hook.unmount();
  });
});
