import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PickAndPruneSentenceReview } from "@/app/themes/components/PickAndPruneSentenceReview";
import type { PickAndPruneRound } from "@/app/themes/hooks/usePickAndPruneSentence";

const activeRounds: PickAndPruneRound[] = [
  {
    id: "round-1",
    originalIndex: 0,
    round: { englishPrompt: "I eat bread", spanishSentence: "Yo como pan", distractors: ["Tú", "bebes", "agua"] },
  },
  {
    id: "round-2",
    originalIndex: 2,
    round: { englishPrompt: "The cat sleeps", spanishSentence: "El gato duerme", distractors: ["perro", "corre", "salta"] },
  },
];

const removedRounds: PickAndPruneRound[] = [
  {
    id: "round-3",
    originalIndex: 1,
    round: { englishPrompt: "You drink water", spanishSentence: "Tú bebes agua", distractors: ["Yo", "como", "pan"] },
  },
];

function renderReview(overrides: Partial<ComponentProps<typeof PickAndPruneSentenceReview>> = {}) {
  return render(
    <PickAndPruneSentenceReview
      reviewKind="new-theme"
      activeRounds={activeRounds}
      removedRounds={removedRounds}
      removedOpen={false}
      onRemovedOpenChange={vi.fn()}
      onRemove={vi.fn()}
      onRestore={vi.fn()}
      onContinue={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />
  );
}

describe("PickAndPruneSentenceReview", () => {
  it("renders active counts and the prompt + answer per row", () => {
    renderReview();

    expect(screen.getByTestId("theme-sentence-pick-prune-active-count")).toHaveTextContent("Active: 2");
    expect(screen.getByTestId("theme-sentence-pick-prune-removed-count")).toHaveTextContent("Removed: 1");

    const row0 = screen.getByTestId("theme-sentence-pick-prune-active-row-0");
    expect(row0).toHaveTextContent("I eat bread");
    expect(row0).toHaveTextContent("Yo como pan");
    expect(screen.queryByTestId("theme-sentence-pick-prune-removed-row-0")).toBeNull();
  });

  it("shows the 'Continue with N sentences' label", () => {
    renderReview();
    expect(screen.getByTestId("theme-sentence-pick-prune-review-submit")).toHaveTextContent(
      "Continue with 2 sentences"
    );
  });

  it("shows the 'Add N sentences' label for existing-theme review", () => {
    renderReview({ reviewKind: "existing-theme" });
    expect(screen.getByTestId("theme-sentence-pick-prune-review-submit")).toHaveTextContent(
      "Add 2 sentences"
    );
  });

  it("calls remove, toggle, and restore handlers", () => {
    const onRemove = vi.fn();
    const onRestore = vi.fn();
    const onRemovedOpenChange = vi.fn();

    const { rerender } = renderReview({ onRemove, onRestore, onRemovedOpenChange });

    fireEvent.click(screen.getByTestId("theme-sentence-pick-prune-remove-round-1"));
    expect(onRemove).toHaveBeenCalledWith("round-1");

    fireEvent.click(screen.getByTestId("theme-sentence-pick-prune-removed-toggle"));
    expect(onRemovedOpenChange).toHaveBeenCalledWith(true);

    rerender(
      <PickAndPruneSentenceReview
        reviewKind="new-theme"
        activeRounds={activeRounds}
        removedRounds={removedRounds}
        removedOpen
        onRemovedOpenChange={onRemovedOpenChange}
        onRemove={onRemove}
        onRestore={onRestore}
        onContinue={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("theme-sentence-pick-prune-restore-round-3"));
    expect(onRestore).toHaveBeenCalledWith("round-3");
  });

  it("disables continue when no active rounds and shows the empty message", () => {
    renderReview({ activeRounds: [] });

    expect(screen.getByTestId("theme-sentence-pick-prune-review-submit")).toBeDisabled();
    expect(
      screen.getByText("No sentences selected. Restore at least one to continue.")
    ).toBeInTheDocument();
  });
});
