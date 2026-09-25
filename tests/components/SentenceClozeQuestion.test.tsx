import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { SentenceClozeQuestion } from "@/app/solo/[sessionId]/components/SentenceClozeQuestion";
import { initializeSoloSession } from "@/lib/soloPracticeRuntime";
import { cssVarColors } from "@/app/components/themeCssVars";

function props() {
  return {
    session: { ...initializeSoloSession({ items: [{ kind: "sentence", maxLevel: 1 }], initialConfidenceByItemIndex: null, random: () => 0 }), questionLevel: 1 as const },
    currentSentence: { kind: "sentence" as const, englishPrompt: "I eat", spanishSentence: "Yo como", wordMeanings: ["I", "eat"], freeWordPositions: [1], distractors: ["bebo"], themeId: "theme" as Id<"themes">, themeName: "Basics", ttsStorageId: "audio" as Id<"_storage"> },
    hasMultipleThemes: true, onCorrect: vi.fn(), onIncorrect: vi.fn(), isTTSPlaying: false, isTTSDisabled: false, onPlayTTS: vi.fn(),
  };
}

describe("sentence cloze answering", () => {
  it("fills blanks in order, exposes meanings only for free words and locks a completed answer", () => {
    const p = props(); render(<SentenceClozeQuestion {...p} />);
    expect(screen.queryByText("Basics")).not.toBeNull();
    expect(screen.queryByTestId("solo-practice-sentence-chip-0-meaning")).toBeNull();
    expect(screen.getByTestId("solo-practice-sentence-chip-1-meaning").textContent).toBe("eat");
    const first = screen.getByTestId("solo-practice-sentence-chip-0") as HTMLButtonElement;
    fireEvent.click(first);
    expect(first.disabled).toBe(true);
    expect(first.style.borderColor).toBe(cssVarColors.status.success.DEFAULT);
    expect(screen.getByTestId("solo-practice-sentence-blank-0").textContent).toBe("yo");
    expect(p.onCorrect).not.toHaveBeenCalled();
    fireEvent.click(first);
    fireEvent.click(screen.getByTestId("solo-practice-sentence-chip-1"));
    expect(p.onCorrect).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(p.onCorrect).toHaveBeenCalledOnce();
    expect(p.onIncorrect).not.toHaveBeenCalled();
  });

  it("marks a wrong chip and prevents further clicks or keyboard submission", () => {
    const p = props(); render(<SentenceClozeQuestion {...p} hasMultipleThemes={false} />);
    expect(screen.queryByText("Basics")).toBeNull();
    const wrong = screen.getByTestId("solo-practice-sentence-chip-1") as HTMLButtonElement;
    fireEvent.click(wrong);
    expect(p.onIncorrect).toHaveBeenCalledOnce();
    expect(wrong.classList.contains("solo-sentence-chip-wrong")).toBe(true);
    expect(wrong.style.borderColor).toBe(cssVarColors.status.danger.DEFAULT);
    expect(wrong.disabled).toBe(true);
    fireEvent.click(screen.getByTestId("solo-practice-sentence-chip-0"));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(p.onIncorrect).toHaveBeenCalledOnce();
    expect(p.onCorrect).not.toHaveBeenCalled();
    expect(screen.getByTestId("solo-practice-sentence-blank-0").textContent).toBe("");
  });

  it("wraps in both arrow directions, ignores other keys, and skips used chips", () => {
    const p = props(); const view = render(<SentenceClozeQuestion {...p} />);
    const chips = screen.getAllByTestId(/^solo-practice-sentence-chip-\d+$/);
    const selectedIndex = () => chips.findIndex(chip => chip.style.boxShadow !== "");
    expect(selectedIndex()).toBe(0);
    fireEvent.keyDown(window, { key: "ArrowLeft" }); expect(selectedIndex()).toBe(1);
    fireEvent.keyDown(window, { key: "ArrowUp" }); expect(selectedIndex()).toBe(0);
    fireEvent.keyDown(window, { key: "ArrowDown" }); expect(selectedIndex()).toBe(1);
    fireEvent.keyDown(window, { key: "ArrowRight" }); expect(selectedIndex()).toBe(0);
    fireEvent.keyDown(window, { key: "x" }); expect(selectedIndex()).toBe(0);
    const yoIndex = chips.indexOf(screen.getByTestId("solo-practice-sentence-chip-0"));
    if (yoIndex === 1) fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(screen.getByTestId("solo-practice-sentence-blank-0").textContent).toBe("yo");
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "Enter" });
    expect(p.onCorrect).toHaveBeenCalledOnce();
    view.unmount();
    fireEvent.keyDown(window, { key: "Enter" });
    expect(p.onCorrect).toHaveBeenCalledOnce();
  });

  it.each(["got-it", "not-yet"])("accepts only the first recognition answer (%s)", first => {
    const p = props(); render(<SentenceClozeQuestion {...p} session={{ ...p.session, questionLevel: 0 }} />);
    fireEvent.click(screen.getByTestId(`solo-practice-sentence-level0-${first}`));
    fireEvent.click(screen.getByTestId("solo-practice-sentence-level0-got-it"));
    fireEvent.click(screen.getByTestId("solo-practice-sentence-level0-not-yet"));
    fireEvent.keyDown(window, { key: "Enter" });
    expect(p.onCorrect).toHaveBeenCalledTimes(first === "got-it" ? 1 : 0);
    expect(p.onIncorrect).toHaveBeenCalledTimes(first === "not-yet" ? 1 : 0);
  });

  it("offers stored recognition audio and disables it while busy, playing or unavailable", () => {
    const p = props(); const session = { ...p.session, questionLevel: 0 as const };
    const view = render(<SentenceClozeQuestion {...p} session={session} />);
    fireEvent.click(screen.getByTestId("solo-practice-sentence-listen"));
    expect(p.onPlayTTS).toHaveBeenCalledOnce();
    view.rerender(<SentenceClozeQuestion {...p} session={session} isTTSPlaying />);
    const listen = screen.getByTestId("solo-practice-sentence-listen") as HTMLButtonElement;
    expect(listen.disabled).toBe(true); expect(listen.textContent).toBe("Playing...");
    fireEvent.click(listen);
    view.rerender(<SentenceClozeQuestion {...p} session={session} isTTSDisabled />);
    expect(listen.disabled).toBe(true); fireEvent.click(listen);
    expect(p.onPlayTTS).toHaveBeenCalledOnce();
    view.rerender(<SentenceClozeQuestion {...p} session={session} currentSentence={{ ...p.currentSentence, ttsStorageId: undefined }} />);
    expect(screen.queryByTestId("solo-practice-sentence-listen")).toBeNull();
  });
});
