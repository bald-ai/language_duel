import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { Level2TypingInput } from "@/app/game/levels/Level2TypingInput";

type Props = ComponentProps<typeof Level2TypingInput>;

function renderLevel2TypingInput(overrides: Partial<Props> = {}) {
  const props: Props = {
    answer: "el gato",
    onCorrect: vi.fn(),
    onWrong: vi.fn(),
    onSkip: vi.fn(),
    dataTestIdBase: "l2",
    ...overrides,
  };

  render(<Level2TypingInput {...props} />);
  return props;
}

describe("Level2TypingInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits correct answer in standard mode", () => {
    const props = renderLevel2TypingInput();

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();

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
});
