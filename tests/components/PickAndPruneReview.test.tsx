import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PickAndPruneReview } from "@/app/themes/components/PickAndPruneReview";
import type { PickAndPruneWord } from "@/app/themes/hooks/usePickAndPrune";

const pushMock = vi.fn();
const backMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    back: backMock,
  }),
}));

const activeWords: PickAndPruneWord[] = [
  {
    id: "word-1",
    originalIndex: 0,
    word: { word: "dog", answer: "perro", wrongAnswers: ["gato", "casa", "mesa"] },
  },
  {
    id: "word-2",
    originalIndex: 2,
    word: { word: "bird", answer: "pajaro", wrongAnswers: ["gato", "casa", "mesa"] },
  },
];

const removedWords: PickAndPruneWord[] = [
  {
    id: "word-3",
    originalIndex: 1,
    word: { word: "cat", answer: "gato", wrongAnswers: ["perro", "casa", "mesa"] },
  },
];

describe("PickAndPruneReview", () => {
  afterEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
  });

  it("renders active list and counts", () => {
    render(
      <PickAndPruneReview
        activeWords={activeWords}
        removedWords={removedWords}
        removedOpen={false}
        onRemovedOpenChange={vi.fn()}
        onRemove={vi.fn()}
        onRestore={vi.fn()}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId("theme-pick-prune-active-count")).toHaveTextContent("Active: 2");
    expect(screen.getByTestId("theme-pick-prune-removed-count")).toHaveTextContent("Removed: 1");
    expect(screen.getByTestId("theme-pick-prune-active-row-0")).toHaveTextContent("dog");
    expect(screen.getByTestId("theme-pick-prune-active-row-1")).toHaveTextContent("bird");
    expect(screen.queryByTestId("theme-pick-prune-removed-row-0")).toBeNull();
  });

  it("calls remove and restore handlers", () => {
    const onRemove = vi.fn();
    const onRestore = vi.fn();
    const onRemovedOpenChange = vi.fn();

    const { rerender } = render(
      <PickAndPruneReview
        activeWords={activeWords}
        removedWords={removedWords}
        removedOpen={false}
        onRemovedOpenChange={onRemovedOpenChange}
        onRemove={onRemove}
        onRestore={onRestore}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("theme-pick-prune-remove-word-1"));
    expect(onRemove).toHaveBeenCalledWith("word-1");

    fireEvent.click(screen.getByTestId("theme-pick-prune-removed-toggle"));
    expect(onRemovedOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <PickAndPruneReview
        activeWords={activeWords}
        removedWords={removedWords}
        removedOpen
        onRemovedOpenChange={onRemovedOpenChange}
        onRemove={onRemove}
        onRestore={onRestore}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("theme-pick-prune-restore-word-3"));
    expect(onRestore).toHaveBeenCalledWith("word-3");
  });

  it("disables continue when no active words and shows empty message", () => {
    render(
      <PickAndPruneReview
        activeWords={[]}
        removedWords={removedWords}
        removedOpen={false}
        onRemovedOpenChange={vi.fn()}
        onRemove={vi.fn()}
        onRestore={vi.fn()}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId("theme-pick-prune-review-submit")).toBeDisabled();
    expect(
      screen.getByText("No words selected. Restore at least one word to continue.")
    ).toBeInTheDocument();
  });
});
