import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import type { SessionItem } from "@/lib/sessionItems";
import { useSoloLearnState } from "@/app/solo/learn/[sessionId]/hooks/useSoloLearnState";
const sessionItems: SessionItem[] = [
  { kind: "word", word: "cat", answer: "gato", wrongAnswers: ["perro"], themeId: "theme" as Id<"themes">, themeName: "Basics" },
  { kind: "sentence", englishPrompt: "I eat", spanishSentence: "Yo como", wordMeanings: ["I", "eat"], freeWordPositions: [], distractors: ["bebo"], themeId: "theme" as Id<"themes">, themeName: "Basics" },
];
const params = { sessionItems, sessionSourceKey: "source", sessionId: "session" };
beforeEach(() => sessionStorage.clear());

it("counts each letter hint once and resets one item without losing another reveal", () => {
  const { result } = renderHook(() => useSoloLearnState(params));
  act(() => result.current.revealLetter("source-0", 1));
  act(() => result.current.revealLetter("source-0", 1));
  expect(result.current.hintStates["source-0"]).toEqual({ hintCount: 1, revealedPositions: [1] });
  act(() => result.current.revealLetter("source-0", 3));
  expect(result.current.hintStates["source-0"]).toEqual({ hintCount: 2, revealedPositions: [1, 3] });
  act(() => result.current.revealAllPositions("source-1", [0, 1]));
  act(() => result.current.resetWord("source-0"));
  expect(result.current.hintStates["source-0"]).toBeUndefined();
  expect(result.current.hintStates["source-1"]).toEqual({ hintCount: 2, revealedPositions: [0, 1] });
  act(() => result.current.revealFullWord("source-0", "gato"));
  expect(result.current.hintStates["source-0"]).toEqual({ hintCount: 4, revealedPositions: [0, 1, 2, 3] });
});

it("reveals letters for words and tokens for sentences, then hides the whole deck", () => {
  const { result } = renderHook(() => useSoloLearnState(params));
  act(() => result.current.toggleRevealAll());
  expect(result.current.isAllRevealed).toBe(true);
  expect(result.current.hintStates).toEqual({
    "source-0": { hintCount: 4, revealedPositions: [0, 1, 2, 3] },
    "source-1": { hintCount: 2, revealedPositions: [0, 1] },
  });
  act(() => result.current.toggleRevealAll());
  expect(result.current.isAllRevealed).toBe(false);
  expect(result.current.hintStates).toEqual({});
});

it("caps bulk confidence per item and persists legend dismissal for this session", () => {
  const hook = renderHook(() => useSoloLearnState(params));
  act(() => hook.result.current.setIsSetAllOpen(true));
  act(() => hook.result.current.setAllConfidence(3));
  expect(hook.result.current.getConfidence("source-0")).toBe(3);
  expect(hook.result.current.getConfidence("source-1", 1)).toBe(1);
  expect(hook.result.current.isSetAllOpen).toBe(false);
  act(() => hook.result.current.setConfidence("source-0", 2));
  expect(hook.result.current.getConfidence("source-0")).toBe(2);
  act(() => hook.result.current.dismissConfidenceLegend());
  expect(sessionStorage.getItem("soloLearnConfidenceLegendDismissed:session:source")).toBe("1");
  hook.unmount();
  const remount = renderHook(() => useSoloLearnState(params));
  expect(remount.result.current.isConfidenceLegendDismissed).toBe(true);
});
