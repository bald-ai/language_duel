import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { useChallengeWizard } from "@/app/components/modals/useChallengeWizard";

const viewer = { _id: "me" as Id<"users">, name: "Me" };
const friend = { _id: "friend" as Id<"users">, name: "Friend" };
const wordId = "word" as Id<"themes">;
const sentenceId = "sentence" as Id<"themes">;
function input(overrides: Partial<Parameters<typeof useChallengeWizard>[0]> = {}) {
  return { viewer, users: [friend], themes: [
    { _id: wordId, name: "Words", contentType: "word" as const, itemCount: 2 },
    { _id: sentenceId, name: "Sentences", contentType: "sentence" as const, itemCount: 2 },
  ], onCreateChallenge: vi.fn(), isJoiningDuel: false, isCreatingChallenge: false, ...overrides };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("challenge wizard selection and animation", () => {
  it("rejects creating before selecting an opponent and a theme", () => {
    const props = input(); const { result } = renderHook(useChallengeWizard, { initialProps: props });
    act(() => { result.current.handleCreateChallenge(); result.current.handleNext(); result.current.handleBack(); });
    expect(result.current.activeStep).toBe("opponent");
    act(() => result.current.handleSelectOpponent(friend._id));
    act(() => result.current.handleCreateChallenge());
    expect(props.onCreateChallenge).not.toHaveBeenCalled();
    expect(result.current.primaryDisabled).toBe(true);
  });
  it("Relay bypasses difficulty and sends no preset", () => {
    const props = input({ initialOpponentId: friend._id });
    const { result } = renderHook(useChallengeWizard, { initialProps: props });
    act(() => result.current.handleThemeIdsChange([wordId, sentenceId]));
    act(() => result.current.handleNext());
    act(() => result.current.handleSelectMode("relay"));
    expect(result.current.steps).toEqual(["opponent", "theme", "mode", "confirm"]);
    act(() => result.current.handleCreateChallenge());
    expect(props.onCreateChallenge).toHaveBeenCalledWith({ opponentId: friend._id, themeIds: [wordId, sentenceId], duelMode: "relay", duelDifficultyPreset: undefined });
    act(() => result.current.handleBack());
    expect(result.current.activeStep).toBe("mode");
    act(() => result.current.handleNext());
    expect(result.current.activeStep).toBe("confirm");
  });
  it("Tag Team requires exclusively sentence themes and resets after a word is added", () => {
    const { result } = renderHook(useChallengeWizard, { initialProps: input({ initialOpponentId: friend._id }) });
    act(() => result.current.handleThemeIdsChange([wordId]));
    act(() => result.current.handleNext());
    act(() => result.current.handleSelectMode("tbt"));
    expect(result.current.selectedMode).toBe("pvp");
    expect(result.current.activeStep).toBe("mode");
    act(() => result.current.handleThemeIdsChange([sentenceId]));
    expect(result.current.disabledModes).toBeUndefined();
    act(() => result.current.handleSelectMode("tbt"));
    act(() => result.current.handleNext());
    expect(result.current.activeStep).toBe("confirm");
    act(() => result.current.handleThemeIdsChange([sentenceId, wordId]));
    expect(result.current.selectedMode).toBe("pvp");
    expect(result.current.disabledModes?.tbt).toBe("Needs an all-sentence deck");
  });
  it("a changed server theme list blocks an invalid selected mode until a valid mode is chosen", () => {
    const props = input({ initialOpponentId: friend._id });
    const { result, rerender } = renderHook(useChallengeWizard, { initialProps: props });
    act(() => result.current.handleThemeIdsChange([sentenceId]));
    act(() => result.current.handleNext());
    act(() => result.current.handleSelectMode("tbt"));
    act(() => result.current.handleBack());
    rerender({ ...props, themes: [] });
    expect(result.current.primaryDisabled).toBe(true);
    act(() => { result.current.handleNext(); result.current.handleCreateChallenge(); });
    expect(result.current.activeStep).toBe("mode");
    expect(props.onCreateChallenge).not.toHaveBeenCalled();
  });
  it("self practice omits mode and keeps its difficulty, creating status and submit gate", () => {
    const props = input({ initialOpponentId: viewer._id });
    const { result, rerender } = renderHook(useChallengeWizard, { initialProps: props });
    act(() => result.current.handleThemeIdsChange([wordId]));
    act(() => result.current.handleNext());
    expect(result.current.steps).toEqual(["opponent", "theme", "difficulty", "confirm"]);
    act(() => result.current.handleSelectDifficulty("hard"));
    expect(result.current.primaryLabel).toBe("Start practice");
    rerender({ ...props, isCreatingChallenge: true });
    expect(result.current.primaryLabel).toBe("Creating...");
    expect(result.current.primaryDisabled).toBe(true);
  });
  it("animates exit and entry while preventing competing actions, and cancels pending timers on unmount", () => {
    vi.useFakeTimers(); vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    const { result, unmount } = renderHook(useChallengeWizard, { initialProps: input() });
    act(() => result.current.handleSelectOpponent(friend._id));
    expect(result.current.flowClassName).toBe("duel-flow-exit-forward");
    act(() => {
      result.current.handleSelectOpponent(viewer._id); result.current.handleSelectMode("relay");
      result.current.handleSelectDifficulty("hard"); result.current.handleNext(); result.current.handleBack();
    });
    expect(result.current.selectedOpponentId).toBe(friend._id);
    expect(result.current.selectedMode).toBe("pvp");
    expect(result.current.selectedDifficulty).toBe("easy");
    act(() => vi.advanceTimersByTime(105));
    expect(result.current.activeStep).toBe("theme");
    expect(result.current.flowClassName).toBe("duel-flow-enter-forward");
    act(() => vi.advanceTimersByTime(210));
    expect(result.current.flowClassName).toBe("");
    act(() => result.current.handleBack());
    expect(result.current.flowClassName).toBe("duel-flow-exit-back");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("respects reduced motion and optional unloaded users/themes", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const { result } = renderHook(useChallengeWizard, { initialProps: input({ viewer: null, users: undefined, themes: undefined }) });
    act(() => result.current.handleSelectOpponent(friend._id));
    expect(result.current.activeStep).toBe("theme");
    expect(result.current.selectedOpponent).toBeNull();
    act(() => result.current.handleThemeIdsChange([wordId]));
    expect(result.current.disabledModes?.tbt).toBeTruthy();
  });
  it("returns to theme selection when the last selected theme is removed", () => {
    const { result } = renderHook(useChallengeWizard, { initialProps: input({ initialOpponentId: friend._id }) });
    act(() => result.current.handleThemeIdsChange([wordId]));
    act(() => result.current.handleNext());
    act(() => result.current.handleThemeIdsChange([]));
    expect(result.current.activeStep).toBe("theme");
    expect(result.current.primaryDisabled).toBe(true);
  });
});
