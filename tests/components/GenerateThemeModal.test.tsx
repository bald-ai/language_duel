import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GenerateThemeModal } from "@/app/themes/components/GenerateThemeModal";
import { WORD_TYPE_OPTIONS } from "@/lib/themes/wordTypes";

describe("GenerateThemeModal", () => {
  it("renders nothing when closed", () => {
    const { queryByTestId } = render(
      <GenerateThemeModal
        isOpen={false}
        themeName="Animals"
        themePrompt=""
        wordType="nouns"
        wordCount={10}
        isGenerating={false}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={vi.fn()}
        onWordCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(queryByTestId("theme-generate-modal")).toBeNull();
  });

  it("calls onWordCountChange with the integer when the slider changes", () => {
    const onWordCountChange = vi.fn();

    render(
      <GenerateThemeModal
        isOpen
        themeName="Animals"
        themePrompt=""
        wordType="nouns"
        wordCount={10}
        isGenerating={false}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={vi.fn()}
        onWordCountChange={onWordCountChange}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByTestId("theme-generate-word-count"), {
      target: { value: "15" },
    });

    expect(onWordCountChange).toHaveBeenCalledWith(15);
  });

  it("cycles word type with the carousel arrows", () => {
    const onWordTypeChange = vi.fn();

    const { rerender } = render(
      <GenerateThemeModal
        isOpen
        themeName="Animals"
        themePrompt=""
        wordType="nouns"
        wordCount={10}
        isGenerating={false}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={onWordTypeChange}
        onWordCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("theme-generate-type-next"));

    expect(onWordTypeChange).toHaveBeenNthCalledWith(1, "verbs");

    rerender(
      <GenerateThemeModal
        isOpen
        themeName="Animals"
        themePrompt=""
        wordType="verbs"
        wordCount={10}
        isGenerating={false}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={onWordTypeChange}
        onWordCountChange={vi.fn()}
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
        wordCount={10}
        isGenerating={false}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={onWordTypeChange}
        onWordCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("theme-generate-type-previous"));

    expect(onWordTypeChange).toHaveBeenNthCalledWith(3, "verbs");
  });

  it("renders labels from the shared word type options", () => {
    render(
      <GenerateThemeModal
        isOpen
        themeName="Animals"
        themePrompt=""
        wordType="nouns"
        wordCount={10}
        isGenerating={false}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={vi.fn()}
        onWordCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

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

    render(
      <GenerateThemeModal
        isOpen
        themeName="Animals"
        themePrompt=""
        wordType="nouns"
        wordCount={10}
        isGenerating={false}
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={onWordTypeChange}
        onWordCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId("theme-generate-type-verbs"));

    expect(onWordTypeChange).toHaveBeenCalledWith("verbs");
  });

  it("shows a generation error when provided", () => {
    render(
      <GenerateThemeModal
        isOpen
        themeName="Animals"
        themePrompt=""
        wordType="nouns"
        wordCount={10}
        isGenerating={false}
        error="Generation failed"
        onThemeNameChange={vi.fn()}
        onThemePromptChange={vi.fn()}
        onWordTypeChange={vi.fn()}
        onWordCountChange={vi.fn()}
        onGenerate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId("theme-generate-error")).toHaveTextContent("Generation failed");
  });
});
