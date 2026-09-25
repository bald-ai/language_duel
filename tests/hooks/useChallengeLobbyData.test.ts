import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { useChallengeData } from "@/hooks/challengeLobby/useChallengeData";
import { useChallengeStatusWatcher } from "@/hooks/challengeLobby/useChallengeStatusWatcher";
import type { Id } from "@/convex/_generated/dataModel";
const state = vi.hoisted(() => ({ rows: {} as Record<string, unknown>, query: vi.fn(), push: vi.fn(), error: vi.fn() }));
vi.mock("convex/react", () => ({ useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => { const name = getFunctionName(ref); state.query(name, args); return state.rows[name]; } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("sonner", () => ({ toast: { error: state.error } }));
beforeEach(() => { state.rows = {}; vi.clearAllMocks(); });
describe("challenge lobby data", () => {
  it.each([false, true])("enables all four queries together (%s)", enabled => {
    const { result } = renderHook(() => useChallengeData(enabled));
    expect(state.query.mock.calls).toEqual([
      ["friends:getFriends", enabled ? {} : "skip"],
      ["themes:getThemes", enabled ? {} : "skip"],
      ["challenges:getPendingChallenges", enabled ? {} : "skip"],
      ["users:getCurrentUser", enabled ? {} : "skip"],
    ]);
    expect(result.current).toEqual({ users: undefined, themes: undefined, viewer: undefined, pendingChallenges: undefined });
  });
  it("retains a signed-out result and loaded empty collections", () => {
    state.rows = { "friends:getFriends": [], "themes:getThemes": [], "challenges:getPendingChallenges": [], "users:getCurrentUser": null };
    const { result } = renderHook(() => useChallengeData(true));
    expect(result.current).toEqual({ users: [], themes: [], viewer: null, pendingChallenges: [] });
  });
  it("projects display identities and counts both theme kinds", () => {
    const viewer = { _id: "user", name: "Alice", nickname: "Al", discriminator: "1234" };
    const pending = [{ challenge: { _id: "challenge" } }];
    state.rows = {
      "friends:getFriends": [{ friendId: "friend", name: "Bob", imageUrl: "https://example.test/avatar.png", nickname: "B", discriminator: "4321", isOnline: true }],
      "themes:getThemes": [{ _id: "words", name: "Animals", contentType: "word", words: [{ word: "cat" }, { word: "dog" }] }, { _id: "sentences", name: "Food", contentType: "sentence", sentenceRounds: [{ spanishSentence: "Yo como" }] }],
      "challenges:getPendingChallenges": pending,
      "users:getCurrentUser": { ...viewer, email: "private@example.test" },
    };
    const { result } = renderHook(() => useChallengeData(true));
    expect(result.current).toEqual({ viewer, pendingChallenges: pending, users: [{ _id: "friend", name: "Bob", imageUrl: "https://example.test/avatar.png", nickname: "B", discriminator: "4321" }], themes: [{ _id: "words", name: "Animals", contentType: "word", itemCount: 2 }, { _id: "sentences", name: "Food", contentType: "sentence", itemCount: 1 }] });
  });
});
describe("challenge lobby status watcher", () => {
  function mount(waitingChallengeId: Id<"challenges"> | null = "challenge" as Id<"challenges">) {
    const onAccepted = vi.fn(), onDeclined = vi.fn();
    const hook = renderHook(() => useChallengeStatusWatcher({ waitingChallengeId, onAccepted, onDeclined }));
    return { ...hook, onAccepted, onDeclined };
  }
  it("skips querying when no challenge is waiting", () => {
    mount(null);
    expect(state.query).toHaveBeenCalledWith("challenges:getChallenge", "skip");
    expect(state.push).not.toHaveBeenCalled();
  });
  it.each([undefined, null, { challenge: { status: "pending" } }, { challenge: { status: "accepted" } }])("waits until an accepted duel is available (%j)", value => {
    state.rows["challenges:getChallenge"] = value;
    const h = mount();
    expect(h.onAccepted).not.toHaveBeenCalled(); expect(h.onDeclined).not.toHaveBeenCalled();
    expect(state.push).not.toHaveBeenCalled(); expect(state.error).not.toHaveBeenCalled();
  });
  it("opens the accepted duel and clears the waiting state", () => {
    state.rows["challenges:getChallenge"] = { challenge: { status: "accepted", duelId: "duel" } };
    const h = mount();
    expect(state.query).toHaveBeenCalledWith("challenges:getChallenge", { challengeId: "challenge" });
    expect(state.push).toHaveBeenCalledWith("/duel/duel");
    expect(h.onAccepted).toHaveBeenCalledOnce(); expect(h.onDeclined).not.toHaveBeenCalled();
  });
  it.each(["declined", "cancelled"])("closes %s challenges and only announces a decline", status => {
    state.rows["challenges:getChallenge"] = { challenge: { status } };
    const h = mount();
    expect(h.onDeclined).toHaveBeenCalledOnce(); expect(h.onAccepted).not.toHaveBeenCalled();
    expect(state.push).not.toHaveBeenCalled();
    expect(state.error.mock.calls).toEqual(status === "declined" ? [["Your challenge was declined"]] : []);
  });
});
