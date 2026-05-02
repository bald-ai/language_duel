import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { Level2MultipleChoice } from "@/app/game/levels/Level2MultipleChoice";
import { DONT_KNOW_REVEAL_MS } from "@/app/game/levels/constants";

describe("Level2MultipleChoice", () => {
  const answer = "gato";
  const wrongAnswers = ["perro", "casa", "mesa", "silla", "libro"];

  it("solo mode selects and confirms answer", () => {
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
        mode="solo"
        dataTestIdBase="level2-mc"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: answer }));
    fireEvent.click(screen.getByTestId("level2-mc-confirm"));

    expect(onCorrect).toHaveBeenCalledWith(answer);
    expect(onWrong).not.toHaveBeenCalled();
  });

  it("solo mode wrong answer calls onWrong", () => {
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
        mode="solo"
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

  it("duel mode Don't Know button waits for reveal", () => {
    vi.useFakeTimers();

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
        mode="duel"
        dataTestIdBase="level2-mc"
      />
    );

    fireEvent.click(screen.getByTestId("level2-mc-skip"));
    expect(onSkip).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(DONT_KNOW_REVEAL_MS);
    });

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("duel mode immediate submit calls onWrong for wrong option", () => {
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
        mode="duel"
        dataTestIdBase="level2-mc"
      />
    );

    const wrongButton = screen
      .getAllByRole("button")
      .find(
        (btn) =>
          btn.textContent !== answer &&
          btn.textContent !== "Don't Know"
      );
    expect(wrongButton).toBeTruthy();
    fireEvent.click(wrongButton!);

    expect(onWrong).toHaveBeenCalled();
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("duel mode ignores clicks on eliminated options", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={vi.fn()}
        mode="duel"
        eliminatedOptions={[answer]}
        dataTestIdBase="level2-mc"
      />
    );

    const buttons = screen.getAllByRole("button");
    const answerButton = buttons.find((btn) =>
      btn.textContent?.includes(answer)
    );
    fireEvent.click(answerButton!);

    expect(onCorrect).not.toHaveBeenCalled();
    expect(onWrong).not.toHaveBeenCalled();
  });

  it("duel mode can request hint", () => {
    const onRequestHint = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={vi.fn()}
        onWrong={vi.fn()}
        onSkip={vi.fn()}
        mode="duel"
        canRequestHint
        hintRequested={false}
        eliminatedOptions={[]}
        onRequestHint={onRequestHint}
        dataTestIdBase="level2-mc"
      />
    );

    fireEvent.click(screen.getByTestId("level2-mc-hint-request"));
    expect(onRequestHint).toHaveBeenCalledTimes(1);
  });

  it("solo mode keyboard ArrowDown and Enter submits a selected option", async () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={vi.fn()}
        mode="solo"
        dataTestIdBase="level2-mc"
      />
    );

    await act(async () => {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    });
    await act(async () => {
      fireEvent.keyDown(window, { key: "Enter" });
    });

    // The Enter handler dispatches via setTimeout(0); wait for it to fire
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
