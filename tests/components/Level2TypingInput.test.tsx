import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { Level2TypingInput } from "@/app/game/levels/Level2TypingInput";

const generateAnagramLettersMock = vi.fn();

vi.mock("@/lib/prng", () => ({
  generateAnagramLetters: (...args: unknown[]) => generateAnagramLettersMock(...args),
}));

type Props = ComponentProps<typeof Level2TypingInput>;

function renderLevel2TypingInput(overrides: Partial<Props> = {}) {
  const props: Props = {
    answer: "el gato",
    onCorrect: vi.fn(),
    onWrong: vi.fn(),
    onSkip: vi.fn(),
    mode: "solo",
    dataTestIdBase: "l2",
    ...overrides,
  };

  render(<Level2TypingInput {...props} />);
  return props;
}

describe("Level2TypingInput", () => {
  beforeEach(() => {
    generateAnagramLettersMock.mockReset();
    generateAnagramLettersMock.mockImplementation((answer: string) =>
      answer.replace(/\s+/g, "").split("").reverse()
    );
  });

  it("submits correct answer in standard mode", () => {
    const props = renderLevel2TypingInput();

    fireEvent.change(screen.getByTestId("l2-input"), {
      target: { value: "el gato" },
    });
    fireEvent.click(screen.getByTestId("l2-submit"));

    expect(props.onCorrect).toHaveBeenCalledWith("el gato");
    expect(props.onWrong).not.toHaveBeenCalled();
  });

  it("submits wrong answer and shows error text", () => {
    const props = renderLevel2TypingInput();

    fireEvent.change(screen.getByTestId("l2-input"), {
      target: { value: "el perro" },
    });
    fireEvent.click(screen.getByTestId("l2-submit"));

    expect(props.onWrong).toHaveBeenCalledWith("el perro");
    expect(screen.getByText(/Wrong! The answer was:/)).toBeInTheDocument();
  });

  it("submits on Enter key and supports skip", () => {
    const props = renderLevel2TypingInput();

    fireEvent.click(screen.getByTestId("l2-skip"));
    fireEvent.change(screen.getByTestId("l2-input"), {
      target: { value: "el gato" },
    });
    fireEvent.keyDown(screen.getByTestId("l2-input"), { key: "Enter" });

    expect(props.onCorrect).toHaveBeenCalledWith("el gato");
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it("treats Enter submit with trailing spaces as correct when trimmed", () => {
    const props = renderLevel2TypingInput();

    fireEvent.change(screen.getByTestId("l2-input"), {
      target: { value: "  el gato  " },
    });
    fireEvent.keyDown(screen.getByTestId("l2-input"), { key: "Enter" });

    expect(props.onCorrect).toHaveBeenCalledWith("el gato");
    expect(props.onWrong).not.toHaveBeenCalled();
  });

  it("does not submit on Enter when input is blank after trimming", () => {
    const props = renderLevel2TypingInput();

    fireEvent.change(screen.getByTestId("l2-input"), {
      target: { value: "   " },
    });
    fireEvent.keyDown(screen.getByTestId("l2-input"), { key: "Enter" });

    expect(props.onCorrect).not.toHaveBeenCalled();
    expect(props.onWrong).not.toHaveBeenCalled();
  });

  it("shows hint request button in duel mode and calls onRequestHint", () => {
    const onRequestHint = vi.fn();
    renderLevel2TypingInput({
      mode: "duel",
      canRequestHint: true,
      hintRequested: false,
      onRequestHint,
    });

    fireEvent.click(screen.getByTestId("l2-hint-request"));

    expect(onRequestHint).toHaveBeenCalledTimes(1);
  });

  it("shows waiting hint state with request-again and cancel actions", () => {
    const onRequestHint = vi.fn();
    const onCancelHint = vi.fn();

    renderLevel2TypingInput({
      mode: "duel",
      hintRequested: true,
      hintAccepted: false,
      onRequestHint,
      onCancelHint,
    });

    expect(screen.getByText("Waiting for opponent to help...")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("l2-hint-request-again"));
    fireEvent.click(screen.getByTestId("l2-hint-cancel"));

    expect(onRequestHint).toHaveBeenCalledTimes(1);
    expect(onCancelHint).toHaveBeenCalledTimes(1);
  });

  it("shows accepted-hint request-again button when hint accepted", () => {
    const onRequestHint = vi.fn();

    renderLevel2TypingInput({
      mode: "duel",
      hintRequested: true,
      hintAccepted: true,
      hintType: "letter",
      onRequestHint,
    });

    fireEvent.click(screen.getByTestId("l2-hint-request-again"));

    expect(onRequestHint).toHaveBeenCalledTimes(1);
  });

  it("anagram mode can submit a correct answer", () => {
    const onCorrect = vi.fn();
    generateAnagramLettersMock.mockImplementation(() => ["e", "l", "g", "a", "t", "o"]);

    renderLevel2TypingInput({
      answer: "el gato",
      mode: "duel",
      hintRequested: true,
      hintAccepted: true,
      hintType: "anagram",
      onCorrect,
    });

    expect(screen.getByText("Preparing anagram...")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("l2-anagram-shuffle"));
    fireEvent.click(screen.getByTestId("l2-anagram-submit"));

    expect(onCorrect).toHaveBeenCalledWith("el gato");
  });

  it("anagram mode can submit a wrong answer and show feedback", () => {
    const onWrong = vi.fn();
    generateAnagramLettersMock.mockImplementation(() => ["o", "t", "a", "g", "l", "e"]);

    renderLevel2TypingInput({
      answer: "el gato",
      mode: "duel",
      hintRequested: true,
      hintAccepted: true,
      hintType: "anagram",
      onWrong,
    });

    fireEvent.click(screen.getByTestId("l2-anagram-shuffle"));
    fireEvent.click(screen.getByTestId("l2-anagram-submit"));

    expect(onWrong).toHaveBeenCalled();
    expect(screen.getByText(/Wrong! The answer was:/)).toBeInTheDocument();
  });
});
