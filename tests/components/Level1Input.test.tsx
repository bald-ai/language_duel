import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Level1Input } from "@/app/game/levels/Level1Input";
import { AUTO_COMPLETE_DELAY_MS } from "@/app/game/levels/constants";
describe("Level1Input", () => {
  const answer = "hola";

  const typeAnswer = (input: HTMLElement) => {
    ["h", "o", "l", "a"].forEach((key) => {
      fireEvent.change(input, { target: { value: key } });
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-completes after delay", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();

    render(
      <Level1Input
        answer={answer}
        onCorrect={onCorrect}
        onSkip={vi.fn()}
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

  it("supports slot navigation with selected letter box and reverse-order backspace flow", () => {
    render(
      <Level1Input
        answer={answer}
        onCorrect={vi.fn()}
        onSkip={vi.fn()}
        dataTestIdBase="level1"
      />
    );

    const input = screen.getByRole("textbox");
    const box0 = screen.getByTestId("level1-letter-0-box");
    const box1 = screen.getByTestId("level1-letter-1-box");
    const box2 = screen.getByTestId("level1-letter-2-box");

    // box0 starts selected — visual indicator is present
    expect(box0).not.toHaveStyle({ borderColor: "transparent" });
    expect(box1).toHaveStyle({ borderColor: "transparent" });

    fireEvent.keyDown(input, { key: "ArrowRight" });
    expect(box1).not.toHaveStyle({ borderColor: "transparent" });
    expect(box0).toHaveStyle({ borderColor: "transparent" });

    fireEvent.change(input, { target: { value: "x" } });
    expect(box1).toHaveTextContent("X");

    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(box1).not.toHaveStyle({ borderColor: "transparent" });
    fireEvent.change(input, { target: { value: "o" } });
    expect(box1).toHaveTextContent("O");

    fireEvent.change(input, { target: { value: "l" } });
    expect(box2).toHaveTextContent("L");

    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(box2).not.toHaveStyle({ borderColor: "transparent" });

    fireEvent.keyDown(input, { key: "Backspace" });
    expect(box2).not.toHaveTextContent("L");
    expect(box2).not.toHaveStyle({ borderColor: "transparent" });

    fireEvent.keyDown(input, { key: "Backspace" });
    expect(box1).not.toHaveStyle({ borderColor: "transparent" });
    expect(box1).not.toHaveTextContent("O");
  });

  it("accepts mobile-style text entry through change events", () => {
    render(
      <Level1Input
        answer={answer}
        onCorrect={vi.fn()}
        onSkip={vi.fn()}
        dataTestIdBase="level1"
      />
    );

    const input = screen.getByRole("textbox");

    fireEvent.change(input, { target: { value: "h" } });
    fireEvent.change(input, { target: { value: "o" } });
    fireEvent.change(input, { target: { value: "l" } });
    fireEvent.change(input, { target: { value: "a" } });

    expect(screen.getByTestId("level1-letter-0-box")).toHaveTextContent("H");
    expect(screen.getByTestId("level1-letter-1-box")).toHaveTextContent("O");
    expect(screen.getByTestId("level1-letter-2-box")).toHaveTextContent("L");
    expect(screen.getByTestId("level1-letter-3-box")).toHaveTextContent("A");
  });
});
