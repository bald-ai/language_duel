import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cssVarColors } from "@/app/components/themeCssVars";
import { SentenceBuildBoard } from "@/app/duel/[duelId]/components/SentenceBuildBoard";
import {
  BOUNCE_FLY_SCALE,
  BUTTON_WIDTH,
  REVERSE_HOLD_MS,
  REVERSE_SCRAMBLE_MS,
  TRAMPOLINE_FLY_SCALE,
  TRAMPOLINE_SHAKE_MS,
} from "@/lib/sabotage/constants";

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

  it("renders a free-word meaning under a glossed tile", () => {
    renderBoard({ tileMeanings: [null, "coffee", null, null] });

    expect(screen.getByTestId("sentence-tile-1")).toHaveTextContent("cafe");
    expect(screen.getByTestId("sentence-tile-1-meaning")).toHaveTextContent("coffee");
    expect(screen.queryByTestId("sentence-tile-0-meaning")).not.toBeInTheDocument();
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

  it("keeps the Confirm/Reset actions anchored under a flying sabotage", async () => {
    const measuredWidth = 360;
    vi.spyOn(Date, "now").mockReturnValue(2);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: measuredWidth,
      height: 640,
      top: 0,
      right: measuredWidth,
      bottom: 640,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    renderBoard({ activeSabotage: "bounce" });
    // The action row is never part of the flying set.
    expect(screen.getByTestId("sentence-confirm")).toBeInTheDocument();
    expect(screen.getByTestId("sentence-reset")).toBeInTheDocument();
    // The placed tile stays in the anchored grid (not hidden/flying).
    expect(screen.getByTestId("sentence-tile-0")).not.toHaveClass("invisible");

    const flyingTile = await screen.findByTestId("sentence-tile-1-fly");
    expect(flyingTile).toHaveClass("transition-colors");
    expect(flyingTile).not.toHaveClass("transition-all");
    expect(flyingTile.querySelector("span")).toHaveClass("truncate");
    expect(Number.parseFloat(flyingTile.style.left)).toBeLessThanOrEqual(
      measuredWidth - BUTTON_WIDTH * BOUNCE_FLY_SCALE
    );
  });

  it("launches only unplaced trampoline tiles and keeps their tile identities", () => {
    let frame: FrameRequestCallback = () => { throw new Error("No animation frame scheduled"); };
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(callback => { frame = callback; return 1; });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(performance, "now").mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 360, height: 640 } as DOMRect);
    const onTileClick = vi.fn();
    renderBoard({ activeSabotage: "trampoline", onTileClick });
    act(() => frame(0));
    expect(screen.queryByTestId("sentence-tile-0-fly")).toBeNull();
    const flyer = screen.queryByTestId("sentence-tile-1-fly");
    expect(flyer).not.toBeNull();
    expect(flyer!.style.transform).toBe("scale(1)");
    const initialLeft = flyer!.style.left;
    act(() => frame(TRAMPOLINE_SHAKE_MS / 2));
    expect(flyer!.style.left).not.toBe(initialLeft);
    act(() => frame(TRAMPOLINE_SHAKE_MS));
    expect(flyer!.style.transform).toBe(`scale(${TRAMPOLINE_FLY_SCALE})`);
    fireEvent.click(flyer!);
    expect(onTileClick).toHaveBeenCalledExactlyOnceWith(1);
    expect((screen.getByTestId("sentence-confirm") as HTMLButtonElement).disabled).toBe(false);
  });
  it("routes tile, confirm and reset actions to their callbacks", () => {
    const onTileClick = vi.fn(), onConfirm = vi.fn(), onReset = vi.fn();
    renderBoard({ onTileClick, onConfirm, onReset });
    fireEvent.click(screen.getByTestId("sentence-tile-1"));
    fireEvent.click(screen.getByTestId("sentence-confirm"));
    fireEvent.click(screen.getByTestId("sentence-reset"));
    expect(onTileClick).toHaveBeenCalledExactlyOnceWith(1);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("locks tiles and reset, and respects the separate confirm permission", () => {
    const onTileClick = vi.fn(), onConfirm = vi.fn(), onReset = vi.fn();
    renderBoard({ locked: true, confirmDisabled: true, onTileClick, onConfirm, onReset });
    for (const id of ["sentence-tile-1", "sentence-confirm", "sentence-reset"]) {
      expect(screen.getByTestId(id)).toBeDisabled();
      fireEvent.click(screen.getByTestId(id));
    }
    expect(onTileClick).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
  });

  it("hides optional actions and timer while showing the empty-board instruction", () => {
    renderBoard({ placedTileIndices: [], showActions: false, showTimer: false, roundLabel: "Round 2", belowActions: <p>Finished</p> });
    expect(screen.getByTestId("sentence-hint")).toHaveTextContent("Tap the words in order");
    expect(screen.queryByTestId("sentence-confirm")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sentence-timer")).not.toBeInTheDocument();
    expect(screen.getByText("Round 2")).toBeInTheDocument();
    expect(screen.getByText("Finished")).toBeInTheDocument();
  });

  it.each([[4, true], [8, false], [9, false]] as const)("shows timer %s with danger pulse %s", (secondsLeft, pulse) => {
    renderBoard({ secondsLeft });
    expect(screen.getByTestId("sentence-timer")).toHaveTextContent(String(secondsLeft));
    expect(screen.getByTestId("sentence-timer").classList.contains("animate-pulse")).toBe(pulse);
  });

  it("colors confirmed correct and wrong placements independently", () => {
    renderBoard({ placedTileIndices: [0, 1], correctnessMask: [true, false] });
    expect(screen.getByTestId("sentence-tile-0").style.borderColor).toBe(cssVarColors.status.success.DEFAULT);
    expect(screen.getByTestId("sentence-tile-1").style.borderColor).toBe(cssVarColors.status.danger.DEFAULT);
    expect(screen.getByTestId("sentence-badge-0").style.backgroundColor).toBe(cssVarColors.status.success.DEFAULT);
    expect(screen.getByTestId("sentence-badge-1").style.backgroundColor).toBe(cssVarColors.status.danger.DEFAULT);
  });

  it("marks the last unconfirmed placement and the partner's previous wrong pick", () => {
    renderBoard({ placedTileIndices: [0, 1], lastWrongTileIndex: 2 });
    expect(screen.getByTestId("sentence-tile-0").style.borderColor).toBe(cssVarColors.neutral.dark);
    expect(screen.getByTestId("sentence-tile-1").style.borderColor).toBe(cssVarColors.status.danger.DEFAULT);
    expect(screen.getByTestId("sentence-tile-1")).toHaveClass("opacity-70");
    expect(screen.getByTestId("sentence-tile-2")).toHaveClass("border-dashed");
  });

  it("eliminated tiles cannot be clicked and hide meanings and reveal hints", () => {
    const onTileClick = vi.fn();
    renderBoard({ eliminatedTileIndices: [1], tileMeanings: [null, "coffee"], revealedTiles: [{ position: 1, tileIndices: [1] }], onTileClick });
    const tile = screen.getByTestId("sentence-tile-1");
    expect((tile as HTMLButtonElement).disabled).toBe(true);
    expect(tile).toHaveClass("line-through");
    expect(tile).not.toHaveClass("animate-pulse");
    fireEvent.click(tile);
    expect(onTileClick).not.toHaveBeenCalled();
    expect(screen.queryByTestId("sentence-tile-1-meaning")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sentence-reveal-badge-1")).not.toBeInTheDocument();
  });

  it("greys out a placed decoy that remove-distractors eliminates but keeps its order badge", () => {
    renderBoard({ placedTileIndices: [0, 3], eliminatedTileIndices: [3] });
    const tile = screen.getByTestId("sentence-tile-3");
    expect(tile.style.borderColor).toBe(cssVarColors.neutral.dark);
    expect(tile).toHaveClass("line-through");
    expect((tile as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId("sentence-badge-3")).toHaveTextContent("2");
    expect(screen.getByTestId("sentence-badge-3").style.backgroundColor).toBe(cssVarColors.status.danger.DEFAULT);
  });

  it("reveals the next slot and confirms a correctly placed revealed tile", () => {
    renderBoard({ revealedTiles: [{ position: 0, tileIndices: [0] }, { position: 1, tileIndices: [1] }] });
    expect(screen.getByTestId("sentence-reveal-badge-0")).toHaveTextContent("✓");
    expect(screen.getByTestId("sentence-reveal-badge-1")).toHaveTextContent("2");
    expect(screen.getByTestId("sentence-tile-1")).toHaveClass("animate-pulse");
    expect(screen.getByTestId("sentence-tile-0")).not.toHaveClass("animate-pulse");
  });

});
