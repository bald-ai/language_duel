import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DuelAnswerGrid } from "@/app/duel/[duelId]/components/DuelAnswerGrid";
import type { OptionContext } from "@/app/duel/[duelId]/components/AnswerOptionButton";
import { BOUNCE_FLY_SCALE, BUTTON_WIDTH } from "@/lib/sabotage/constants";

function optionContext(overrides: Partial<OptionContext> = {}): OptionContext {
  return {
    answer: "",
    selectedAnswer: null,
    correctAnswer: null,
    hasNoneOption: null,
    isShowingFeedback: false,
    eliminatedOptions: [],
    canEliminate: false,
    opponentAnswer: null,
    showOpponentPick: false,
    ...overrides,
  };
}

function renderGrid() {
  return render(
    <DuelAnswerGrid
      answers={["gato", "perro", "casa", "libro"]}
      optionContext={optionContext()}
      activeSabotage="bounce"
      onOptionClick={() => {}}
      showTypeReveal={false}
      typedText=""
      revealComplete
      hasNoneOption={false}
      isShowingFeedback={false}
    />
  );
}

describe("DuelAnswerGrid sabotage bounds", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps word ping-pong flyers inside the measured duel area", async () => {
    const measuredWidth = 360;
    vi.spyOn(Date, "now").mockReturnValue(2);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: measuredWidth,
      height: 640,
      top: 0,
      right: measuredWidth,
      bottom: 640,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    renderGrid();

    const flyingOption = await screen.findByTestId("duel-answer-0-fly");
    expect(flyingOption).toHaveClass("transition-colors");
    expect(Number.parseFloat(flyingOption.style.left)).toBeLessThanOrEqual(
      measuredWidth - BUTTON_WIDTH * BOUNCE_FLY_SCALE
    );
  });
});
