import { describe, expect, it } from "vitest";
import { computeOptionState, type OptionContext } from "@/app/duel/[duelId]/components/AnswerOptionButton";

function optionContext(overrides: Partial<OptionContext> = {}): OptionContext {
  return {
    answer: "perro",
    selectedAnswer: null,
    correctAnswer: null,
    hasNoneOption: null,
    isShowingFeedback: false,
    eliminatedOptions: [],
    canEliminate: true,
    opponentLastAnswer: null,
    status: "active",
    frozenData: null,
    ...overrides,
  };
}

describe("computeOptionState", () => {
  it("does not allow elimination until the backend has revealed the answer", () => {
    const state = computeOptionState("perro", optionContext());

    expect(state.canEliminateThis).toBe(false);
    expect(state.isCorrectOption).toBe(false);
  });

  it("allows eliminating revealed wrong answers", () => {
    const state = computeOptionState(
      "perro",
      optionContext({
        correctAnswer: "gato",
        hasNoneOption: false,
      })
    );

    expect(state.canEliminateThis).toBe(true);
    expect(state.isCorrectOption).toBe(false);
  });
});
