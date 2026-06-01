import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SentenceBuildBoard } from "@/app/duel/[duelId]/components/SentenceBuildBoard";
import { REVERSE_HOLD_MS, REVERSE_SCRAMBLE_MS } from "@/lib/sabotage/constants";

// "Quiero cafe leche pan" — slot 0 ("Quiero") placed, the rest unplaced.
const TILE_POOL = ["Quiero", "cafe", "leche", "pan"];

function renderBoard(props: Partial<Parameters<typeof SentenceBuildBoard>[0]> = {}) {
  return render(
    <SentenceBuildBoard
      themeName="Cafe"
      englishPrompt="I want coffee"
      tilePool={TILE_POOL}
      placedTileIndices={[0]}
      correctnessMask={null}
      secondsLeft={42}
      locked={false}
      showActions
      confirmDisabled={false}
      onTileClick={() => {}}
      onConfirm={() => {}}
      onReset={() => {}}
      {...props}
    />
  );
}

describe("SentenceBuildBoard — PvP sabotage rendering", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders no sabotage overlay when activeSabotage is null", () => {
    renderBoard({ activeSabotage: null });
    // Tiles render their display text (sentence-initial caps are lowercased so
    // position can't be guessed); the placed tile keeps its order badge.
    expect(screen.getByTestId("sentence-tile-0")).toHaveTextContent("quiero");
    expect(screen.getByTestId("sentence-badge-0")).toHaveTextContent("1");
  });

  it("sticky mounts a full-screen overlay and leaves the tiles untouched", () => {
    renderBoard({ activeSabotage: "sticky", sabotagePhase: "full" });
    // Sticky note text from the overlay is present; tiles still read normally.
    expect(screen.getByText("You buffoon!")).toBeInTheDocument();
    expect(screen.getByTestId("sentence-tile-1")).toHaveTextContent("cafe");
  });

  it("reverse scrambles only the UNPLACED tiles; the placed tile stays readable", () => {
    vi.useFakeTimers();
    renderBoard({ activeSabotage: "reverse" });

    // Let the hold + scramble window settle on the fully-reversed text.
    act(() => {
      vi.advanceTimersByTime(REVERSE_HOLD_MS + REVERSE_SCRAMBLE_MS + 50);
    });

    // Placed tile (slot 0) is part of the built sentence → never scrambled
    // (display text lowercases the sentence-initial capital).
    expect(screen.getByTestId("sentence-tile-0")).toHaveTextContent("quiero");
    // Unplaced tiles are reversed ("cafe" → "efac", "pan" → "nap").
    expect(screen.getByTestId("sentence-tile-1")).toHaveTextContent("efac");
    expect(screen.getByTestId("sentence-tile-3")).toHaveTextContent("nap");
  });

  it("keeps the Confirm/Reset actions anchored under a flying sabotage", () => {
    renderBoard({ activeSabotage: "bounce" });
    // The action row is never part of the flying set.
    expect(screen.getByTestId("sentence-confirm")).toBeInTheDocument();
    expect(screen.getByTestId("sentence-reset")).toBeInTheDocument();
    // The placed tile stays in the anchored grid (not hidden/flying).
    expect(screen.getByTestId("sentence-tile-0")).not.toHaveClass("invisible");
  });
});
