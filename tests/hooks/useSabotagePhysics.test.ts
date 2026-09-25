import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrampolineOptions } from "@/app/game/sabotage/hooks/useTrampolineOptions";
import { useBounceOptions } from "@/app/game/sabotage/hooks/useBounceOptions";
import type { SabotageEffect } from "@/lib/sabotage/types";
import { TRAMPOLINE_SHAKE_MS, TRAMPOLINE_SHAKE_AMPLITUDE_PX, TRAMPOLINE_BUTTON_WIDTH, TRAMPOLINE_BUTTON_HEIGHT, TRAMPOLINE_FLY_SCALE, BUTTON_WIDTH, BUTTON_HEIGHT, BOUNCE_FLY_SCALE } from "@/lib/sabotage/constants";
const random = vi.hoisted(() => vi.fn(() => 0.1));
vi.mock("@/lib/prng", () => ({ hashSeed: () => 1, mulberry32: () => random }));
let callbacks: Map<number, FrameRequestCallback>;
let nextId: number;
let cancel: ReturnType<typeof vi.fn>;
function frame(time: number) {
  act(() => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(time)); });
}
beforeEach(() => {
  callbacks = new Map(); nextId = 1; random.mockReset().mockReturnValue(0.1);
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { const id = nextId++; callbacks.set(id, callback); return id; }));
  cancel = vi.fn((id: number) => callbacks.delete(id)); vi.stubGlobal("cancelAnimationFrame", cancel);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("sabotage animation physics", () => {
  it("starts as a centered grid, shakes without moving its anchors, and launches at the exact boundary", () => {
    const bounds = { width: 1000, height: 800 };
    const h = renderHook(() => useTrampolineOptions({ activeSabotage: "trampoline", optionCount: 3, bounds }));
    expect(h.result.current.trampolineOptions).toEqual([]);
    frame(0); const initial = h.result.current.trampolineOptions;
    expect(initial.map(o => o.phase)).toEqual(["shaking", "shaking", "shaking"]);
    expect(initial[1].x).toBeGreaterThan(initial[0].x); expect(initial[2].y).toBeGreaterThan(initial[0].y);
    frame(TRAMPOLINE_SHAKE_MS / 2);
    for (const [i, option] of h.result.current.trampolineOptions.entries()) {
      expect([option.x, option.y]).toEqual([initial[i].x, initial[i].y]);
      expect(Math.abs(option.shakeOffset.x)).toBeLessThanOrEqual(TRAMPOLINE_SHAKE_AMPLITUDE_PX);
      expect(Math.abs(option.shakeOffset.y)).toBeLessThanOrEqual(TRAMPOLINE_SHAKE_AMPLITUDE_PX);
    }
    expect(h.result.current.trampolineOptions.some(o => o.shakeOffset.x !== 0 || o.shakeOffset.y !== 0)).toBe(true);
    frame(TRAMPOLINE_SHAKE_MS - 1); expect(h.result.current.trampolineOptions[0].phase).toBe("shaking");
    frame(TRAMPOLINE_SHAKE_MS);
    expect(h.result.current.trampolineOptions[0]).toMatchObject({ phase: "flying", shakeOffset: { x: 0, y: 0 } });
    expect(h.result.current.trampolineOptions[0].vy).toBeLessThan(0);
  });
  it.each([0.1, 0.9])("keeps flying tiles inside horizontal walls and relaunches from the floor (random=%s)", value => {
    random.mockReturnValue(value);
    const width = 1000, height = 800;
    const bounds = { width, height };
    const h = renderHook(() => useTrampolineOptions({ activeSabotage: "trampoline", optionCount: 1, bounds }));
    frame(0); frame(TRAMPOLINE_SHAKE_MS);
    const initial = h.result.current.trampolineOptions[0];
    expect(Math.sign(initial.vx)).toBe(value < 0.5 ? -1 : 1);
    let touchedWall = false, bouncedFloor = false;
    for (let i = 1; i <= 800; i++) {
      frame(TRAMPOLINE_SHAKE_MS + i * 16.67);
      const tile = h.result.current.trampolineOptions[0];
      expect(tile.x).toBeGreaterThanOrEqual(0); expect(tile.x).toBeLessThanOrEqual(width - TRAMPOLINE_BUTTON_WIDTH * TRAMPOLINE_FLY_SCALE);
      expect(tile.y).toBeLessThanOrEqual(height - TRAMPOLINE_BUTTON_HEIGHT * TRAMPOLINE_FLY_SCALE);
      if (tile.x === 0 || tile.x === width - TRAMPOLINE_BUTTON_WIDTH * TRAMPOLINE_FLY_SCALE) touchedWall = true;
      if (tile.y === height - TRAMPOLINE_BUTTON_HEIGHT * TRAMPOLINE_FLY_SCALE && tile.vy < 0) bouncedFloor = true;
    }
    expect(touchedWall).toBe(true); expect(bouncedFloor).toBe(true);
  });
  it.each([0.01, 0.99])("reflects bouncing options at horizontal and vertical walls (random=%s)", value => {
    random.mockReturnValue(value);
    const width = 600, height = 600;
    const bounds = { width, height };
    const h = renderHook(() => useBounceOptions({ activeSabotage: "bounce", optionCount: 1, bounds }));
    frame(0); let horizontal = false, vertical = false;
    for (let i = 1; i <= 300; i++) {
      frame(i * 16.67); const tile = h.result.current.bouncingOptions[0];
      expect(tile.x).toBeGreaterThanOrEqual(0); expect(tile.x).toBeLessThanOrEqual(width - BUTTON_WIDTH * BOUNCE_FLY_SCALE);
      expect(tile.y).toBeGreaterThanOrEqual(0); expect(tile.y).toBeLessThanOrEqual(height - BUTTON_HEIGHT * BOUNCE_FLY_SCALE);
      if (tile.x === 0) { horizontal = true; expect(tile.vx).toBeGreaterThan(0); }
      if (tile.x === width - BUTTON_WIDTH * BOUNCE_FLY_SCALE) { horizontal = true; expect(tile.vx).toBeLessThan(0); }
      if (tile.y === 0) { vertical = true; expect(tile.vy).toBeGreaterThan(0); }
      if (tile.y === height - BUTTON_HEIGHT * BOUNCE_FLY_SCALE) { vertical = true; expect(tile.vy).toBeLessThan(0); }
    }
    expect(horizontal).toBe(true); expect(vertical).toBe(true);
  });
  it("waits for valid measured bounds and clears old positions when the effect stops", () => {
    const h = renderHook((p: { activeSabotage: SabotageEffect | null; optionCount: number; bounds: { width: number; height: number } | null }) => useTrampolineOptions(p), { initialProps: { activeSabotage: "trampoline", optionCount: 2, bounds: null } });
    frame(0); expect(h.result.current.trampolineOptions).toEqual([]); expect(callbacks.size).toBe(0);
    h.rerender({ activeSabotage: "trampoline", optionCount: 2, bounds: { width: 0, height: 500 } });
    expect(callbacks.size).toBe(0);
    h.rerender({ activeSabotage: "trampoline", optionCount: 2, bounds: { width: 600, height: 0 } });
    expect(callbacks.size).toBe(0);
    h.rerender({ activeSabotage: "trampoline", optionCount: 2, bounds: { width: 600, height: 500 } });
    frame(0); expect(h.result.current.trampolineOptions).toHaveLength(2);
    h.rerender({ activeSabotage: null, optionCount: 2, bounds: { width: 600, height: 500 } });
    expect(h.result.current.trampolineOptions).toEqual([]); expect(callbacks.size).toBe(0);
    h.rerender({ activeSabotage: "trampoline", optionCount: 2, bounds: { width: 600, height: 500 } });
    expect(h.result.current.trampolineOptions).toEqual([]); frame(0); expect(h.result.current.trampolineOptions[0].phase).toBe("shaking");
    h.unmount(); expect(cancel).toHaveBeenCalled(); expect(callbacks.size).toBe(0);
  });
  it("uses window bounds when none are supplied and skips empty option sets", () => {
    const h = renderHook(({ count }) => useBounceOptions({ activeSabotage: "bounce", optionCount: count }), { initialProps: { count: 0 } });
    expect(callbacks.size).toBe(0);
    h.rerender({ count: 2 }); frame(0);
    expect(h.result.current.bouncingOptions).toHaveLength(2);
    expect(h.result.current.bouncingOptions.every(o => o.x >= 0 && o.x < window.innerWidth)).toBe(true);
  });
});
