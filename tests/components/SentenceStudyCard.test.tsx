import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { SentenceStudyCard } from "@/app/solo/learn/[sessionId]/components/SentenceStudyCard";
import type { Id } from "@/convex/_generated/dataModel";
import { cssVarColors as colors } from "@/app/components/themeCssVars";
type Props = ComponentProps<typeof SentenceStudyCard>;
function props(overrides: Partial<Props> = {}): Props {
  return { sentence: { kind: "sentence", themeId: "theme" as Id<"themes">, themeName: "Animals", englishPrompt: "The cat sleeps", spanishSentence: "El gato duerme", wordMeanings: ["the", "cat", "sleeps"], freeWordPositions: [], distractors: ["perro", "come", "pez"], ttsStorageId: "audio" as Id<"_storage"> }, confidence: 1, maxConfidenceLevel: 3, onConfidenceChange: vi.fn(), position: 2, showThemeLabel: true, revealedPositions: [], onRevealToken: vi.fn(), onRevealAll: vi.fn(), onHide: vi.fn(), isTTSPlaying: false, isTTSDisabled: false, onPlayTTS: vi.fn(), dataTestIdBase: "sentence", ...overrides };
}
describe("sentence study card", () => {
  it("reveals individual words, counts remaining hints, reveals all, and hides them again", () => {
    const callbacks = props();
    function ControlledCard() {
      const [revealedPositions, setRevealed] = useState<number[]>([]);
      return <SentenceStudyCard {...callbacks} revealedPositions={revealedPositions} onRevealToken={index => { callbacks.onRevealToken(index); setRevealed(previous => [...previous, index]); }} onRevealAll={positions => { callbacks.onRevealAll(positions); setRevealed(positions); }} onHide={() => { callbacks.onHide(); setRevealed([]); }} />;
    }
    render(<ControlledCard />);
    expect(screen.getByTestId("sentence-position")).toHaveTextContent("2"); expect(screen.getByTestId("sentence-theme")).toHaveTextContent("Animals"); expect(screen.getByTestId("sentence-english")).toHaveTextContent("The cat sleeps");
    expect(screen.getByTestId("sentence-hints-remaining").textContent).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "Reveal word 2" }));
    expect(callbacks.onRevealToken).toHaveBeenCalledExactlyOnceWith(1); expect(screen.getByTestId("sentence-token-1").textContent).toBe("gato"); expect(screen.queryByRole("button", { name: "Reveal word 2" })).toBeNull();
    expect(screen.getByTestId("sentence-hints-remaining").textContent).toBe("2");
    fireEvent.click(screen.getByRole("button", { name: "Reveal sentence" }));
    expect(callbacks.onRevealAll).toHaveBeenCalledExactlyOnceWith([0, 1, 2]); expect(screen.getByTestId("sentence-hints-remaining").textContent).toBe("0");
    expect(screen.getByTestId("sentence-spanish")).toHaveTextContent("Elgatoduerme");
    fireEvent.click(screen.getByRole("button", { name: "Hide sentence" })); expect(callbacks.onHide).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("button", { name: /Reveal word/ })).toHaveLength(3); expect(screen.getByTestId("sentence-hints-remaining").textContent).toBe("3");
  });
  it("keeps reveal and confidence mouse gestures inside the card and reports confidence changes", () => {
    const outerMouseDown = vi.fn(); const p = props({ maxConfidenceLevel: 2 });
    render(<div onMouseDown={outerMouseDown}><SentenceStudyCard {...p} /></div>);
    fireEvent.mouseDown(screen.getByTestId("sentence-token-0")); fireEvent.mouseDown(screen.getByRole("button", { name: "Increase confidence" })); expect(outerMouseDown).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Increase confidence" })); expect(p.onConfidenceChange).toHaveBeenCalledExactlyOnceWith(2);
    fireEvent.click(screen.getByRole("button", { name: "Decrease confidence" })); expect(p.onConfidenceChange).toHaveBeenLastCalledWith(0);
  });
  it.each([
    [false, false, true, false, colors.background.elevated],
    [true, false, true, false, colors.secondary.DEFAULT],
    [false, true, true, true, colors.background.DEFAULT],
    [false, false, false, true, colors.background.DEFAULT],
  ] as const)("handles audio playing=%s blocked=%s stored=%s", (isTTSPlaying, isTTSDisabled, stored, disabled, background) => {
    const p = props({ isTTSPlaying, isTTSDisabled });
    if (!stored) { const { ttsStorageId: _audio, ...sentence } = p.sentence; p.sentence = sentence; }
    render(<SentenceStudyCard {...p} />);
    const button = screen.getByRole("button", { name: "Listen" }) as HTMLButtonElement;
    expect(button.disabled).toBe(disabled); expect(button.style.backgroundColor).toBe(background);
    expect(button.getAttribute("title")).toBe(stored ? null : "Sentence audio has not been generated");
    fireEvent.click(button); expect(p.onPlayTTS).toHaveBeenCalledTimes(disabled ? 0 : 1);
  });
  it("supports cards without test IDs or theme labels and counts repeated reveal indices once", () => {
    render(<SentenceStudyCard {...props({ dataTestIdBase: undefined, showThemeLabel: false, revealedPositions: [0, 0] })} />);
    expect(screen.queryByText("Animals")).toBeNull(); expect(screen.getByText("El")).toBeInTheDocument(); expect(screen.getAllByRole("button", { name: /Reveal word/ })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Listen" }).getAttribute("data-testid")).toBeNull();
  });
});
