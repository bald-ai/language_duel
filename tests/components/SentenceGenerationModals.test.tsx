import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GenerateSentenceThemeModal } from "@/app/themes/components/GenerateSentenceThemeModal";
import { GenerateMoreSentenceRoundsModal } from "@/app/themes/components/GenerateMoreSentenceRoundsModal";
import { THEME_NAME_MAX_LENGTH, THEME_PROMPT_MAX_LENGTH } from "@/app/themes/constants";

describe("sentence generation dialogs", () => {
  it("stays hidden while closed and requires a nonblank name before submitting the chosen count and prompt", () => {
    const props = { isOpen: false, isGenerating: false, error: null, onClose: vi.fn(), onGenerate: vi.fn() };
    const { rerender } = render(<GenerateSentenceThemeModal {...props} />);
    expect(screen.queryByTestId("sentence-theme-generate-modal")).toBeNull();
    rerender(<GenerateSentenceThemeModal {...props} isOpen />);
    const name = screen.getByTestId("sentence-theme-generate-name");
    const submit = screen.getByTestId("sentence-theme-generate-submit");
    expect(submit).toBeDisabled(); fireEvent.change(name, { target: { value: "   " } }); expect(submit).toBeDisabled();
    fireEvent.change(name, { target: { value: "Coffee" } });
    fireEvent.change(screen.getByTestId("sentence-theme-generate-prompt"), { target: { value: "Polite requests" } });
    fireEvent.change(screen.getByTestId("sentence-theme-generate-round-count"), { target: { value: "15" } });
    expect(screen.getByText(/generate 30 short Spanish sentences/)).toBeInTheDocument();
    fireEvent.click(submit); expect(props.onGenerate).toHaveBeenCalledExactlyOnceWith({ themeName: "Coffee", themePrompt: "Polite requests", targetRoundCount: 15 });
    fireEvent.click(screen.getByTestId("sentence-theme-generate-cancel")); expect(props.onClose).toHaveBeenCalledOnce();
  });
  it.each([["name", THEME_NAME_MAX_LENGTH], ["prompt", THEME_PROMPT_MAX_LENGTH]] as const)("accepts the %s limit and refuses longer edits", (field, limit) => {
    render(<GenerateSentenceThemeModal isOpen isGenerating={false} error={null} onClose={vi.fn()} onGenerate={vi.fn()} />);
    const input = screen.getByTestId(`sentence-theme-generate-${field}`);
    expect(input).toHaveAttribute("maxLength", String(limit));
    fireEvent.change(input, { target: { value: "a".repeat(limit) } }); expect((input as HTMLInputElement).value).toBe("a".repeat(limit));
    fireEvent.change(input, { target: { value: "b".repeat(limit + 1) } }); expect((input as HTMLInputElement).value).toBe("a".repeat(limit));
  });
  it("shows errors while idle and locks fields and actions during generation", () => {
    const props = { isOpen: true, isGenerating: false, error: "Try again", onClose: vi.fn(), onGenerate: vi.fn() };
    const { rerender } = render(<GenerateSentenceThemeModal {...props} />);
    expect(screen.getByTestId("sentence-theme-generate-error")).toHaveTextContent("Try again");
    rerender(<GenerateSentenceThemeModal {...props} isGenerating />);
    expect(screen.queryByTestId("sentence-theme-generate-error")).toBeNull();
    expect(screen.getByText(/Generating 20 sentences/)).toBeInTheDocument();
    for (const suffix of ["name", "prompt", "round-count", "submit", "cancel"]) expect(screen.getByTestId(`sentence-theme-generate-${suffix}`)).toBeDisabled();
    fireEvent.click(screen.getByTestId("sentence-theme-generate-submit")); fireEvent.click(screen.getByTestId("sentence-theme-generate-cancel"));
    expect(props.onGenerate).not.toHaveBeenCalled(); expect(props.onClose).not.toHaveBeenCalled();
  });
  it("shows the existing theme and errors, submits, cancels, and prevents actions while adding more", () => {
    const props = { isOpen: false, themeName: "Coffee", isGenerating: false, error: "Try again", onGenerate: vi.fn(), onClose: vi.fn() };
    const { rerender } = render(<GenerateMoreSentenceRoundsModal {...props} />);
    expect(screen.queryByTestId("sentence-generate-more-modal")).toBeNull();
    rerender(<GenerateMoreSentenceRoundsModal {...props} isOpen />);
    expect(screen.getByText(/new sentence rounds for "Coffee"/)).toBeInTheDocument();
    expect(screen.getByTestId("sentence-generate-more-error")).toHaveTextContent("Try again");
    fireEvent.click(screen.getByTestId("sentence-generate-more-submit")); fireEvent.click(screen.getByTestId("sentence-generate-more-cancel"));
    expect(props.onGenerate).toHaveBeenCalledOnce(); expect(props.onClose).toHaveBeenCalledOnce();
    rerender(<GenerateMoreSentenceRoundsModal {...props} isOpen isGenerating />);
    expect(screen.queryByTestId("sentence-generate-more-error")).toBeNull();
    expect(screen.getByTestId("sentence-generate-more-submit")).toBeDisabled(); expect(screen.getByTestId("sentence-generate-more-cancel")).toBeDisabled();
    expect(screen.getByText(/Generating 10 more sentences/)).toBeInTheDocument();
    rerender(<GenerateMoreSentenceRoundsModal {...props} isOpen error={null} />);
    expect(screen.queryByTestId("sentence-generate-more-error")).toBeNull();
  });
});
