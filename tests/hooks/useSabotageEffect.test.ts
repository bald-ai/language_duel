import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSabotageEffect } from "@/app/duel/[duelId]/hooks/useSabotageEffect";
import {
  SABOTAGE_DURATION_MS,
  SABOTAGE_WIND_DOWN_MS,
  SABOTAGE_WIND_UP_MS,
} from "@/lib/sabotage/constants";

describe("useSabotageEffect", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("clears all pending timers on unmount", () => {
    vi.useFakeTimers();
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");

    const { unmount } = renderHook(() =>
      useSabotageEffect({
        mySabotage: { effect: "sticky", timestamp: 1 },
        phase: "answering",
        isLocked: false,
      })
    );

    act(() => {
      vi.advanceTimersByTime(0);
    });

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears standard sabotage when the question transitions", () => {
    vi.useFakeTimers();

    const { result, rerender } = renderHook(
      ({ phase }: { phase: "answering" | "transition" }) =>
        useSabotageEffect({
          mySabotage: { effect: "sticky", timestamp: 1 },
          phase,
          isLocked: false,
        }),
      { initialProps: { phase: "answering" } }
    );

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.activeSabotage).toBe("sticky");

    rerender({ phase: "transition" });
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.activeSabotage).toBeNull();
    expect(result.current.sabotagePhase).toBe("wind-up");
  });

  it("follows the standard wind-up, full, wind-down, clear phase schedule", () => {
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useSabotageEffect({
        mySabotage: { effect: "sticky", timestamp: 1 },
        phase: "answering",
        isLocked: false,
      })
    );

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current.sabotagePhase).toBe("wind-up");

    act(() => {
      vi.advanceTimersByTime(SABOTAGE_WIND_UP_MS);
    });
    expect(result.current.sabotagePhase).toBe("full");

    act(() => {
      vi.advanceTimersByTime(SABOTAGE_WIND_DOWN_MS - SABOTAGE_WIND_UP_MS);
    });
    expect(result.current.sabotagePhase).toBe("wind-down");

    act(() => {
      vi.advanceTimersByTime(SABOTAGE_DURATION_MS - SABOTAGE_WIND_DOWN_MS);
    });
    expect(result.current.activeSabotage).toBeNull();
  });
});
