import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AddWordModal } from "@/app/themes/components/AddWordModal";

describe("AddWordModal", () => {
  it("renders nothing when closed", () => {
    const { queryByTestId } = render(
      <AddWordModal
        isOpen={false}
        newWordInput=""
        isAdding={false}
        error={null}
        onInputChange={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId("theme-add-word-modal")).toBeNull();
  });

  it("handles input changes, Enter submit, Add click, and Cancel click", () => {
    const onInputChange = vi.fn();
    const onAdd = vi.fn();
    const onClose = vi.fn();

    render(
      <AddWordModal
        isOpen
        newWordInput="cat"
        isAdding={false}
        error={null}
        onInputChange={onInputChange}
        onAdd={onAdd}
        onClose={onClose}
      />
    );

    fireEvent.change(screen.getByTestId("theme-add-word-input"), {
      target: { value: "dog" },
    });
    fireEvent.keyDown(screen.getByTestId("theme-add-word-input"), { key: "Enter" });
    fireEvent.click(screen.getByTestId("theme-add-word-submit"));
    fireEvent.click(screen.getByTestId("theme-add-word-cancel"));

    expect(onInputChange).toHaveBeenCalledWith("dog");
    expect(onAdd).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows error + loading state and disables controls while adding", () => {
    render(
      <AddWordModal
        isOpen
        newWordInput=""
        isAdding
        error="Generation failed"
        onInputChange={vi.fn()}
        onAdd={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("Generation failed")).toBeInTheDocument();
    expect(screen.getByText(/Generating Spanish translation/)).toBeInTheDocument();
    expect(screen.getByTestId("theme-add-word-submit")).toBeDisabled();
    expect(screen.getByTestId("theme-add-word-cancel")).toBeDisabled();
    expect(screen.getByTestId("theme-add-word-submit")).toHaveTextContent("Adding...");
  });

  it("does not submit on Enter when input is empty", () => {
    const onAdd = vi.fn();

    render(
      <AddWordModal
        isOpen
        newWordInput="   "
        isAdding={false}
        error={null}
        onInputChange={vi.fn()}
        onAdd={onAdd}
        onClose={vi.fn()}
      />
    );

    fireEvent.keyDown(screen.getByTestId("theme-add-word-input"), { key: "Enter" });

    expect(onAdd).not.toHaveBeenCalled();
  });
});
