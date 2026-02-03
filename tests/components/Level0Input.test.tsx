import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Level0Input } from "@/app/game/levels/Level0Input";

describe("Level0Input", () => {
  it("calls onGotIt and onNotYet", () => {
    const onGotIt = vi.fn();
    const onNotYet = vi.fn();

    render(
      <Level0Input
        word="hola"
        answer="hello"
        onGotIt={onGotIt}
        onNotYet={onNotYet}
        dataTestIdBase="solo-challenge-level0"
      />
    );

    fireEvent.click(screen.getByTestId("solo-challenge-level0-got-it"));
    expect(onGotIt).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("solo-challenge-level0-not-yet"));
    expect(onNotYet).toHaveBeenCalledTimes(1);
  });

  it("works without dataTestIdBase", () => {
    const onGotIt = vi.fn();
    const onNotYet = vi.fn();

    render(
      <Level0Input
        word="hola"
        answer="hello"
        onGotIt={onGotIt}
        onNotYet={onNotYet}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    fireEvent.click(screen.getByRole("button", { name: /not yet/i }));

    expect(onGotIt).toHaveBeenCalledTimes(1);
    expect(onNotYet).toHaveBeenCalledTimes(1);
  });
});
