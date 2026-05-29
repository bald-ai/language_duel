import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePickAndPruneSentence } from "@/app/themes/hooks/usePickAndPruneSentence";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";

const rounds: SentenceRoundInput[] = [
  { englishPrompt: "I eat bread", spanishSentence: "Yo como pan", distractors: ["Tú", "bebes", "agua"] },
  { englishPrompt: "You drink water", spanishSentence: "Tú bebes agua", distractors: ["Yo", "como", "pan"] },
  { englishPrompt: "The cat sleeps", spanishSentence: "El gato duerme", distractors: ["perro", "corre", "salta"] },
];

describe("usePickAndPruneSentence", () => {
  it("initializes active rounds and moves remove/restore in original order", () => {
    const { result } = renderHook(() => usePickAndPruneSentence());

    act(() => {
      result.current.initialize(rounds);
    });

    expect(result.current.activeRounds).toHaveLength(3);
    expect(result.current.removedRounds).toHaveLength(0);
    expect(result.current.removedOpen).toBe(false);

    const removedId = result.current.activeRounds[1]?.id;
    if (!removedId) throw new Error("Expected a removable round");

    act(() => {
      result.current.removeRound(removedId);
    });

    expect(result.current.activeRounds.map((entry) => entry.round.englishPrompt)).toEqual([
      "I eat bread",
      "The cat sleeps",
    ]);
    expect(result.current.removedRounds.map((entry) => entry.round.englishPrompt)).toEqual([
      "You drink water",
    ]);

    act(() => {
      result.current.restoreRound(removedId);
    });

    expect(result.current.activeRounds.map((entry) => entry.round.englishPrompt)).toEqual([
      "I eat bread",
      "You drink water",
      "The cat sleeps",
    ]);
    expect(result.current.removedRounds).toHaveLength(0);
  });

  it("returns the kept rounds for continue and clears all state", () => {
    const { result } = renderHook(() => usePickAndPruneSentence());

    act(() => {
      result.current.initialize(rounds);
    });

    const removedId = result.current.activeRounds[0]?.id;
    if (!removedId) throw new Error("Expected a removable round");

    act(() => {
      result.current.removeRound(removedId);
    });

    expect(result.current.getActiveRounds().map((round) => round.spanishSentence)).toEqual([
      "Tú bebes agua",
      "El gato duerme",
    ]);

    act(() => {
      result.current.requestDiscard();
    });
    expect(result.current.showDiscardConfirm).toBe(true);

    act(() => {
      result.current.clear();
    });

    expect(result.current.activeRounds).toHaveLength(0);
    expect(result.current.removedRounds).toHaveLength(0);
    expect(result.current.showDiscardConfirm).toBe(false);
  });

  it("toggles the removed section open state", () => {
    const { result } = renderHook(() => usePickAndPruneSentence());

    act(() => {
      result.current.initialize(rounds);
    });

    act(() => {
      result.current.setRemovedOpen(true);
    });
    expect(result.current.removedOpen).toBe(true);

    act(() => {
      result.current.cancelDiscard();
    });
    expect(result.current.showDiscardConfirm).toBe(false);
  });
});
