/**
 * Pure rendering logic for the reveal_tiles hint's "Active next-step" badges.
 * Derives, from the SHARED revealed slots and THIS player's own placed sequence,
 * which tile carries which slot badge and which tile should pulse "place me now".
 * Kept pure (no React) so the board stays presentational and the rules are
 * unit-testable.
 */

import type { SentenceTileReveal } from "./hints";

export type RevealBadge = {
  /** Slot number to show on the tile (1-indexed for display). */
  slot: number;
  /** True once the tile is placed in a slot that matches its reveal (green ✓);
   * otherwise the badge stays amber, still pointing at where it belongs. */
  correct: boolean;
};

export interface RevealBadgeView {
  /** tile pool index → its reveal badge. */
  badgeByTileIndex: Map<number, RevealBadge>;
  /** The single tile pool index to pulse ("place me next"), or null. */
  pulseTileIndex: number | null;
}

/**
 * Compute the reveal badges + the next-due pulse (decision: "Active next-step").
 *
 * Per-tile, persistent: a revealed tile keeps its badge whether it's still in the
 * pool or already placed. Once placed, the badge turns green ✓ if it sits in one
 * of its revealed slots, else stays amber pointing at its earliest revealed slot.
 * The pulse is the (lowest-index) unplaced revealed tile whose earliest slot is
 * the next open position; at most one pulses. Derived fresh every render, so a
 * Reset (empty `placedTileIndices`) restarts the marks from slot 1.
 *
 * A repeated word makes several pool tiles valid for a slot (and a tile valid for
 * several slots); each such tile is badged with its earliest revealed slot.
 */
export function computeRevealBadgeView(
  revealedTiles: SentenceTileReveal[],
  placedTileIndices: number[]
): RevealBadgeView {
  // Per revealed tile, the slots it can fill (a duplicate word fills several).
  const slotsByTile = new Map<number, number[]>();
  for (const { position, tileIndices } of revealedTiles) {
    for (const tileIndex of tileIndices) {
      const slots = slotsByTile.get(tileIndex);
      if (slots) slots.push(position);
      else slotsByTile.set(tileIndex, [position]);
    }
  }

  const badgeByTileIndex = new Map<number, RevealBadge>();
  const nextOpenPosition = placedTileIndices.length;
  let pulseTileIndex: number | null = null;

  for (const tileIndex of [...slotsByTile.keys()].sort((a, b) => a - b)) {
    const slots = (slotsByTile.get(tileIndex) ?? []).sort((a, b) => a - b);
    const placedOrder = placedTileIndices.indexOf(tileIndex);
    if (placedOrder !== -1) {
      const correct = slots.includes(placedOrder);
      badgeByTileIndex.set(tileIndex, {
        slot: (correct ? placedOrder : slots[0]) + 1,
        correct,
      });
      continue;
    }
    badgeByTileIndex.set(tileIndex, { slot: slots[0] + 1, correct: false });
    if (pulseTileIndex === null && slots.includes(nextOpenPosition)) {
      pulseTileIndex = tileIndex;
    }
  }

  return { badgeByTileIndex, pulseTileIndex };
}
