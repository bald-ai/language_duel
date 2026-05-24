import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Level3Input } from "@/app/game/levels/Level3Input";

describe("Level3Input", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not submit blank input on Enter", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();

    render(
      <Level3Input
        answer="el gato"
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={vi.fn()}
        dataTestIdBase="l3"
      />
    );

    fireEvent.change(screen.getByTestId("l3-input"), {
      target: { value: "   " },
    });
    fireEvent.keyDown(screen.getByTestId("l3-input"), { key: "Enter" });

    expect(onCorrect).not.toHaveBeenCalled();
    expect(onWrong).not.toHaveBeenCalled();
  });

  it("submits correct answer immediately", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();

    render(
      <Level3Input
        answer="gato"
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={vi.fn()}
        dataTestIdBase="l3"
      />
    );

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("l3-input"), {
      target: { value: "gato" },
    });
    fireEvent.keyDown(screen.getByTestId("l3-input"), { key: "Enter" });

    expect(onCorrect).toHaveBeenCalledWith("gato");
    expect(onWrong).not.toHaveBeenCalled();
    expect(screen.queryByTestId("l3-listen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("l3-continue")).not.toBeInTheDocument();
  });
});
