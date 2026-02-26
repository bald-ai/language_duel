import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GenerateRandomModal } from "@/app/themes/components/GenerateRandomModal";

describe("GenerateRandomModal", () => {
  it("renders nothing when closed", () => {
    const { queryByTestId } = render(
      <GenerateRandomModal
        isOpen={false}
        themeName="Animals"
        count={1}
        isGenerating={false}
        error={null}
        onCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId("theme-generate-random-modal")).toBeNull();
  });

  it("handles range changes and action buttons", () => {
    const onCountChange = vi.fn();
    const onGenerate = vi.fn();
    const onClose = vi.fn();

    render(
      <GenerateRandomModal
        isOpen
        themeName="Animals"
        count={1}
        isGenerating={false}
        error={null}
        onCountChange={onCountChange}
        onGenerate={onGenerate}
        onClose={onClose}
      />
    );

    expect(screen.getByText(/This will generate 1 new unique word/)).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("theme-generate-random-range"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByTestId("theme-generate-random-submit"));
    fireEvent.click(screen.getByTestId("theme-generate-random-cancel"));

    expect(onCountChange).toHaveBeenCalledWith(3);
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows plural label, error, and loading state while generating", () => {
    render(
      <GenerateRandomModal
        isOpen
        themeName="Animals"
        count={3}
        isGenerating
        error="Rate limit"
        onCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText(/This will generate 3 new unique words/)).toBeInTheDocument();
    expect(screen.getByText("Rate limit")).toBeInTheDocument();
    expect(screen.getByText(/Generating 3 words/)).toBeInTheDocument();
    expect(screen.getByTestId("theme-generate-random-submit")).toBeDisabled();
    expect(screen.getByTestId("theme-generate-random-cancel")).toBeDisabled();
    expect(screen.getByTestId("theme-generate-random-submit")).toHaveTextContent("Generating...");
  });
});
