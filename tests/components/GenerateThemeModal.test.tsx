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
        generationMode={null}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={vi.fn()}
        onGenerate={vi.fn()}
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
        generationMode={null}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={vi.fn()}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId("theme-generate-modal")).toBeNull();
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
        generationMode={null}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={onWordTypeChange}
        onGenerate={vi.fn()}
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
        generationMode={null}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={onWordTypeChange}
        onGenerate={vi.fn()}
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

  it("uses the main Generate button for Pick & Prune review", () => {
    const onGenerate = vi.fn();
    renderModal({ onGenerate });

    expect(screen.getByTestId("theme-generate-pick-prune-summary")).toHaveTextContent(
      `Generate ${PICK_AND_PRUNE_WORD_COUNT} words`
    );
    expect(screen.queryByTestId("theme-pick-prune-try")).toBeNull();

    fireEvent.click(screen.getByTestId("theme-generate-submit"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("disables Generate when theme name is empty", () => {
    renderModal({ themeName: "" });
    expect(screen.getByTestId("theme-generate-submit")).toBeDisabled();
  });

  it("shows Pick & Prune loading text when that mode is generating", () => {
    renderModal({ generationMode: "pick-and-prune" });
    expect(screen.getByText(
      `Generating ${PICK_AND_PRUNE_WORD_COUNT} words for Pick & Prune... This may take a moment.`
    )).toBeInTheDocument();
  });
});
