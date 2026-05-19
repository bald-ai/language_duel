import type { Doc } from "../_generated/dataModel";
import { isSelfDuel } from "../../lib/duel/selfDuel";

type DuelPatch = Partial<Doc<"duels">>;

/**
 * Mirror the challenger half of a gameplay patch onto the opponent half
 * when the duel is a self-duel. For non-self-duels this is a pass-through.
 *
 * Field-overwrite only: never re-invokes `getLimitedLivesMissPatch` (which
 * is a no-op for `sourceType: "normal"` today and would risk
 * double-decrementing once self-duels widen to boss/SR).
 */
export function mirrorPatchForSelfDuel<T extends DuelPatch>(
  patch: T,
  duel: Doc<"duels">
): T {
  if (!isSelfDuel(duel)) return patch;
  if (Object.keys(patch).length === 0) return patch;

  const mirrored: DuelPatch = { ...patch };

  if (Object.prototype.hasOwnProperty.call(patch, "challengerAnswered")) {
    mirrored.opponentAnswered = patch.challengerAnswered;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "challengerLastAnswer")) {
    mirrored.opponentLastAnswer = patch.challengerLastAnswer;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "challengerScore")) {
    mirrored.opponentScore = patch.challengerScore;
  }

  return mirrored as T;
}
