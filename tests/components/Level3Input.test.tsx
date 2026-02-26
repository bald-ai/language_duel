import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Level3Input } from "@/app/game/levels/Level3Input";
import { DUEL_CORRECT_DELAY_MS } from "@/app/game/levels/constants";

vi.mock("@/app/game/hooks/useTTS", () => ({
  useTTS: () => ({
    isPlaying: false,
    playTTS: vi.fn(),
  }),
}));

describe("Level3Input", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("submits trimmed correct answer on Enter in duel mode", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();
    const onWrong = vi.fn();

    render(
      <Level3Input
        answer="el gato"
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={vi.fn()}
        mode="duel"
        dataTestIdBase="l3"
      />
    );

    fireEvent.change(screen.getByTestId("l3-input"), {
      target: { value: "  el gato  " },
    });
    fireEvent.keyDown(screen.getByTestId("l3-input"), { key: "Enter" });
    vi.advanceTimersByTime(DUEL_CORRECT_DELAY_MS + 1);

    expect(onCorrect).toHaveBeenCalledWith("el gato");
    expect(onWrong).not.toHaveBeenCalled();
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
        mode="duel"
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
});
