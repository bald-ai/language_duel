import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Level1Input } from "@/app/game/levels/Level1Input";
import { AUTO_COMPLETE_DELAY_MS } from "@/app/game/levels/constants";
import { colors } from "@/lib/theme";

describe("Level1Input", () => {
  const answer = "hola";

  const typeAnswer = (input: HTMLElement) => {
    ["h", "o", "l", "a"].forEach((key) => {
      fireEvent.keyDown(input, { key });
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("solo mode auto-completes after delay", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();

    render(
      <Level1Input
        answer={answer}
        onCorrect={onCorrect}
        onSkip={vi.fn()}
        mode="solo"
        dataTestIdBase="level1"
      />
    );

    const input = screen.getByRole("textbox");
    typeAnswer(input);

    expect(onCorrect).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(AUTO_COMPLETE_DELAY_MS);
    });

    expect(onCorrect).toHaveBeenCalledWith(answer);
  });

  it("duel mode requires confirm to submit", () => {
    const onCorrect = vi.fn();

    render(
      <Level1Input
        answer={answer}
        onCorrect={onCorrect}
        onSkip={vi.fn()}
        mode="duel"
        dataTestIdBase="level1"
      />
    );

    const input = screen.getByRole("textbox");
    typeAnswer(input);

    expect(onCorrect).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("level1-confirm"));
    expect(onCorrect).toHaveBeenCalledWith(answer);
  });

  it("duel mode can request hint", () => {
    const onRequestHint = vi.fn();

    render(
      <Level1Input
        answer={answer}
        onCorrect={vi.fn()}
        onSkip={vi.fn()}
        mode="duel"
        canRequestHint
        hintRequested={false}
        onRequestHint={onRequestHint}
        dataTestIdBase="level1"
      />
    );

    fireEvent.click(screen.getByTestId("level1-hint-request"));
    expect(onRequestHint).toHaveBeenCalledTimes(1);
  });

  it("duel mode shows pending hint state with cancel and request again", () => {
    const onRequestHint = vi.fn();
    const onCancelHint = vi.fn();

    render(
      <Level1Input
        answer={answer}
        onCorrect={vi.fn()}
        onSkip={vi.fn()}
        mode="duel"
        hintRequested
        hintAccepted={false}
        canRequestHint={false}
        onRequestHint={onRequestHint}
        onCancelHint={onCancelHint}
        dataTestIdBase="level1"
      />
    );

    fireEvent.click(screen.getByTestId("level1-hint-request-again"));
    fireEvent.click(screen.getByTestId("level1-hint-cancel"));

    expect(onRequestHint).toHaveBeenCalledTimes(1);
    expect(onCancelHint).toHaveBeenCalledTimes(1);
  });

  it("duel mode shows accepted letters hint state", () => {
    const onRequestHint = vi.fn();

    render(
      <Level1Input
        answer={answer}
        onCorrect={vi.fn()}
        onSkip={vi.fn()}
        mode="duel"
        hintRequested
        hintAccepted
        hintType="letters"
        hintRevealedPositions={[0, 2]}
        onRequestHint={onRequestHint}
        dataTestIdBase="level1"
      />
    );

    expect(screen.getByText(/opponent is giving you hints/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("level1-hint-request-again"));
    expect(onRequestHint).toHaveBeenCalledTimes(1);
  });

  it("supports slot navigation with selected letter box and reverse-order backspace flow", () => {
    render(
      <Level1Input
        answer={answer}
        onCorrect={vi.fn()}
        onSkip={vi.fn()}
        mode="solo"
        dataTestIdBase="level1"
      />
    );

    const input = screen.getByRole("textbox");
    const box0 = screen.getByTestId("level1-letter-0-box");
    const box1 = screen.getByTestId("level1-letter-1-box");
    const box2 = screen.getByTestId("level1-letter-2-box");

    expect(box0).toHaveStyle(`border-color: ${colors.secondary.DEFAULT}`);

    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(box1).toHaveStyle(`border-color: ${colors.secondary.DEFAULT}`);
    expect(box0).not.toHaveStyle(`border-color: ${colors.secondary.DEFAULT}`);

    fireEvent.keyDown(input, { key: "x" });
    expect(box1).toHaveTextContent("X");

    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(box1).toHaveStyle(`border-color: ${colors.secondary.DEFAULT}`);
    fireEvent.keyDown(input, { key: "o" });
    expect(box1).toHaveTextContent("O");

    fireEvent.keyDown(input, { key: "l" });
    expect(box2).toHaveTextContent("L");

    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(box2).toHaveStyle(`border-color: ${colors.secondary.DEFAULT}`);

    fireEvent.keyDown(input, { key: "Backspace" });
    expect(box2).not.toHaveTextContent("L");
    expect(box2).toHaveStyle(`border-color: ${colors.secondary.DEFAULT}`);

    fireEvent.keyDown(input, { key: "Backspace" });
    expect(box1).toHaveStyle(`border-color: ${colors.secondary.DEFAULT}`);
    expect(box1).not.toHaveTextContent("O");
  });
});
