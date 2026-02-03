import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Level1Input } from "@/app/game/levels/Level1Input";
import { AUTO_COMPLETE_DELAY_MS } from "@/app/game/levels/constants";

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
});
