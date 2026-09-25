import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CountdownControls } from "@/app/game/components/duel/CountdownControls";

describe("CountdownControls", () => {
  it("shows pause and skip when not paused", () => {
    const onPause = vi.fn();
    const onSkip = vi.fn();

    render(
      <CountdownControls
        countdown={3}
        countdownPausedBy={undefined}
        countdownUnpauseRequestedBy={undefined}
        userRole="challenger"
        onPause={onPause}
        onRequestUnpause={vi.fn()}
        onConfirmUnpause={vi.fn()}
        countdownSkipRequestedBy={[]}
        onSkip={onSkip}
        dataTestIdBase="duel-countdown"
      />
    );

    fireEvent.click(screen.getByTestId("duel-countdown-pause"));
    expect(onPause).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("duel-countdown-skip"));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("shows unpause requested when current user asked", () => {
    render(
      <CountdownControls
        countdown={3}
        countdownPausedBy="challenger"
        countdownUnpauseRequestedBy="challenger"
        userRole="challenger"
        onPause={vi.fn()}
        onRequestUnpause={vi.fn()}
        onConfirmUnpause={vi.fn()}
        dataTestIdBase="duel-countdown"
      />
    );

    expect(screen.getByTestId("duel-countdown-unpause-requested")).toBeDisabled();
  });

  it("confirms unpause when opponent requests", () => {
    const onConfirmUnpause = vi.fn();
    render(
      <CountdownControls
        countdown={3}
        countdownPausedBy="opponent"
        countdownUnpauseRequestedBy="opponent"
        userRole="challenger"
        onPause={vi.fn()}
        onRequestUnpause={vi.fn()}
        onConfirmUnpause={onConfirmUnpause}
        dataTestIdBase="duel-countdown"
      />
    );

    fireEvent.click(screen.getByTestId("duel-countdown-confirm-unpause"));
    expect(onConfirmUnpause).toHaveBeenCalledTimes(1);
  });

  it("requests unpause when paused and no request", () => {
    const onRequestUnpause = vi.fn();
    render(
      <CountdownControls
        countdown={3}
        countdownPausedBy="opponent"
        countdownUnpauseRequestedBy={undefined}
        userRole="challenger"
        onPause={vi.fn()}
        onRequestUnpause={onRequestUnpause}
        onConfirmUnpause={vi.fn()}
        dataTestIdBase="duel-countdown"
      />
    );

    fireEvent.click(screen.getByTestId("duel-countdown-unpause"));
    expect(onRequestUnpause).toHaveBeenCalledTimes(1);
  });

  it("shows opponent skip prompt and waiting state", () => {
    const { rerender } = render(
      <CountdownControls
        countdown={3}
        countdownPausedBy={undefined}
        countdownUnpauseRequestedBy={undefined}
        userRole="challenger"
        onPause={vi.fn()}
        onRequestUnpause={vi.fn()}
        onConfirmUnpause={vi.fn()}
        countdownSkipRequestedBy={["opponent"]}
        onSkip={vi.fn()}
        dataTestIdBase="duel-countdown"
      />
    );

    expect(screen.getByText(/opponent wants to skip/i)).toBeInTheDocument();

    rerender(
      <CountdownControls
        countdown={3}
        countdownPausedBy={undefined}
        countdownUnpauseRequestedBy={undefined}
        userRole="challenger"
        onPause={vi.fn()}
        onRequestUnpause={vi.fn()}
        onConfirmUnpause={vi.fn()}
        countdownSkipRequestedBy={["challenger"]}
        onSkip={vi.fn()}
        dataTestIdBase="duel-countdown"
      />
    );

    expect(screen.getByText(/waiting for opponent to skip/i)).toBeInTheDocument();
  });

  it("does not render skip button when onSkip is undefined", () => {
    render(
      <CountdownControls
        countdown={3}
        countdownPausedBy={undefined}
        countdownUnpauseRequestedBy={undefined}
        userRole="challenger"
        onPause={vi.fn()}
        onRequestUnpause={vi.fn()}
        onConfirmUnpause={vi.fn()}
        dataTestIdBase="duel-countdown"
      />
    );

    expect(screen.queryByTestId("duel-countdown-skip")).not.toBeInTheDocument();
  });
  it("uses opponent perspective for skip requests and disables repeated skips", () => {
    const skip = vi.fn();
    const props = { countdown: 2, countdownPausedBy: undefined, countdownUnpauseRequestedBy: undefined, userRole: "opponent" as const, onPause: vi.fn(), onRequestUnpause: vi.fn(), onConfirmUnpause: vi.fn(), onSkip: skip, dataTestIdBase: "countdown", countdownLabel: "Results" };
    const view = render(<CountdownControls {...props} countdownSkipRequestedBy={["challenger"]} />);
    expect(screen.getByText("Results in 2...")).toBeInTheDocument();
    expect(screen.getByText("Opponent wants to skip!")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("countdown-skip")); expect(skip).toHaveBeenCalledOnce();
    view.rerender(<CountdownControls {...props} countdownSkipRequestedBy={["challenger", "opponent"]} />);
    expect((screen.getByTestId("countdown-skip") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("countdown-skip")); expect(skip).toHaveBeenCalledOnce();
    expect(screen.queryByText("Opponent wants to skip!")).toBeNull();
    expect(screen.queryByText("Waiting for opponent to skip...")).toBeNull();
  });
  it.each([undefined, "opponent", "challenger"])("renders paused controls without optional test IDs for request=%s", request => {
    const resume = vi.fn(); const confirm = vi.fn();
    render(<CountdownControls countdown={3} countdownPausedBy="challenger" countdownUnpauseRequestedBy={request} userRole="opponent" onPause={vi.fn()} onRequestUnpause={resume} onConfirmUnpause={confirm} />);
    const button = screen.getByRole("button");
    expect(button).not.toHaveAttribute("data-testid");
    fireEvent.click(button);
    expect(resume).toHaveBeenCalledTimes(request === undefined ? 1 : 0);
    expect(confirm).toHaveBeenCalledTimes(request === "challenger" ? 1 : 0);
    expect((button as HTMLButtonElement).disabled).toBe(request === "opponent");
  });

});
