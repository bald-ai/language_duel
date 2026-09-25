import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { useSoloPracticeLauncher } from "@/hooks/useSoloPracticeLauncher";
const { push, router } = vi.hoisted(() => { const push = vi.fn(); return { push, router: { push } }; });
vi.mock("next/navigation", () => ({ useRouter: () => router }));
beforeEach(() => { vi.clearAllMocks(); });
const themes = ["theme_a", "theme_b"] as Id<"themes">[];

describe("solo practice launcher", () => {
  it("requires a selection and opens the selected learning themes with the requested duration", () => {
    const launched = vi.fn();
    const { result } = renderHook(() => useSoloPracticeLauncher(launched));
    act(() => result.current([], "learn_practice", 300));
    expect(push).not.toHaveBeenCalled();
    expect(launched).not.toHaveBeenCalled();
    act(() => result.current(themes, "learn_practice", 300));
    expect(push).toHaveBeenCalledOnce();
    const url = new URL(push.mock.calls[0][0], "https://example.test");
    expect(url.pathname).toMatch(/^\/solo\/learn\/[0-9a-f-]{36}$/);
    expect(url.searchParams.get("themeIds")).toBe("theme_a,theme_b");
    expect(url.searchParams.get("duration")).toBe("300");
    expect(launched).toHaveBeenCalledOnce();
    expect(push.mock.invocationCallOrder[0]).toBeLessThan(launched.mock.invocationCallOrder[0]);
  });

  it("launches practice directly with a fresh session and supports a caller without a completion callback", () => {
    const { result } = renderHook(() => useSoloPracticeLauncher());
    act(() => result.current([themes[0]], "practice_only"));
    act(() => result.current([themes[0]], "practice_only"));
    const urls = push.mock.calls.map(([path]) => new URL(path, "https://example.test"));
    expect(urls[0].pathname).toMatch(/^\/solo\/[0-9a-f-]{36}$/);
    expect(urls[0].pathname).not.toBe(urls[1].pathname);
    expect(urls[0].searchParams.get("themeId")).toBe("theme_a");
    expect(urls[0].searchParams.get("themeIds")).toBe("theme_a");
    expect(urls[0].searchParams.has("duration")).toBe(false);
  });
});
