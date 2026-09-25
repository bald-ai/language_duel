import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SentenceRoundEditor } from "@/app/themes/components/SentenceRoundEditor";
import { DeleteConfirmModal } from "@/app/themes/components/DeleteConfirmModal";
import { SentenceHintPoolUI } from "@/app/duel/[duelId]/components/SentenceHintPoolUI";
import { SENTENCE_DISTRACTOR_MAX_LENGTH, SENTENCE_ENGLISH_PROMPT_MAX_LENGTH, SENTENCE_SPANISH_TOKEN_MAX_LENGTH } from "@/lib/themes/sentenceConstants";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

describe("sentence field editing", () => {
  it.each([
    ["english", "English prompt", SENTENCE_ENGLISH_PROMPT_MAX_LENGTH],
    ["spanish", "Spanish sentence", SENTENCE_SPANISH_TOKEN_MAX_LENGTH * 8 + 16],
    ["distractor", "Distractor 2", SENTENCE_DISTRACTOR_MAX_LENGTH],
  ] as const)("edits %s up to its limit and saves the entered value", (field, label, max) => {
    const save = vi.fn(); const back = vi.fn();
    const props = { themeName: "Travel", roundIndex: 2, field, distractorIndex: 1, initialValue: "Original", onSave: save, onBack: back };
    const view = render(<SentenceRoundEditor {...props} />);
    expect(screen.getByText("Travel · Sentence 3")).toBeInTheDocument();
    expect(screen.getByText(label)).toBeInTheDocument();
    const input = screen.getByTestId("sentence-editor-input") as HTMLInputElement;
    expect(input.tagName).toBe(field === "distractor" ? "INPUT" : "TEXTAREA");
    fireEvent.change(input, { target: { value: "a".repeat(max) } });
    expect(input.value).toBe("a".repeat(max));
    fireEvent.change(input, { target: { value: "b".repeat(max + 1) } });
    expect(input.value).toBe("a".repeat(max));
    fireEvent.click(screen.getByTestId("sentence-editor-save"));
    expect(save).toHaveBeenCalledExactlyOnceWith("a".repeat(max));
    view.rerender(<SentenceRoundEditor {...props} initialValue="Next field" />);
    expect(input.value).toBe("Next field");
    fireEvent.click(screen.getByTestId("sentence-editor-cancel"));
    fireEvent.click(screen.getByTestId("sentence-editor-back"));
    expect(back).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledOnce();
  });
});

describe("deletion confirmation", () => {
  it("stays hidden when closed", () => {
    const view = render(<DeleteConfirmModal isOpen={false} itemName="Travel" itemType="theme" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(view.container).toBeEmptyDOMElement();
  });
  it.each(["theme", "word"] as const)("identifies the %s and dispatches confirm and cancel", itemType => {
    const confirm = vi.fn(); const cancel = vi.fn();
    render(<DeleteConfirmModal isOpen itemName="Travel" itemType={itemType} onConfirm={confirm} onCancel={cancel} />);
    expect(screen.getByText("Travel")).toBeInTheDocument();
    expect(screen.getByText(itemType === "theme" ? "This will permanently delete this theme and all its items." : "This will remove the word from this theme.")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("theme-delete-confirm"));
    fireEvent.click(screen.getByTestId("theme-delete-cancel"));
    expect(confirm).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalledOnce();
  });
  it("prevents repeat confirmation and cancellation while deleting", () => {
    const confirm = vi.fn(); const cancel = vi.fn();
    render(<DeleteConfirmModal isOpen isDeleting itemName="Travel" itemType="theme" onConfirm={confirm} onCancel={cancel} />);
    expect(screen.getByTestId("theme-delete-confirm")).toHaveTextContent("Deleting...");
    fireEvent.click(screen.getByTestId("theme-delete-confirm")); fireEvent.click(screen.getByTestId("theme-delete-cancel"));
    expect(confirm).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled();
  });
});

describe("cooperative sentence hints", () => {
  it("shows the pool balance and fires the selected hint type", () => {
    const fire = vi.fn();
    render(<SentenceHintPoolUI usedHints={[]} usedCount={0} totalCount={3} currentQuestionHintFired={false} onFireHint={fire} />);
    expect(screen.getByText("0/3")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Freeze (+30s)"));
    fireEvent.click(screen.getByTitle("Remove distractors"));
    fireEvent.click(screen.getByTitle("Reveal 2 tiles"));
    expect(fire.mock.calls).toEqual([["freeze_time"], ["remove_distractor"], ["reveal_tiles"]]);
  });
  it("disables an already used hint while leaving the others available", () => {
    const fire = vi.fn();
    render(<SentenceHintPoolUI usedHints={["freeze_time"]} usedCount={1} totalCount={3} currentQuestionHintFired={false} onFireHint={fire} />);
    expect((screen.getByTitle("Freeze (+30s)") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTitle("Reveal 2 tiles") as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByTitle("Freeze (+30s)")); expect(fire).not.toHaveBeenCalled();
  });
  it.each(["question", "pool"])("blocks all hints when the %s allowance is spent", reason => {
    const fire = vi.fn();
    render(<SentenceHintPoolUI usedHints={[]} usedCount={reason === "pool" ? 3 : 0} totalCount={3} currentQuestionHintFired={reason === "question"} onFireHint={fire} />);
    for (const button of screen.getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(true); fireEvent.click(button);
    }
    expect(fire).not.toHaveBeenCalled();
  });
});
