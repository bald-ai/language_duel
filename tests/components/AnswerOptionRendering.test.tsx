import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnswerOptionButton, computeOptionState, type OptionContext } from "@/app/duel/[duelId]/components/AnswerOptionButton";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { cssVarColors as colors } from "@/app/components/themeCssVars";
function context(overrides: Partial<OptionContext> = {}): OptionContext {
  return { answer: "gato", selectedAnswer: null, correctAnswer: "gato", hasNoneOption: false, isShowingFeedback: false, eliminatedOptions: [], canEliminate: false, opponentAnswer: null, showOpponentPick: false, ...overrides };
}
describe("answer option states and rendering", () => {
  it.each([
    ["gato", {}, false, colors.primary.dark],
    ["gato", { selectedAnswer: "gato" }, false, colors.secondary.DEFAULT],
    ["gato", { selectedAnswer: "gato", isShowingFeedback: true }, true, colors.status.success.DEFAULT],
    ["perro", { selectedAnswer: "perro", isShowingFeedback: true }, true, colors.status.danger.DEFAULT],
    ["gato", { isShowingFeedback: true }, true, colors.status.success.DEFAULT],
    ["perro", { isShowingFeedback: true }, true, colors.neutral.dark],
    ["perro", { isShowingFeedback: true, canEliminate: true }, false, colors.status.warning.DEFAULT],
    ["perro", { isShowingFeedback: true, canEliminate: true, eliminatedOptions: ["perro"] }, true, colors.neutral.dark],
  ] as const)("applies visual precedence to %s with %j", (answer, changes, disabled, borderColor) => {
    const state = computeOptionState(answer, context({ ...changes, eliminatedOptions: "eliminatedOptions" in changes ? [...changes.eliminatedOptions] : [] }));
    const onClick = vi.fn();
    render(<AnswerOptionButton answer={answer} displayText={answer} state={state} onClick={onClick} dataTestId="answer" style={{ left: 23, borderColor: "pink" }} />);
    const button = screen.getByTestId("answer") as HTMLButtonElement;
    expect(button.disabled).toBe(disabled); expect(state.style.borderColor).toBe(borderColor);
    expect(button.style.borderColor).toBe(borderColor); expect(button.style.left).toBe("23px");
    fireEvent.click(button); expect(onClick).toHaveBeenCalledTimes(disabled ? 0 : 1);
    expect(button.classList.contains("opacity-50")).toBe(disabled && !state.isEliminated && !state.isSelected && !state.isCorrectOption);
    expect(button.classList.contains("line-through")).toBe(state.isEliminated);
    expect(button.classList.contains("animate-pulse")).toBe(state.canEliminateThis);
  });
  it.each([
    [NONE_OF_ABOVE, true, true, false],
    [NONE_OF_ABOVE, false, false, true],
    ["perro", true, false, true],
    ["gato", false, true, false],
  ] as const)("derives correctness and elimination for %s when None is correct=%s", (answer, hasNoneOption, correct, eliminable) => {
    const state = computeOptionState(answer, context({ hasNoneOption, canEliminate: true }));
    expect(state.isCorrectOption).toBe(correct); expect(state.canEliminateThis).toBe(eliminable);
  });
  it("does not reveal correctness or allow elimination with incomplete answer disclosure", () => {
    expect(computeOptionState("gato", context({ hasNoneOption: null, canEliminate: true }))).toMatchObject({ isCorrectOption: false, canEliminateThis: false });
    expect(computeOptionState("gato", context({ correctAnswer: null, canEliminate: true }))).toMatchObject({ isCorrectOption: false, canEliminateThis: false });
  });
  it("reveals the None answer progressively, hides the cursor at completion, and shows revealed correctness", () => {
    const state = computeOptionState(NONE_OF_ABOVE, context({ hasNoneOption: true, isShowingFeedback: true }));
    const props = { answer: NONE_OF_ABOVE, displayText: NONE_OF_ABOVE, state, onClick: vi.fn(), hasNoneOption: true, isShowingFeedback: true, showTypeReveal: true };
    const { rerender } = render(<AnswerOptionButton {...props} typedText="ga" />);
    expect(screen.getByRole("button").textContent).toBe("ga|✓");
    rerender(<AnswerOptionButton {...props} typedText="gato" revealComplete />);
    expect(screen.getByRole("button").textContent).toBe("gato✓");
    rerender(<AnswerOptionButton {...props} showTypeReveal={false} />);
    expect(screen.getByRole("button").textContent).toBe(`${NONE_OF_ABOVE}✓`);
    rerender(<AnswerOptionButton {...props} hasNoneOption={false} />);
    expect(screen.getByRole("button").textContent).toBe(NONE_OF_ABOVE);
  });
  it("marks the opponent's revealed pick and truncates transformed flying labels", () => {
    const state = computeOptionState("perro", context({ opponentAnswer: "perro", showOpponentPick: true, canEliminate: true }));
    const { rerender } = render(<AnswerOptionButton answer="perro" displayText="orrep" state={state} onClick={vi.fn()} isFlying />);
    expect(screen.getByRole("button").textContent).toBe("orrep✕👤");
    expect(screen.getByText("orrep")).toHaveClass("truncate");
    expect(screen.getByRole("button")).toHaveClass("transition-colors");
    rerender(<AnswerOptionButton answer="perro" displayText="perro" state={computeOptionState("perro", context({ opponentAnswer: "perro", showOpponentPick: false }))} onClick={vi.fn()} />);
    expect(screen.getByRole("button").textContent).toBe("perro");
  });
});
