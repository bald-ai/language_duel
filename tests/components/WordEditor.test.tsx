import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { WordEditor } from "@/app/themes/components/WordEditor";
import { CUSTOM_INSTRUCTIONS_MAX_LENGTH, THEME_USER_FEEDBACK_MAX_LENGTH, THEME_WORD_INPUT_MAX_LENGTH, THEME_ANSWER_INPUT_MAX_LENGTH, THEME_WRONG_ANSWER_INPUT_MAX_LENGTH } from "@/lib/themes/constants";
function props(overrides: Partial<ComponentProps<typeof WordEditor>> = {}): ComponentProps<typeof WordEditor> {
  return { editingField: "word", editingWrongIndex: 1, editMode: "choice", oldValue: "cat", generatedValue: "dog", manualValue: "dog", currentPrompt: "", userFeedback: "", promptSummary: "Create another animal", customInstructions: "", isGenerating: false, isRegenerating: false, showRegenerateModal: false, pendingManualWord: "dog", onGenerate: vi.fn(), onGoToManual: vi.fn(), onManualValueChange: vi.fn(), onUserFeedbackChange: vi.fn(), onCustomInstructionsChange: vi.fn(), onAcceptGenerated: vi.fn(), onRegenerate: vi.fn(), onSaveManual: vi.fn(), onRegenerateConfirm: vi.fn(), onRegenerateSkip: vi.fn(), onRegenerateCancel: vi.fn(), onBack: vi.fn(), ...overrides };
}
describe("word editor modes", () => {
  it("shows current content, generation guidance and choice actions", () => {
    const p = props(); render(<WordEditor {...p} />);
    expect(screen.getByRole("heading", { name: "Edit Word" })).toBeInTheDocument();
    expect(screen.getByText("cat")).toBeInTheDocument(); expect(screen.getByText("Create another animal")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("word-editor-generate")); expect(p.onGenerate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("word-editor-manual")); expect(p.onGoToManual).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("word-editor-cancel")); expect(p.onBack).toHaveBeenCalledOnce();
  });
  it("accepts instructions at the length limit and ignores overlong edits", () => {
    const p = props(); render(<WordEditor {...p} />);
    const text = "a".repeat(CUSTOM_INSTRUCTIONS_MAX_LENGTH);
    fireEvent.change(screen.getByTestId("word-editor-custom-instructions"), { target: { value: text } });
    expect(p.onCustomInstructionsChange).toHaveBeenCalledExactlyOnceWith(text);
    fireEvent.change(screen.getByTestId("word-editor-custom-instructions"), { target: { value: text + "x" } });
    expect(p.onCustomInstructionsChange).toHaveBeenCalledOnce();
  });
  it.each(["choice", "generate"] as const)("blocks another generation request in busy %s mode", editMode => {
    const p = props({ editMode, isGenerating: true }); render(<WordEditor {...p} />);
    const button = screen.getByTestId(editMode === "choice" ? "word-editor-generate" : "word-editor-regenerate");
    expect(button).toBeDisabled(); fireEvent.click(button);
    expect(p.onGenerate).not.toHaveBeenCalled(); expect(p.onRegenerate).not.toHaveBeenCalled();
  });
  it.each([["word", "Word", THEME_WORD_INPUT_MAX_LENGTH], ["answer", "Answer", THEME_ANSWER_INPUT_MAX_LENGTH], ["wrong", "Wrong 2", THEME_WRONG_ANSWER_INPUT_MAX_LENGTH]] as const)("applies the correct limit to a manual %s edit", (editingField, label, limit) => {
    const p = props({ editingField, editMode: "manual" }); render(<WordEditor {...p} />);
    expect(screen.getByRole("heading", { name: `Edit ${label}` })).toBeInTheDocument();
    const input = screen.getByTestId("word-editor-manual-input"); expect(input).toHaveAttribute("maxLength", String(limit));
    fireEvent.change(input, { target: { value: "a".repeat(limit) } }); expect(p.onManualValueChange).toHaveBeenCalledExactlyOnceWith("a".repeat(limit));
    fireEvent.change(input, { target: { value: "a".repeat(limit + 1) } }); expect(p.onManualValueChange).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("word-editor-save-manual")); expect(p.onSaveManual).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("word-editor-cancel")); expect(p.onBack).toHaveBeenCalledOnce();
  });
  it("does not save an empty manual value", () => {
    const p = props({ editMode: "manual", manualValue: "   " }); render(<WordEditor {...p} />);
    expect(screen.getByTestId("word-editor-save-manual")).toBeDisabled(); fireEvent.click(screen.getByTestId("word-editor-save-manual")); expect(p.onSaveManual).not.toHaveBeenCalled();
  });
  it("offers generated word acceptance without answer feedback", () => {
    const p = props({ editMode: "generate" }); render(<WordEditor {...p} />);
    expect(screen.getByText("Old Word")).toBeInTheDocument(); expect(screen.getByText("New Word")).toBeInTheDocument(); expect(screen.getByText("dog")).toBeInTheDocument();
    expect(screen.queryByTestId("word-editor-user-feedback")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("word-editor-accept")); expect(p.onAcceptGenerated).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("word-editor-regenerate")); expect(p.onRegenerate).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByTestId("word-editor-cancel")); expect(p.onBack).toHaveBeenCalledOnce();
  });
  it("limits feedback for generated answers", () => {
    const p = props({ editMode: "generate", editingField: "answer" }); render(<WordEditor {...p} />);
    const input = screen.getByTestId("word-editor-user-feedback"); const text = "a".repeat(THEME_USER_FEEDBACK_MAX_LENGTH);
    fireEvent.change(input, { target: { value: text } }); expect(p.onUserFeedbackChange).toHaveBeenCalledExactlyOnceWith(text);
    fireEvent.change(input, { target: { value: text + "x" } }); expect(p.onUserFeedbackChange).toHaveBeenCalledOnce();
  });
  it.each(["confirm", "skip", "cancel"] as const)("offers the regeneration %s action for a changed word", action => {
    const p = props({ showRegenerateModal: true }); render(<WordEditor {...p} />);
    expect(screen.getByText("Regenerate Answers?")).toBeInTheDocument(); expect(screen.getByText("dog")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`theme-regenerate-${action}`));
    const callback = { confirm: p.onRegenerateConfirm, skip: p.onRegenerateSkip, cancel: p.onRegenerateCancel }[action]; expect(callback).toHaveBeenCalledOnce();
  });
  it("keeps the regeneration modal busy until its operation finishes", () => {
    const p = props({ showRegenerateModal: true, isRegenerating: true }); render(<WordEditor {...p} />);
    expect(screen.getByText("Generating new answers...")).toBeInTheDocument();
    for (const action of ["confirm", "skip", "cancel"]) expect(screen.getByTestId(`theme-regenerate-${action}`)).toBeDisabled();
  });
});
