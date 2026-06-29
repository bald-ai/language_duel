import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { GenerateMoreModal } from "@/app/themes/components/GenerateMoreModal";
import { GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT } from "@/app/themes/constants";

describe("GenerateMoreModal", () => {
  function renderModal(overrides: Partial<ComponentProps<typeof GenerateMoreModal>> = {}) {
    return render(
      <GenerateMoreModal
        isOpen
        themeName="Animals"
        isGenerating={false}
        error={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
        {...overrides}
      />
    );
  }

  it("renders nothing when closed", () => {
    const { queryByTestId } = render(
      <GenerateMoreModal
        isOpen={false}
        themeName="Animals"
        isGenerating={false}
        error={null}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId("theme-generate-more-modal")).toBeNull();
  });

  it("uses the main Generate button for Pick & Prune review", () => {
    const onGenerate = vi.fn();
    const onClose = vi.fn();

    renderModal({ onGenerate, onClose });

    expect(screen.queryByTestId("theme-generate-more-range")).toBeNull();
    expect(screen.queryByTestId("theme-generate-more-pick-prune-try")).toBeNull();
    expect(screen.getByText(
      `Generate ${GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT} new unique words for "Animals", then review which ones to keep.`
    )).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-generate-more-submit"));
    fireEvent.click(screen.getByTestId("theme-generate-more-cancel"));

    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows error and disables controls while generating", () => {
    renderModal({ isGenerating: true, error: "Rate limit" });

    expect(screen.getByText("Rate limit")).toBeInTheDocument();
    expect(screen.getByTestId("theme-generate-more-submit")).toBeDisabled();
    expect(screen.getByTestId("theme-generate-more-cancel")).toBeDisabled();
  });

  it("shows Pick & Prune loading text while generating", () => {
    renderModal({ isGenerating: true });

    expect(screen.getByText(
      `Generating ${GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT} words for Pick & Prune... This may take a moment.`
    )).toBeInTheDocument();
  });
});
