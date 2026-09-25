import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSyncUser } from "@/hooks/useSyncUser";
const state = vi.hoisted(() => ({ user: null as { id: string } | null, sync: vi.fn() }));
vi.mock("@clerk/nextjs", () => ({ useUser: () => ({ user: state.user }) }));
vi.mock("convex/react", () => ({ useMutation: () => state.sync }));
beforeEach(() => { state.user = null; state.sync.mockReset().mockResolvedValue(undefined); });

describe("signed-in user synchronization", () => {
  it("waits for sign-in and skips already synchronized identities across profile changes", async () => {
    const hook = renderHook(() => useSyncUser());
    expect(state.sync).not.toHaveBeenCalled();
    state.user = { id: "clerk_a" };
    hook.rerender();
    await act(async () => {});
    expect(state.sync).toHaveBeenCalledExactlyOnceWith({ clerkId: "clerk_a" });
    state.user = { id: "clerk_a" };
    hook.rerender();
    await act(async () => {});
    expect(state.sync).toHaveBeenCalledTimes(1);
    state.user = null;
    hook.rerender();
    expect(state.sync).toHaveBeenCalledTimes(1);
  });

  it("queues only the latest identity during an in-flight sync and starts it after completion", async () => {
    let finish!: () => void;
    state.sync.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    state.user = { id: "clerk_a" };
    const hook = renderHook(() => useSyncUser());
    state.user = { id: "clerk_b" };
    hook.rerender();
    state.user = { id: "clerk_c" };
    hook.rerender();
    expect(state.sync).toHaveBeenCalledTimes(1);
    await act(async () => { finish(); });
    expect(state.sync.mock.calls).toEqual([[{ clerkId: "clerk_a" }], [{ clerkId: "clerk_c" }]]);
    state.user = { id: "clerk_c" };
    hook.rerender();
    await act(async () => {});
    expect(state.sync).toHaveBeenCalledTimes(2);
  });

  it("discards a queued profile refresh when the same identity has just finished syncing", async () => {
    let finish!: () => void;
    state.sync.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
    state.user = { id: "clerk_a" };
    const hook = renderHook(() => useSyncUser());
    state.user = { id: "clerk_a" };
    hook.rerender();
    await act(async () => { finish(); });
    expect(state.sync).toHaveBeenCalledTimes(1);
  });
});
