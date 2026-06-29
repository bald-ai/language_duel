import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AddSentenceModal } from "@/app/themes/components/AddSentenceModal";

describe("AddSentenceModal", () => {
  it("renders nothing when closed", () => {
    const { queryByTestId } = render(
      <AddSentenceModal
        isOpen={false}
        englishPrompt=""
        isAdding={false}
        error={null}
        onPromptChange={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId("theme-add-sentence-modal")).toBeNull();
  });

  it("handles prompt changes, Add click, and Cancel click", () => {
    const onPromptChange = vi.fn();
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(
      <AddSentenceModal
        isOpen
        englishPrompt="The dog runs"
        isAdding={false}
        error={null}
        onPromptChange={onPromptChange}
        onAdd={onAdd}
        onClose={onClose}
      />
    );

    fireEvent.change(screen.getByTestId("theme-add-sentence-input"), {
      target: { value: "The cat sleeps" },
    });
    fireEvent.click(screen.getByTestId("theme-add-sentence-submit"));
    fireEvent.click(screen.getByTestId("theme-add-sentence-cancel"));

    expect(onPromptChange).toHaveBeenCalledWith("The cat sleeps");
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows error + loading state and disables controls while adding", () => {
    render(
      <AddSentenceModal
        isOpen
        englishPrompt="The dog runs"
        isAdding
        error="Generation failed"
        onPromptChange={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Generation failed")).toBeInTheDocument();
    expect(
      screen.getByText("Generating Spanish sentence, word meanings, and distractors...")
    ).toBeInTheDocument();
    expect(screen.getByTestId("theme-add-sentence-submit")).toBeDisabled();
    expect(screen.getByTestId("theme-add-sentence-cancel")).toBeDisabled();
  });

  it("disables submit when prompt is empty", () => {
    render(
      <AddSentenceModal
        isOpen
        englishPrompt="   "
        isAdding={false}
        error={null}
        onPromptChange={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("theme-add-sentence-submit")).toBeDisabled();
  });
});
