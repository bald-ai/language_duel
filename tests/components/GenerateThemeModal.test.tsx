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
});
