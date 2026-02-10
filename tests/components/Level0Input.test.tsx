import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("pre-focuses Got it and submits with Enter", async () => {
    const onGotIt = vi.fn();
    const onNotYet = vi.fn();
    const user = userEvent.setup();

    render(
      <Level0Input
        word="hola"
        answer="hello"
        onGotIt={onGotIt}
        onNotYet={onNotYet}
        dataTestIdBase="solo-challenge-level0"
      />
    );

    const gotItButton = screen.getByRole("button", { name: /got it/i });

    await waitFor(() => {
      expect(gotItButton).toHaveFocus();
    });

    await user.keyboard("{Enter}");

    expect(onGotIt).toHaveBeenCalledTimes(1);
    expect(onNotYet).not.toHaveBeenCalled();
  });

  it("switches to Not yet with arrow key and submits with Enter", async () => {
    const onGotIt = vi.fn();
    const onNotYet = vi.fn();
    const user = userEvent.setup();

    render(
      <Level0Input
        word="hola"
        answer="hello"
        onGotIt={onGotIt}
        onNotYet={onNotYet}
        dataTestIdBase="solo-challenge-level0"
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /got it/i })).toHaveFocus();
    });

    fireEvent.keyDown(window, { key: "ArrowRight" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /not yet/i })).toHaveFocus();
    });

    await user.keyboard("{Enter}");

    expect(onNotYet).toHaveBeenCalledTimes(1);
    expect(onGotIt).not.toHaveBeenCalled();
  });
});
