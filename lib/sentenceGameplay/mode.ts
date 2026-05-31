/**
 * Single source of truth for which sentence interaction model a duel uses.
 *
 * Two models coexist (decision: PvP sentence mode):
 *  - **build-and-confirm** (Variant 1): tap tiles in any order, peel the last,
 *    verify the whole sentence on Confirm. Used by PvP.
 *  - **per-tap**: each tap is validated immediately. Used by PvE / Solo.
 *
 * Self-duels are forced to `pve` mode (`SELF_DUEL_FORCED_MODE`) but practising
 * against yourself should feel the same as a real PvP match, so they use
 * build-and-confirm too. A real two-player PvP duel is identified by
 * `duelMode === "pvp"`; a self-duel by `challengerId === opponentId`. Boss /
 * computer PvE keeps the per-tap model.
 *
 * Relay supports sentences too, and uses build-and-confirm — but it does NOT go
 * through `isBuildConfirmSentenceMode`: this function only drives the non-relay
 * `SentenceRoundView` routing. Relay wires its own build mutations
 * (`relaySentence*`) and renders the shared board directly, so leave this as-is.
 */

import type { Doc } from "../../convex/_generated/dataModel";
import { isSelfDuel } from "../duel/selfDuel";

export function isBuildConfirmSentenceMode(
  duel: Pick<Doc<"duels">, "duelMode" | "challengerId" | "opponentId">
): boolean {
  return duel.duelMode === "pvp" || isSelfDuel(duel);
}
