import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { DuelMode } from "../../lib/duelMode";

export function assertDuelMode(
  duel: Pick<Doc<"duels">, "duelMode">,
  expected: DuelMode,
  mutationName: string
) {
  if (duel.duelMode === expected) return;

  throw new ConvexError({
    code: "WRONG_MODE",
    message: `${mutationName} is only available in ${expected.toUpperCase()} duels`,
    expected,
    actual: duel.duelMode,
  });
}

/**
 * Relay is only offered from the regular challenge flow (decision #2). Boss and
 * spaced-repetition creation accept any `duelModeValidator` value, so they need
 * this explicit guard to reject relay at creation time.
 */
export function assertRelayUnavailable(duelMode: DuelMode, surfaceLabel: string) {
  if (duelMode !== "relay") return;

  throw new ConvexError({
    code: "WRONG_MODE",
    message: `Relay is not available for ${surfaceLabel}`,
  });
}
