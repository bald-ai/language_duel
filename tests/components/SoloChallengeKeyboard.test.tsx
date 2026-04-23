import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Level0Input } from "@/app/game/levels/Level0Input";
import { Level1Input } from "@/app/game/levels/Level1Input";
import { Level2TypingInput } from "@/app/game/levels/Level2TypingInput";
import { Level2MultipleChoice } from "@/app/game/levels/Level2MultipleChoice";
import { Level3Input } from "@/app/game/levels/Level3Input";
import { hashSeed, seededShuffle } from "@/lib/prng";
import { AUTO_COMPLETE_DELAY_MS } from "@/app/game/levels/constants";

describe("Solo Challenge keyboard coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("LV0 focuses Got it and Enter submits immediately", async () => {
    const onGotIt = vi.fn();
    const onNotYet = vi.fn();
    const user = userEvent.setup();

    render(
      <Level0Input
        word="hola"
        answer="hello"
        onGotIt={onGotIt}
        onNotYet={onNotYet}
        dataTestIdBase="solo-kb-level0"
      />
    );

    const gotItButton = screen.getByRole("button", { name: /got it/i });
    await waitFor(() => expect(gotItButton).toHaveFocus());

    await user.keyboard("{Enter}");

    expect(onGotIt).toHaveBeenCalledTimes(1);
    expect(onNotYet).not.toHaveBeenCalled();
  });

  it("LV0 supports arrow toggle to Not yet and Enter submit", async () => {
    const onGotIt = vi.fn();
    const onNotYet = vi.fn();
    const user = userEvent.setup();

    render(
      <Level0Input
        word="hola"
        answer="hello"
        onGotIt={onGotIt}
        onNotYet={onNotYet}
        dataTestIdBase="solo-kb-level0"
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

  it("LV1 accepts text entry and auto-completes in solo mode", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();

    render(
      <Level1Input
        answer="hola"
        onCorrect={onCorrect}
        onSkip={vi.fn()}
        mode="solo"
        dataTestIdBase="solo-kb-level1"
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();

    ["h", "o", "l", "a"].forEach((key) => {
      fireEvent.change(input, { target: { value: key } });
    });

    act(() => {
      vi.advanceTimersByTime(AUTO_COMPLETE_DELAY_MS);
    });

    expect(onCorrect).toHaveBeenCalledWith("hola");
  });

  it("LV2 typing submits with Enter from keyboard", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();

    render(
      <Level2TypingInput
        answer="gato"
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={vi.fn()}
        mode="solo"
        dataTestIdBase="solo-kb-level2-typing"
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: "gato" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCorrect).toHaveBeenCalledWith("gato");
    expect(onWrong).not.toHaveBeenCalled();
  });

  it("LV2 multiple choice supports ArrowDown + Enter keyboard flow", async () => {
    const answer = "gato";
    const wrongAnswers = ["perro", "casa", "mesa", "silla", "libro"];
    const onCorrect = vi.fn();
    const onWrong = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={vi.fn()}
        mode="solo"
        dataTestIdBase="solo-kb-level2-mc"
      />
    );

    const seed = hashSeed(`${answer}::${wrongAnswers.join("|")}`);
    const shuffledWrong = seededShuffle([...wrongAnswers], seed).slice(0, 4);
    const options = seededShuffle([answer, ...shuffledWrong], seed + 1);
    const answerIndex = options.indexOf(answer);

    for (let i = 0; i <= answerIndex; i += 1) {
      fireEvent.keyDown(window, { key: "ArrowDown" });
    }
    fireEvent.keyDown(window, { key: "Enter" });

    await waitFor(() => {
      expect(onCorrect).toHaveBeenCalledWith(answer);
    });
    expect(onWrong).not.toHaveBeenCalled();
  });

  it("LV3 keyboard Enter submits correct answer immediately", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();

    render(
      <Level3Input
        answer="gato"
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={vi.fn()}
        mode="solo"
        dataTestIdBase="solo-kb-level3"
      />
    );

    const input = screen.getByRole("textbox");
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: "gato" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onWrong).not.toHaveBeenCalled();
    expect(onCorrect).toHaveBeenCalledWith("gato");
    expect(screen.queryByTestId("solo-kb-level3-listen")).not.toBeInTheDocument();
    expect(screen.queryByTestId("solo-kb-level3-continue")).not.toBeInTheDocument();
  });
});
