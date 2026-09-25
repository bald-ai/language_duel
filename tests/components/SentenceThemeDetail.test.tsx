import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { SentenceThemeDetail } from "@/app/themes/components/SentenceThemeDetail";
import { SentenceRoundCard } from "@/app/themes/components/SentenceRoundCard";
import type { SentenceRoundInput } from "@/lib/themes/sentenceTypes";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), back: vi.fn() }) }));

const round: SentenceRoundInput = {
  englishPrompt: "I want coffee", spanishSentence: "Quiero cafe", distractors: ["leche", "pan", "agua"],
  wordMeanings: ["I want", "coffee"], freeWordPositions: [1], ttsStorageId: "audio_1" as Id<"_storage">,
};
function props(overrides: Partial<ComponentProps<typeof SentenceThemeDetail>> = {}): ComponentProps<typeof SentenceThemeDetail> {
  return { theme: { name: "COFFEE", description: "Cafe phrases", rounds: [round], canEdit: true, isOwner: true },
    localRounds: [round], onThemeNameChange: vi.fn(), onDeleteRound: vi.fn(), onEditField: vi.fn(),
    onToggleFreeWord: vi.fn(), onSave: vi.fn(), onCancel: vi.fn(), onOpenAddRound: vi.fn(),
    onOpenGenerateMore: vi.fn(), onPlaySentenceTTS: vi.fn(), ...overrides };
}

describe("sentence theme detail", () => {
  it("connects authoring actions, free-word selection, and saved audio to the correct round", () => {
    const p = props();
    render(<SentenceThemeDetail {...p} />);
    expect(screen.getByTestId("sentence-round-0-number-badge").style.backgroundImage).toContain("linear-gradient");
    expect(screen.getByTestId("sentence-round-0-english").getAttribute("data-invalid")).toBe("false");
    expect(screen.getByTestId("sentence-round-0-spanish").getAttribute("data-invalid")).toBe("false");
    fireEvent.click(screen.getByTestId("theme-add-sentence"));
    expect(p.onOpenAddRound).toHaveBeenCalledTimes(1);
    for (const field of ["english", "spanish", "distractor-2"]) fireEvent.click(screen.getByTestId(`sentence-round-0-${field}`));
    expect(p.onEditField).toHaveBeenNthCalledWith(1, 0, "english");
    expect(p.onEditField).toHaveBeenNthCalledWith(2, 0, "spanish");
    expect(p.onEditField).toHaveBeenNthCalledWith(3, 0, "distractor", 2);
    fireEvent.click(screen.getByTestId("sentence-round-0-free-word-0"));
    expect(p.onToggleFreeWord).toHaveBeenCalledWith(0, 0);
    expect(screen.queryByTestId("sentence-round-0-free-word-0-meaning")).toBeNull();
    expect(screen.getByTestId("sentence-round-0-free-word-1-meaning").textContent).toBe("coffee");
    fireEvent.click(screen.getByTestId("sentence-round-0-play-tts"));
    expect(p.onPlaySentenceTTS).toHaveBeenCalledWith(0, "Quiero cafe", "audio_1");
    fireEvent.click(screen.getByTestId("sentence-round-0-delete"));
    expect(p.onDeleteRound).toHaveBeenCalledWith(0);
    fireEvent.click(screen.getByTestId("theme-save"));
    expect(p.onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("theme-cancel"));
    expect(p.onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows per-field validation and prevents saving an invalid manual draft", () => {
    const p = props({ localRounds: [{ englishPrompt: "", spanishSentence: "", distractors: [] }] });
    render(<SentenceThemeDetail {...p} />);
    expect(screen.getByTestId("sentence-round-0-number-badge").style.backgroundImage).toBe("");
    expect(screen.getByTestId("sentence-round-0-english").getAttribute("data-invalid")).toBe("true");
    expect(screen.getByTestId("sentence-round-0-spanish").getAttribute("data-invalid")).toBe("true");
    expect(screen.getByTestId("sentence-round-0-issue-message").textContent).not.toBe("");
    expect(screen.getByText("Tap “Edit text” to add a Spanish sentence")).not.toBeNull();
    for (let index = 0; index < 3; index++) expect(screen.getByTestId(`sentence-round-0-distractor-${index}`).textContent).toContain("—");
    fireEvent.click(screen.getByTestId("theme-save"));
    fireEvent.click(screen.getByTestId("sentence-round-0-play-tts"));
    expect(p.onSave).not.toHaveBeenCalled();
    expect(p.onPlaySentenceTTS).not.toHaveBeenCalled();
  });

  it.each([
    { localRounds: [] },
    { isSaving: true },
    { localRounds: [round, round] },
  ])("blocks saving empty, pending, and duplicate content (%#)", override => {
    const p = props(override);
    render(<SentenceThemeDetail {...p} />);
    fireEvent.click(screen.getByTestId("theme-save"));
    expect(p.onSave).not.toHaveBeenCalled();
  });

  it("allows reading and audio for a friend's theme while preventing content edits", () => {
    const p = props();
    p.theme = { ...p.theme, isOwner: false, canEdit: false, ownerNickname: "Alex", ownerDiscriminator: 1234 };
    render(<SentenceThemeDetail {...p} playingRoundKey="sentence-round-tts-0" />);
    expect(screen.getByText("by Alex#1234")).not.toBeNull();
    fireEvent.click(screen.getByTestId("sentence-round-0-english"));
    fireEvent.click(screen.getByTestId("sentence-round-0-distractor-0"));
    fireEvent.click(screen.getByTestId("sentence-round-0-free-word-1"));
    expect(p.onEditField).not.toHaveBeenCalled();
    expect(p.onToggleFreeWord).not.toHaveBeenCalled();
    expect(screen.queryByTestId("sentence-round-0-delete")).toBeNull();
    expect(screen.queryByTestId("sentence-round-0-spanish")).toBeNull();
    expect(screen.queryByTestId("theme-save")).toBeNull();
    fireEvent.click(screen.getByTestId("sentence-round-0-play-tts"));
    expect(p.onPlaySentenceTTS).toHaveBeenCalledTimes(1);
  });

  it("marks matching distractors for repair", () => {
    render(<SentenceThemeDetail {...props({ localRounds: [{ ...round, distractors: ["cafe", "pan", "agua"] }] })} />);
    expect(screen.getByTestId("sentence-round-0-distractor-0").getAttribute("data-invalid")).toBe("true");
    expect(screen.getByTestId("sentence-round-0-distractor-1").getAttribute("data-invalid")).toBe("false");
    expect(screen.getByTestId("sentence-round-0-issue-message").textContent).toBe("Distractor issue");
  });

  it("handles unavailable audio callback and missing translations in a manual card", () => {
    const p = { round: { ...round, wordMeanings: undefined }, index: 2, canEdit: true,
      issues: { isDuplicate: false, englishHasIssue: false, spanishHasIssue: false, distractorHasIssue: new Set<number>(), issueMessage: null },
      onEditField: vi.fn(), onToggleFreeWord: vi.fn(), onDeleteRound: vi.fn() };
    const { rerender } = render(<SentenceRoundCard {...p} />);
    fireEvent.click(screen.getByTestId("sentence-round-2-play-tts"));
    expect(screen.getByTestId("sentence-round-2-free-word-1-meaning").textContent).toBe("placeholder");
    rerender(<SentenceRoundCard {...p} canEdit={false} round={{ ...round, spanishSentence: "" }} />);
    expect(screen.queryByTestId("sentence-round-2-free-word-0")).toBeNull();
    expect(screen.getByTestId("sentence-round-2-free-words").textContent).toContain("—");
  });
});
