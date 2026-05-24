import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { Level2MultipleChoice } from "@/app/game/levels/Level2MultipleChoice";

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
