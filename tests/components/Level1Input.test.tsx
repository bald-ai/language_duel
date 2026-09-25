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

  it("accepts composed Spanish text and completes after the final composition", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();
    render(<Level1Input answer="niño" onCorrect={onCorrect} onSkip={vi.fn()} dataTestIdBase="composed" />);
    const input = screen.getByRole("textbox");
    fireEvent.compositionEnd(input, { data: "niñ" });
    expect(screen.getByTestId("composed-letter-2-box").textContent).toBe("Ñ");
    act(() => vi.advanceTimersByTime(AUTO_COMPLETE_DELAY_MS));
    expect(onCorrect).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input, { data: "o" });
    act(() => vi.advanceTimersByTime(AUTO_COMPLETE_DELAY_MS));
    expect(onCorrect).toHaveBeenCalledExactlyOnceWith("niño");
  });
});

describe("guided typing hints", () => {
  afterEach(() => vi.useRealTimers());
  it("reveals the requested letter, skips already correct letters, and completes only once", () => {
    vi.useFakeTimers(); const onCorrect = vi.fn();
    render(<Level1Input answer="hola" onCorrect={onCorrect} onSkip={vi.fn()} dataTestIdBase="guided" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "h" } });
    fireEvent.click(screen.getByTestId("guided-letter-2-hint"));
    expect(screen.getByTestId("guided-letter-2-box").textContent).toBe("L");
    expect(screen.getByTestId("guided-letter-2-hint")).toBeDisabled();
    act(() => vi.advanceTimersByTime(50));
    expect(screen.getByTestId("guided-letter-1-box")).not.toHaveStyle({ borderColor: "transparent" });
    fireEvent.click(screen.getByTestId("guided-letter-1-hint"));
    act(() => vi.advanceTimersByTime(50));
    expect(screen.getByTestId("guided-letter-3-box")).not.toHaveStyle({ borderColor: "transparent" });
    fireEvent.click(screen.getByTestId("guided-letter-3-hint"));
    act(() => vi.advanceTimersByTime(AUTO_COMPLETE_DELAY_MS));
    expect(onCorrect).toHaveBeenCalledExactlyOnceWith("hola");
    act(() => vi.advanceTimersByTime(5000)); expect(onCorrect).toHaveBeenCalledOnce();
  });
  it("replaces an incorrect typed letter with a hint and can skip a multiword answer", () => {
    const onSkip = vi.fn(); render(<Level1Input answer="el gato" onCorrect={vi.fn()} onSkip={onSkip} dataTestIdBase="guided" />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "xx" } });
    fireEvent.click(screen.getByTestId("guided-letter-0-hint"));
    expect(screen.getByTestId("guided-letter-0-box")).toHaveTextContent("E");
    fireEvent.doubleClick(screen.getByTestId("guided-letter-1-slot"));
    expect(screen.getByRole("textbox")).toHaveFocus();
    fireEvent.click(screen.getByTestId("guided-skip")); expect(onSkip).toHaveBeenCalledOnce();
  });
  it("ignores punctuation-only input and accepts pasted Spanish letters across word boundaries", () => {
    vi.useFakeTimers(); const onCorrect = vi.fn();
    render(<Level1Input answer="el niño" onCorrect={onCorrect} onSkip={vi.fn()} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "12!?" } });
    act(() => vi.advanceTimersByTime(AUTO_COMPLETE_DELAY_MS)); expect(onCorrect).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "el niño" } });
    act(() => vi.advanceTimersByTime(AUTO_COMPLETE_DELAY_MS)); expect(onCorrect).toHaveBeenCalledExactlyOnceWith("el niño");
  });
});
