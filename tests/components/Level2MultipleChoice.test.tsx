import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { Level2MultipleChoice } from "@/app/game/levels/Level2MultipleChoice";
import { cssVarColors } from "@/app/components/themeCssVars";

describe("Level2MultipleChoice", () => {
  const answer = "gato";
  const wrongAnswers = ["perro", "casa", "mesa", "silla", "libro"];

  it("selects and confirms answer", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();
    const onSkip = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        dataTestIdBase="level2-mc"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: answer }));
    fireEvent.click(screen.getByTestId("level2-mc-confirm"));

    expect(onCorrect).toHaveBeenCalledWith(answer);
    expect(onWrong).not.toHaveBeenCalled();
  });

  it("wrong answer calls onWrong", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();
    const onSkip = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        dataTestIdBase="level2-mc"
      />
    );

    const wrongButton = screen
      .getAllByRole("button")
      .find(
        (btn) =>
          btn.textContent !== answer &&
          btn.textContent !== "Don't Know" &&
          btn.textContent !== "Confirm"
      );
    expect(wrongButton).toBeTruthy();
    fireEvent.click(wrongButton!);
    fireEvent.click(screen.getByTestId("level2-mc-confirm"));

    expect(onWrong).toHaveBeenCalled();
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("distinguishes the correct answer, selected mistake, and unused options after submission", () => {
    const onWrong = vi.fn();
    render(<Level2MultipleChoice answer={answer} wrongAnswers={wrongAnswers} onCorrect={vi.fn()} onWrong={onWrong} onSkip={vi.fn()} dataTestIdBase="feedback" />);
    const options = screen.getAllByTestId(/^feedback-option-/) as HTMLButtonElement[];
    const selected = options.find(option => option.textContent !== answer)!;
    fireEvent.click(selected);
    expect(selected.style.borderColor).toBe(cssVarColors.secondary.DEFAULT);
    fireEvent.click(screen.getByTestId("feedback-confirm"));
    for (const option of options) {
      expect(option.disabled).toBe(true);
      if (option.textContent === answer) expect(option.style.borderColor).toBe(cssVarColors.status.success.DEFAULT);
      else if (option === selected) expect(option.style.borderColor).toBe(cssVarColors.status.danger.DEFAULT);
      else expect(option.classList.contains("opacity-50")).toBe(true);
      fireEvent.click(option);
    }
    expect(onWrong).toHaveBeenCalledExactlyOnceWith(selected.textContent);
  });

  it("keyboard ArrowDown and Enter submits a selected option", async () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={vi.fn()}
        dataTestIdBase="level2-mc"
      />
    );

    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });

    await waitFor(() => {
      const totalCalls = onCorrect.mock.calls.length + onWrong.mock.calls.length;
      expect(totalCalls).toBeGreaterThanOrEqual(1);
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
