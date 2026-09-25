import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { SoloQuestion } from "@/app/solo/[sessionId]/components/SoloQuestion";
import { initializeSoloSession } from "@/lib/soloPracticeRuntime";
function props() {
  return { session: initializeSoloSession({ items: [{ kind: "word", maxLevel: 3 }], initialConfidenceByItemIndex: null, random: () => 0 }), currentWord: { kind: "word" as const, word: "cat", answer: "gato", wrongAnswers: ["perro", "pez", "ave"], themeId: "theme_1" as Id<"themes">, themeName: "Animals" }, cueText: "cat", helperText: "Translate to Spanish", expectedAnswer: "gato", hasMultipleThemes: true, showFeedback: false, feedbackCorrect: false, feedbackAnswer: null, onCorrect: vi.fn(), onIncorrect: vi.fn(), onLevel0GotIt: vi.fn(), onLevel0NotYet: vi.fn() };
}
describe("solo question input dispatch", () => {
  it("renders recognition without a duplicated cue and wires both recall decisions", () => {
    const p = props(); render(<SoloQuestion {...p} session={{ ...p.session, questionLevel: 0 }} />);
    expect(screen.getAllByText("Animals")).toHaveLength(1);
    fireEvent.click(screen.getByTestId("solo-practice-level0-got-it"));
    fireEvent.click(screen.getByTestId("solo-practice-level0-not-yet"));
    expect(p.onLevel0GotIt).toHaveBeenCalledOnce(); expect(p.onLevel0NotYet).toHaveBeenCalledOnce();
    expect(p.onCorrect).not.toHaveBeenCalled();
  });
  it("uses guided input for forward level one and routes skip to an incorrect answer", () => {
    const p = props(); render(<SoloQuestion {...p} session={{ ...p.session, questionLevel: 1, translationDirection: "forward" }} />);
    expect(screen.getByText("Translate to Spanish")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("solo-practice-level1-skip"));
    expect(p.onIncorrect).toHaveBeenCalledOnce();
  });
  it.each([
    [1, "reverse", "solo-practice-level1-reverse"],
    [2, "forward", "solo-practice-level2-typing"],
    [3, "forward", "solo-practice-level3"],
  ] as const)("routes level %s %s typed answers to the correct callback", (questionLevel, translationDirection, id) => {
    const p = props(); render(<SoloQuestion {...p} session={{ ...p.session, questionLevel, translationDirection, level2Mode: "typing" }} />);
    const input = screen.queryByTestId(`${id}-input`);
    expect(input).not.toBeNull();
    fireEvent.change(input!, { target: { value: "gato" } }); fireEvent.keyDown(input!, { key: "Enter" });
    expect(p.onCorrect).toHaveBeenCalledExactlyOnceWith("gato"); expect(p.onIncorrect).not.toHaveBeenCalled();
  });
  it("uses multiple choice for the level two choice mode", () => {
    const p = props(); render(<SoloQuestion {...p} session={{ ...p.session, questionLevel: 2, level2Mode: "multiple_choice" }} />);
    fireEvent.click(screen.getByRole("button", { name: "gato" }));
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }));
    expect(p.onCorrect).toHaveBeenCalledOnce(); expect(p.onIncorrect).not.toHaveBeenCalled();
  });
  it.each([false, true])("shows feedback correct=%s instead of live answer inputs", feedbackCorrect => {
    const p = props();
    render(<SoloQuestion {...p} hasMultipleThemes={false} showFeedback feedbackCorrect={feedbackCorrect} feedbackAnswer={feedbackCorrect ? null : "gato"} />);
    expect(screen.getByText(feedbackCorrect ? "Correct" : "Wrong")).toBeInTheDocument();
    expect(screen.queryByText("Animals")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("Answer:") !== null).toBe(!feedbackCorrect);
  });
});
