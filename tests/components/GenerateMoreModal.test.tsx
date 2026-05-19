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
        count={1}
        isGenerating={false}
        pickAndPrune={false}
        error={null}
        onCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onGeneratePickAndPrune={vi.fn()}
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
        count={1}
        isGenerating={false}
        pickAndPrune={false}
        error={null}
        onCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onGeneratePickAndPrune={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId("theme-generate-more-modal")).toBeNull();
  });

  it("handles range changes and action buttons", () => {
    const onCountChange = vi.fn();
    const onGenerate = vi.fn();
    const onClose = vi.fn();

    renderModal({ onCountChange, onGenerate, onClose });

    expect(screen.getByTestId("theme-generate-more-range")).toHaveValue("1");

    fireEvent.change(screen.getByTestId("theme-generate-more-range"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByTestId("theme-generate-more-submit"));
    fireEvent.click(screen.getByTestId("theme-generate-more-cancel"));

    expect(onCountChange).toHaveBeenCalledWith(3);
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows count, error, and disables controls while generating", () => {
    renderModal({ count: 3, isGenerating: true, pickAndPrune: false, error: "Rate limit" });

    expect(screen.getByTestId("theme-generate-more-range")).toHaveValue("3");
    expect(screen.getByText("Rate limit")).toBeInTheDocument();
    expect(screen.getByTestId("theme-generate-more-submit")).toBeDisabled();
    expect(screen.getByTestId("theme-generate-more-cancel")).toBeDisabled();
    expect(screen.getByTestId("theme-generate-more-pick-prune-try")).toBeDisabled();
  });

  it("renders Pick & Prune info and triggers try action", () => {
    const onGeneratePickAndPrune = vi.fn();
    renderModal({ onGeneratePickAndPrune });

    expect(screen.getByTestId("theme-generate-more-pick-prune-info")).toHaveTextContent(
      "Try Pick & Prune"
    );
    expect(screen.getByTestId("theme-generate-more-pick-prune-info")).toHaveTextContent(
      `generate ${GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT} new unique words`
    );
    fireEvent.click(screen.getByTestId("theme-generate-more-pick-prune-try"));
    expect(onGeneratePickAndPrune).toHaveBeenCalledTimes(1);
  });

  it("shows Pick & Prune loading text when pickAndPrune is generating", () => {
    renderModal({ isGenerating: true, pickAndPrune: true });

    expect(screen.getByText(
      `Generating ${GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT} words for Pick & Prune... This may take a moment.`
    )).toBeInTheDocument();
  });
});
