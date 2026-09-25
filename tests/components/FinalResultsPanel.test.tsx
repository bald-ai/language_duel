import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinalResultsPanel } from "@/app/game/components/duel/FinalResultsPanel";
import { cssVarColors as colors } from "@/app/components/themeCssVars";
const base = {
  myName: "Alice Example",
  theirName: "Bob Example",
  myScore: 5,
  theirScore: 3,
  onBackToHome: vi.fn(),
};
describe("final results", () => {
  it.each([
    [5, 3, "You won! 🎉", "success"],
    [3, 5, "You lost!", "danger"],
    [5, 5, "It's a tie!", "warning"],
  ] as const)(
    "announces the score result %s:%s",
    (myScore, theirScore, message, tone) => {
      render(
        <FinalResultsPanel
          {...base}
          myScore={myScore}
          theirScore={theirScore}
        />,
      );
      expect(screen.getByText("Duel Complete!")).toBeInTheDocument();
      expect(screen.getByText(message)).toHaveStyle({
        color: colors.status[tone].light,
      });
      expect(
        screen.queryByText("Lives Left:", { exact: false }),
      ).not.toBeInTheDocument();
    },
  );
  it.each(["mini", "big"] as const)(
    "a failed %s boss takes priority over winning scores",
    (bossType) => {
      render(
        <FinalResultsPanel
          {...base}
          bossType={bossType}
          livesRemaining={0}
          livesTotal={4}
        />,
      );
      expect(screen.getByText("Boss Attempt Complete")).toBeInTheDocument();
      expect(screen.queryByText("Boss run failed")).not.toBeNull();
      expect(screen.getByText("Boss run failed")).toHaveStyle({
        color: colors.status.danger.light,
      });
      expect(
        screen.getByText("You ran out of shared lives."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Trophy Earned")).not.toBeInTheDocument();
    },
  );
  it("announces a successful mini boss without a big-boss trophy panel", () => {
    render(
      <FinalResultsPanel
        {...base}
        myScore={0}
        bossType="mini"
        livesRemaining={1}
      />,
    );
    expect(screen.getByText("Mini Boss defeated")).toHaveStyle({
      color: colors.status.success.light,
    });
    expect(screen.queryByText("Trophy Earned")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Lives Left:", { exact: false }),
    ).not.toBeInTheDocument();
  });
  it.each([
    [1, "Bronze Trophy"],
    [2, "Silver Trophy"],
    [3, "Gold Trophy"],
  ] as const)(
    "shows the earned trophy for %s lives",
    (livesRemaining, trophy) => {
      render(
        <FinalResultsPanel
          {...base}
          bossType="big"
          livesRemaining={livesRemaining}
          livesTotal={4}
        />,
      );
      expect(screen.getByText("Big Boss defeated")).toBeInTheDocument();
      expect(screen.getByText(trophy)).toBeInTheDocument();
      expect(
        screen.getByText(`Lives Left: ${livesRemaining}/4`),
      ).toBeInTheDocument();
    },
  );
  it("can show remaining lives when the optional starting total is absent", () => {
    render(<FinalResultsPanel {...base} bossType="big" livesRemaining={2} />);
    expect(screen.getByText("Lives Left: 2")).toBeInTheDocument();
  });
  it("uses scores while a boss result has no life count", () => {
    render(<FinalResultsPanel {...base} bossType="big" />);
    expect(screen.getByText("Duel Complete!")).toBeInTheDocument();
    expect(screen.getByText("You won! 🎉")).toBeInTheDocument();
  });
  it.each([undefined, 0, -1])(
    "does not show unavailable or nonpositive duration %s",
    (duelDuration) => {
      render(<FinalResultsPanel {...base} duelDuration={duelDuration} />);
      expect(screen.queryByText("Total Time")).not.toBeInTheDocument();
    },
  );
  it("formats duration, fractional scores, short names and the home action", () => {
    const home = vi.fn();
    render(
      <FinalResultsPanel
        {...base}
        myScore={2.5}
        duelDuration={3661}
        onBackToHome={home}
        dataTestIdBack="results-home"
      />,
    );
    expect(screen.getByText("1:01:01")).toBeInTheDocument();
    expect(screen.getByText("2.5")).toBeInTheDocument();
    expect(screen.getByText("You (Alice)")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("results-home"));
    expect(home).toHaveBeenCalledOnce();
  });
  it("displays optional-name defaults for blank profiles", () => {
    render(<FinalResultsPanel {...base} myName="" theirName="" />);
    expect(screen.getByText("You (You)")).toBeInTheDocument();
    expect(screen.getByText("Opponent")).toBeInTheDocument();
  });
});
