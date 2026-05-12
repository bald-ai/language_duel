import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { GenerateThemeModal } from "@/app/themes/components/GenerateThemeModal";
import { PICK_AND_PRUNE_WORD_COUNT } from "@/app/themes/constants";
import { WORD_TYPE_OPTIONS } from "@/lib/themes/wordTypes";

describe("GenerateThemeModal", () => {
  function renderModal(overrides: Partial<ComponentProps<typeof GenerateThemeModal>> = {}) {
    return render(
      <GenerateThemeModal
        isOpen
        themeName="Animals"
        themePrompt=""
        wordType="nouns"
        wordCount={10}
        generationMode={null}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={vi.fn()}
        onWordCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onGeneratePickAndPrune={vi.fn()}
        onClose={vi.fn()}
        {...overrides}
      />
    );
  }

  it("renders nothing when closed", () => {
    const { queryByTestId } = render(
      <GenerateThemeModal
        isOpen={false}
        themeName="Animals"
        themePrompt=""
        wordType="nouns"
        wordCount={10}
        generationMode={null}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={vi.fn()}
        onWordCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onGeneratePickAndPrune={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId("theme-generate-modal")).toBeNull();
  });

  it("calls onWordCountChange with the integer when the slider changes", () => {
    const onWordCountChange = vi.fn();

    renderModal({ onWordCountChange });

    fireEvent.change(screen.getByTestId("theme-generate-word-count"), {
      target: { value: "15" },
    });

    expect(onWordCountChange).toHaveBeenCalledWith(15);
  });

  it("cycles word type with the carousel arrows", () => {
    const onWordTypeChange = vi.fn();

    const { rerender } = renderModal({ onWordTypeChange });

    fireEvent.click(screen.getByTestId("theme-generate-type-next"));

    expect(onWordTypeChange).toHaveBeenNthCalledWith(1, "verbs");

    rerender(
      <GenerateThemeModal
        isOpen
        themeName="Animals"
        themePrompt=""
        wordType="verbs"
        wordCount={10}
        generationMode={null}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={onWordTypeChange}
        onWordCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onGeneratePickAndPrune={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("theme-generate-type-next"));

    expect(onWordTypeChange).toHaveBeenNthCalledWith(2, "adjectives");

    rerender(
      <GenerateThemeModal
        isOpen
        themeName="Animals"
        themePrompt=""
        wordType="adjectives"
        wordCount={10}
        generationMode={null}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={onWordTypeChange}
        onWordCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onGeneratePickAndPrune={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("theme-generate-type-previous"));

    expect(onWordTypeChange).toHaveBeenNthCalledWith(3, "verbs");
  });

  it("renders labels from the shared word type options", () => {
    renderModal();

    expect(screen.getByTestId("theme-generate-type-selected")).toHaveTextContent(
      WORD_TYPE_OPTIONS[0].label
    );
    for (const option of WORD_TYPE_OPTIONS) {
      expect(screen.getByTestId(`theme-generate-type-${option.value}`)).toHaveAttribute(
        "aria-label",
        `Select ${option.label}`
      );
    }
  });

  it("selects word type with the carousel dots", () => {
    const onWordTypeChange = vi.fn();

    renderModal({ onWordTypeChange });

    fireEvent.click(screen.getByTestId("theme-generate-type-verbs"));

    expect(onWordTypeChange).toHaveBeenCalledWith("verbs");
  });

  it("shows a generation error when provided", () => {
    renderModal({ error: "Generation failed" });

    expect(screen.getByTestId("theme-generate-error")).toHaveTextContent("Generation failed");
  });

  it("renders the experimental Pick & Prune info and triggers try action", () => {
    const onGeneratePickAndPrune = vi.fn();
    renderModal({ onGeneratePickAndPrune });

    expect(screen.getByTestId("theme-pick-prune-info")).toHaveTextContent("Try Pick & Prune");
    expect(screen.getByTestId("theme-pick-prune-info")).toHaveTextContent(
      `generate ${PICK_AND_PRUNE_WORD_COUNT} words for review`
    );
    fireEvent.click(screen.getByTestId("theme-pick-prune-try"));
    expect(onGeneratePickAndPrune).toHaveBeenCalledTimes(1);
  });

  it("disables Pick & Prune try when theme name is empty", () => {
    renderModal({ themeName: "" });
    expect(screen.getByTestId("theme-pick-prune-try")).toBeDisabled();
  });

  it("shows Pick & Prune loading text when that mode is generating", () => {
    renderModal({ generationMode: "pick-and-prune" });
    expect(screen.getByText(
      `Generating ${PICK_AND_PRUNE_WORD_COUNT} words for Pick & Prune... This may take a moment.`
    )).toBeInTheDocument();
  });
});
