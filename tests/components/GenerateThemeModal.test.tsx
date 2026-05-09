import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { GenerateThemeModal } from "@/app/themes/components/GenerateThemeModal";

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

    fireEvent.click(screen.getByTestId("theme-generate-type-previous"));

    expect(onWordTypeChange).toHaveBeenNthCalledWith(1, "verbs");
    expect(onWordTypeChange).toHaveBeenNthCalledWith(2, "nouns");
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
