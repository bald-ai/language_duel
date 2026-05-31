import { describe, expect, it } from "vitest";
import { computeRevealBadgeView } from "@/lib/sentenceGameplay/reveal";

describe("computeRevealBadgeView", () => {
  it("badges unplaced revealed tiles amber and pulses the next-due slot", () => {
    // Revealed slots 0 and 2 (0-indexed); empty board → next open position = 0.
    const view = computeRevealBadgeView(
      [
        { position: 0, tileIndices: [0] },
        { position: 2, tileIndices: [3] },
      ],
      []
    );
    expect(view.badgeByTileIndex.get(0)).toEqual({ slot: 1, correct: false });
    expect(view.badgeByTileIndex.get(3)).toEqual({ slot: 3, correct: false });
    expect(view.pulseTileIndex).toBe(0); // slot 0 is the next open position
  });

  it("turns a tile green ✓ once placed in its revealed slot", () => {
    const view = computeRevealBadgeView([{ position: 0, tileIndices: [0] }], [0]);
    expect(view.badgeByTileIndex.get(0)).toEqual({ slot: 1, correct: true });
    expect(view.pulseTileIndex).toBeNull(); // next open position (1) isn't revealed
  });

  it("keeps a tile placed in the wrong slot amber, still pointing at its slot", () => {
    // Reveal says tile 0 belongs in slot 1, but it was placed first (order 0).
    const view = computeRevealBadgeView([{ position: 1, tileIndices: [0] }], [0]);
    expect(view.badgeByTileIndex.get(0)).toEqual({ slot: 2, correct: false });
  });

  it("does not pulse when the next-due slot is not revealed", () => {
    const view = computeRevealBadgeView([{ position: 2, tileIndices: [3] }], []);
    expect(view.pulseTileIndex).toBeNull();
  });

  it("restarts the pulse from slot 1 after a reset (empty placed)", () => {
    const view = computeRevealBadgeView([{ position: 0, tileIndices: [0] }], []);
    expect(view.pulseTileIndex).toBe(0);
  });

  it("badges duplicate-word tiles and pulses only one", () => {
    // "el" valid for slots 0 and 2; tiles 0 and 2 are both "el". Empty board.
    const view = computeRevealBadgeView(
      [
        { position: 0, tileIndices: [0, 2] },
        { position: 2, tileIndices: [0, 2] },
      ],
      []
    );
    expect(view.badgeByTileIndex.has(0)).toBe(true);
    expect(view.badgeByTileIndex.has(2)).toBe(true);
    expect(view.pulseTileIndex).toBe(0); // lowest-index unplaced tile due at slot 0
  });
});
