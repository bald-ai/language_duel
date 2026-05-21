import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ContextCluesBeta } from "@/app/components/prototypes/ContextCluesBeta";
import {
  getItems,
  type ContextCluesItem,
  type SpotPatternItem,
  type StoryDetectiveItem,
} from "@/lib/contextClues";

function correctTestId(item: ContextCluesItem): string {
  const index = item.options.findIndex((option) => option.isCorrect);
  return `context-clues-option-${item.id}-o${index}`;
}

function wrongTestId(item: ContextCluesItem): string {
  const index = item.options.findIndex((option) => !option.isCorrect);
  return `context-clues-option-${item.id}-o${index}`;
}

describe("ContextCluesBeta", () => {
  it("shows all three deduction modes and starts on Infer the Word", () => {
    render(<ContextCluesBeta onBack={vi.fn()} />);
    expect(screen.getByTestId("context-clues-tab-infer_word")).toBeInTheDocument();
    expect(screen.getByTestId("context-clues-tab-story_detective")).toBeInTheDocument();
    expect(screen.getByTestId("context-clues-tab-spot_pattern")).toBeInTheDocument();
    expect(screen.getByTestId("context-clues-target")).toBeInTheDocument();
    expect(screen.getByTestId("context-clues-next")).toBeDisabled();
  });

  it("reveals an explanation and enables Next after a correct answer", () => {
    render(<ContextCluesBeta onBack={vi.fn()} />);
    const firstItem = getItems("infer_word")[0];

    fireEvent.click(screen.getByTestId(correctTestId(firstItem)));

    const explanation = screen.getByTestId("context-clues-explanation");
    expect(explanation).toHaveTextContent("¡Correcto!");
    expect(explanation).toHaveTextContent(firstItem.explanation);
    expect(screen.getByTestId("context-clues-next")).toBeEnabled();
  });

  it("flags a wrong answer without enabling scoring", () => {
    render(<ContextCluesBeta onBack={vi.fn()} />);
    const firstItem = getItems("infer_word")[0];

    fireEvent.click(screen.getByTestId(wrongTestId(firstItem)));

    expect(screen.getByTestId("context-clues-explanation")).toHaveTextContent("Not quite");
  });

  it("switches modes via the tabs and resets progress", () => {
    render(<ContextCluesBeta onBack={vi.fn()} />);

    fireEvent.click(screen.getByTestId("context-clues-tab-spot_pattern"));

    const patternItem = getItems("spot_pattern")[0] as SpotPatternItem;
    expect(screen.getByText(patternItem.prompt)).toBeInTheDocument();
    expect(screen.getByTestId("context-clues-next")).toBeDisabled();

    fireEvent.click(screen.getByTestId("context-clues-tab-story_detective"));
    const storyItem = getItems("story_detective")[0] as StoryDetectiveItem;
    expect(screen.getByText(storyItem.question)).toBeInTheDocument();
  });

  it("plays a full mode through to the score screen", () => {
    const onBack = vi.fn();
    render(<ContextCluesBeta onBack={onBack} />);
    const items = getItems("infer_word");

    for (const item of items) {
      fireEvent.click(screen.getByTestId(correctTestId(item)));
      fireEvent.click(screen.getByTestId("context-clues-next"));
    }

    const complete = screen.getByTestId("context-clues-complete");
    expect(within(complete).getByText(`You got ${items.length} of ${items.length}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("context-clues-complete-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
