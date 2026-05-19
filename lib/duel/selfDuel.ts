import type { Doc } from "../../convex/_generated/dataModel";
import type { DuelMode } from "../duelMode";

/**
 * Single source for the self-duel concept.
 *
 * Invariant: in a self-duel `getDuelParticipant` returns
 * `isChallenger: true` AND `isOpponent: true`, and `playerRole` resolves
 * to `"challenger"` (the ternary picks `isChallenger` first). Gameplay
 * code must treat `isChallenger` as canonical and avoid `isOpponent`-only
 * branches.
 */

export const SELF_DUEL_FORCED_MODE: DuelMode = "pve";

export function isSelfDuel(
  duel: Pick<Doc<"duels">, "challengerId" | "opponentId">
): boolean {
  return duel.challengerId === duel.opponentId;
}
