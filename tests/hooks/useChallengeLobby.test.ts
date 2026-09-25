import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { useChallengeLobby } from "@/hooks/useChallengeLobby";
const state = vi.hoisted(() => {
  const push = vi.fn();
  return { push, router: { push }, error: vi.fn(), success: vi.fn(), calls: vi.fn(), mutations: new Map<string, ReturnType<typeof vi.fn>>() };
});
vi.mock("next/navigation", () => ({ useRouter: () => state.router }));
vi.mock("sonner", () => ({ toast: { error: state.error, success: state.success } }));
vi.mock("convex/react", () => ({
  useMutation: (ref: Parameters<typeof getFunctionName>[0]) => {
    const name = getFunctionName(ref);
    if (!state.mutations.has(name)) state.mutations.set(name, vi.fn().mockResolvedValue(undefined));
    return state.mutations.get(name);
  },
  useQuery: (ref: Parameters<typeof getFunctionName>[0], args: unknown) => {
    const name = getFunctionName(ref); state.calls(name, args);
    if (args === "skip") return undefined;
    if (name === "users:getCurrentUser") return { _id: "viewer", name: "Alice" };
    if (name === "themes:getThemes") return [{ _id: "theme", name: "Animals", contentType: "word", words: [{ word: "cat" }] }];
    if (name === "challenges:getChallenge") return null;
    return [];
  },
}));
beforeEach(() => { vi.clearAllMocks(); state.mutations.clear(); });
const options = { opponentId: "viewer" as Id<"users">, themeIds: ["theme"] as Id<"themes">[], duelDifficultyPreset: "hard" as const, duelMode: "pvp" as const };

it("loads on opening, launches a self duel, and exposes joining only while the request is pending", async () => {
  const h = renderHook(useChallengeLobby);
  expect(state.calls).toHaveBeenCalledWith("themes:getThemes", "skip");
  act(() => h.result.current.openChallengeModal(options.opponentId));
  expect(h.result.current.showChallengeModal).toBe(true);
  expect(state.calls).toHaveBeenCalledWith("themes:getThemes", {});
  let finish!: (value: { duelId: string }) => void;
  state.mutations.get("challenges:createSelfDuel")!.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  let pending!: Promise<void>;
  act(() => { pending = h.result.current.handleCreateChallenge(options); });
  expect(h.result.current.isJoiningDuel).toBe(true);
  expect(h.result.current.showChallengeModal).toBe(false);
  expect(state.push).not.toHaveBeenCalled();
  await act(async () => { finish({ duelId: "self_duel" }); await pending; });
  expect(state.mutations.get("challenges:createSelfDuel")).toHaveBeenCalledExactlyOnceWith({ themeIds: ["theme"], duelDifficultyPreset: "hard" });
  expect(state.mutations.get("challenges:createChallenge")).not.toHaveBeenCalled();
  expect(state.push).toHaveBeenCalledExactlyOnceWith("/duel/self_duel");
  expect(h.result.current.isJoiningDuel).toBe(false);
});

it("reports failed self-duel creation and clears joining without navigating", async () => {
  const failure = new Error("offline");
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const h = renderHook(useChallengeLobby);
  act(() => h.result.current.openChallengeModal(options.opponentId));
  state.mutations.get("challenges:createSelfDuel")!.mockRejectedValueOnce(failure);
  await act(async () => h.result.current.handleCreateChallenge(options));
  expect(state.error).toHaveBeenCalledWith("Failed to start duel. Please try again.");
  expect(log).toHaveBeenCalledWith("Failed to start self-duel:", failure);
  expect(h.result.current.isJoiningDuel).toBe(false);
  expect(state.push).not.toHaveBeenCalled();
  log.mockRestore();
});

it("creates a friend challenge, shows waiting, and cancels the same invitation", async () => {
  const h = renderHook(useChallengeLobby);
  act(() => h.result.current.openChallengeModal("friend" as Id<"users">));
  state.mutations.get("challenges:createChallenge")!.mockResolvedValueOnce("challenge");
  await act(async () => h.result.current.handleCreateChallenge({ ...options, opponentId: "friend" as Id<"users"> }));
  expect(state.mutations.get("challenges:createChallenge")).toHaveBeenCalledExactlyOnceWith({ ...options, opponentId: "friend" });
  expect(h.result.current.showChallengeModal).toBe(false);
  expect(h.result.current.showWaitingModal).toBe(true);
  await act(async () => h.result.current.handleCancelWaiting());
  expect(state.mutations.get("challenges:cancelChallenge")).toHaveBeenCalledExactlyOnceWith({ challengeId: "challenge" });
  expect(h.result.current.showWaitingModal).toBe(false);
});

it.each([false, true])("declines a received invitation and reports the result (fails=%s)", async fails => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const h = renderHook(useChallengeLobby);
  if (fails) state.mutations.get("challenges:declineChallenge")!.mockRejectedValueOnce(new Error("offline"));
  await act(async () => h.result.current.handleDeclineChallenge("invitation" as Id<"challenges">));
  expect(state.mutations.get("challenges:declineChallenge")).toHaveBeenCalledExactlyOnceWith({ challengeId: "invitation" });
  if (fails) expect(state.error).toHaveBeenCalledWith("Failed to decline challenge. Please try again.");
  else expect(state.success).toHaveBeenCalledWith("Challenge declined");
  expect(state.push).not.toHaveBeenCalled();
  log.mockRestore();
});

it("launches solo practice or opens themes and closes the source modal", () => {
  const h = renderHook(useChallengeLobby);
  act(() => h.result.current.openSoloPracticeModal());
  expect(h.result.current.showSoloPracticeModal).toBe(true);
  act(() => h.result.current.handleContinueSoloPractice(options.themeIds, "practice_only"));
  expect(h.result.current.showSoloPracticeModal).toBe(false);
  expect(state.push.mock.calls[0][0]).toMatch(/^\/solo\/[^/]+\?themeId=theme&themeIds=theme$/);
  act(() => h.result.current.openChallengeModal());
  act(() => h.result.current.navigateToThemes());
  expect(h.result.current.showChallengeModal).toBe(false);
  expect(state.push).toHaveBeenLastCalledWith("/themes");
});
