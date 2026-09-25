import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WordCard } from "@/app/solo/learn/[sessionId]/components/WordCard";
import { cssVarColors } from "@/app/components/themeCssVars";
function props() {
  return { word: { word: "cat", answer: "gato" }, confidence: 1 as const, onConfidenceChange: vi.fn(), revealedPositions: [] as number[], hintsRemaining: 2, onRevealLetter: vi.fn(), onRevealFullWord: vi.fn(), onResetWord: vi.fn(), isTTSPlaying: false, isTTSDisabled: false, onPlayTTS: vi.fn(), dataTestIdBase: "card" };
}
describe("word study card", () => {
  it("spends letter hints only on unrevealed letters while hints remain", () => {
    const p = props(); const view = render(<WordCard {...p} position={3} />);
    expect(screen.getByTestId("card-position")).toHaveTextContent("3");
    expect(screen.getByTestId("card-hints-remaining")).toHaveTextContent("2");
    fireEvent.click(screen.getByTestId("card-hint-letter-1"));
    expect(p.onRevealLetter).toHaveBeenCalledExactlyOnceWith(1);
    view.rerender(<WordCard {...p} revealedPositions={[1]} hintsRemaining={0} />);
    expect(screen.getByTestId("card-hint-letter-1")).toHaveTextContent("A");
    fireEvent.click(screen.getByTestId("card-hint-letter-1")); fireEvent.click(screen.getByTestId("card-hint-letter-2"));
    expect(p.onRevealLetter).toHaveBeenCalledOnce();
    expect(screen.getByTestId("card-hints-remaining").textContent).toBe("0");
  });
  it("switches full reveal to hide after all answer letters are visible", () => {
    const p = props(); const view = render(<WordCard {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal answer" }));
    expect(p.onRevealFullWord).toHaveBeenCalledOnce(); expect(p.onResetWord).not.toHaveBeenCalled();
    view.rerender(<WordCard {...p} revealedPositions={[0, 1, 2, 3]} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide answer" }));
    expect(p.onResetWord).toHaveBeenCalledOnce();
  });
  it.each([[false, false], [false, true], [true, false]] as const)("renders audio playing=%s disabled=%s and honors the disabled control", (isTTSPlaying, isTTSDisabled) => {
    const p = props(); render(<WordCard {...p} isTTSPlaying={isTTSPlaying} isTTSDisabled={isTTSDisabled} />);
    const button = screen.getByRole("button", { name: "Listen" }) as HTMLButtonElement;
    expect(button.disabled).toBe(isTTSDisabled);
    expect(button.style.backgroundColor).toBe(isTTSPlaying ? cssVarColors.secondary.DEFAULT : isTTSDisabled ? cssVarColors.background.DEFAULT : cssVarColors.background.elevated);
    fireEvent.click(button); expect(p.onPlayTTS).toHaveBeenCalledTimes(isTTSDisabled ? 0 : 1);
  });
  it("supports cards without optional IDs and contains drag gestures within letter and confidence controls", () => {
    const p = props(); const parent = vi.fn();
    const view = render(<div onMouseDown={parent}><WordCard {...p} /></div>);
    fireEvent.mouseDown(screen.getByTestId("card-hint-letter-1"));
    expect(parent).not.toHaveBeenCalled();
    view.rerender(<div onMouseDown={parent}><WordCard {...p} dataTestIdBase={undefined} /></div>);
    expect(screen.queryByTestId("card")).toBeNull();
    fireEvent.mouseDown(screen.getByText("Confidence"));
    expect(parent).not.toHaveBeenCalled();
    fireEvent.mouseDown(screen.getByText("cat"));
    expect(parent).toHaveBeenCalledOnce();
  });
});
