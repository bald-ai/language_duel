import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Scoreboard } from "@/app/game/components/duel/Scoreboard";

it("shows first names and formatted scores and includes exhausted boss lives", () => {
  const view = render(<Scoreboard myName="Alice Example" theirName="Bob Example" myScore={3} theirScore={1.25} />);
  expect(screen.queryByText("You (Alice)")).not.toBeNull();
  expect(screen.queryByText("Bob")).not.toBeNull();
  expect(screen.queryByText("3")).not.toBeNull();
  expect(screen.queryByText("1.3")).not.toBeNull();
  expect(screen.queryByText(/Lives:/)).toBeNull();
  view.rerender(<Scoreboard myName="" theirName="" myScore={0} theirScore={2} livesRemaining={0} />);
  expect(screen.queryByText("You (You)")).not.toBeNull();
  expect(screen.queryByText("Opponent")).not.toBeNull();
  expect(screen.queryByText("Lives: 0")).not.toBeNull();
});
