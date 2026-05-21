import type { PlayerSlot } from "@/lib/mockOnline/state";

export function scorerLine(scorer: PlayerSlot | null, viewerSlot: PlayerSlot): string {
  if (scorer === null) return "Nobody scored.";
  return scorer === viewerSlot ? "You scored!" : "Opponent scored.";
}
