import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { Level2MultipleChoice } from "@/app/game/levels/Level2MultipleChoice";
import { hashSeed, seededShuffle } from "@/lib/prng";
import { DONT_KNOW_REVEAL_MS } from "@/app/game/levels/constants";

describe("Level2MultipleChoice", () => {
  const answer = "gato";
  const wrongAnswers = ["perro", "casa", "mesa", "silla", "libro"];

  const getOptions = () => {
    const seed = hashSeed(`${answer}::${wrongAnswers.join("|")}`);
    const shuffledWrong = seededShuffle([...wrongAnswers], seed).slice(0, 4);
    return seededShuffle([answer, ...shuffledWrong], seed + 1);
  };

  it("solo mode selects and confirms answer", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();
    const onSkip = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        mode="solo"
        dataTestIdBase="level2-mc"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: answer }));
    fireEvent.click(screen.getByTestId("level2-mc-confirm"));

    expect(onCorrect).toHaveBeenCalledWith(answer);
    expect(onWrong).not.toHaveBeenCalled();
  });

  it("solo mode wrong answer calls onWrong", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();
    const onSkip = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        mode="solo"
        dataTestIdBase="level2-mc"
      />
    );

    const options = getOptions();
    const wrongOption = options.find((opt) => opt !== answer) as string;
    const wrongIndex = options.indexOf(wrongOption);

    fireEvent.click(screen.getByTestId(`level2-mc-option-${wrongIndex}`));
    fireEvent.click(screen.getByTestId("level2-mc-confirm"));

    expect(onWrong).toHaveBeenCalledWith(wrongOption);
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("duel mode skip waits for DONT_KNOW_REVEAL_MS", () => {
    vi.useFakeTimers();

    const onCorrect = vi.fn();
    const onWrong = vi.fn();
    const onSkip = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        mode="duel"
        dataTestIdBase="level2-mc"
      />
    );

    fireEvent.click(screen.getByTestId("level2-mc-skip"));
    expect(onSkip).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(DONT_KNOW_REVEAL_MS);
    });

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("duel mode immediate submit calls onWrong for wrong option", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();
    const onSkip = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={onSkip}
        mode="duel"
        dataTestIdBase="level2-mc"
      />
    );

    const options = getOptions();
    const wrongOption = options.find((opt) => opt !== answer) as string;
    const wrongIndex = options.indexOf(wrongOption);

    fireEvent.click(screen.getByTestId(`level2-mc-option-${wrongIndex}`));
    expect(onWrong).toHaveBeenCalledWith(wrongOption);
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("duel mode ignores clicks on eliminated options", () => {
    const onCorrect = vi.fn();
    const onWrong = vi.fn();

    const options = getOptions();
    const eliminated = options.find((opt) => opt !== answer) as string;
    const eliminatedIndex = options.indexOf(eliminated);

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={onCorrect}
        onWrong={onWrong}
        onSkip={vi.fn()}
        mode="duel"
        eliminatedOptions={[eliminated]}
        dataTestIdBase="level2-mc"
      />
    );

    fireEvent.click(screen.getByTestId(`level2-mc-option-${eliminatedIndex}`));
    expect(onWrong).not.toHaveBeenCalled();
    expect(onCorrect).not.toHaveBeenCalled();
  });

  it("duel mode can request hint", () => {
    const onRequestHint = vi.fn();

    render(
      <Level2MultipleChoice
        answer={answer}
        wrongAnswers={wrongAnswers}
        onCorrect={vi.fn()}
        onWrong={vi.fn()}
        onSkip={vi.fn()}
        mode="duel"
        canRequestHint
        hintRequested={false}
        eliminatedOptions={[]}
        onRequestHint={onRequestHint}
        dataTestIdBase="level2-mc"
      />
    );

    fireEvent.click(screen.getByTestId("level2-mc-hint-request"));
    expect(onRequestHint).toHaveBeenCalledTimes(1);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
