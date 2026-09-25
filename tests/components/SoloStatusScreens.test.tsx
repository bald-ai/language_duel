import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SoloStatusScreen } from "@/app/solo/components/SoloStatusScreen";
import { CompletionScreen } from "@/app/solo/[sessionId]/components/CompletionScreen";
import { cssVarColors } from "@/app/components/themeCssVars";
vi.mock("@/app/components/BackgroundProvider", () => ({ useBackground: () => ({ background: "background_2.jpg" }) }));

describe("solo status screens", () => {
  it("shows loading without an exit action and permits exiting unavailable or invalid sessions", () => {
    const onExit = vi.fn();
    const props = { message: "Loading session", onExit, returnLabel: "Return to goal", testIdBase: "solo-practice" };
    const view = render(<SoloStatusScreen {...props} status="loading" />);
    expect(screen.queryByText("Loading session")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    view.rerender(<SoloStatusScreen {...props} status="unavailable" message="Session expired" />);
    expect(screen.queryByText("Session expired")).not.toBeNull();
    expect(screen.queryByTestId("solo-practice-back-home")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Return to goal" }));
    expect(onExit).toHaveBeenCalledTimes(1);
    view.rerender(<SoloStatusScreen {...props} status="invalid" message="Select a theme" />);
    expect(screen.queryByText("Select a theme")).not.toBeNull();
    fireEvent.click(screen.getByTestId("solo-practice-back-home"));
    expect(onExit).toHaveBeenCalledTimes(2);
  });

  it.each([
    [7, cssVarColors.status.success.DEFAULT],
    [6, cssVarColors.status.warning.DEFAULT],
    [5, cssVarColors.status.warning.DEFAULT],
    [4, cssVarColors.status.danger.DEFAULT],
  ])("colors %i/10 accuracy at its threshold and reports the actual session totals", (correctAnswers, color) => {
    const onExit = vi.fn();
    render(<CompletionScreen questionsAnswered={10} correctAnswers={correctAnswers} totalItems={3} totalDuration={125} onExit={onExit} />);
    const accuracy = screen.getByText(`${correctAnswers * 10}%`);
    expect(accuracy.style.color).toBe(color);
    expect(screen.getByText("Total Time").nextElementSibling?.textContent).toBe("2:05");
    expect(screen.getByText("Items Mastered").nextElementSibling?.textContent).toBe("3");
    expect(screen.getByText("Questions").nextElementSibling?.textContent).toBe("10");
    fireEvent.click(screen.getByRole("button", { name: "Back to Home" }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it("shows zero accuracy for an empty session and preserves its custom return label", () => {
    const onExit = vi.fn();
    render(<CompletionScreen questionsAnswered={0} correctAnswers={0} totalItems={0} totalDuration={0} onExit={onExit} exitLabel="Back to goal" />);
    expect(screen.queryByText("0%")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to goal" }));
    expect(onExit).toHaveBeenCalledOnce();
  });
});
