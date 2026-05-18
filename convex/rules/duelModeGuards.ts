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
