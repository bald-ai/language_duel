// Sabotage effect types for duel mode.
// SABOTAGE_EFFECTS is the single source of truth for the effect literals; the
// schema validator and the SabotageEffect type both derive from it.
export const SABOTAGE_EFFECTS = ["sticky", "bounce", "trampoline", "reverse"] as const;

export type SabotageEffect = (typeof SABOTAGE_EFFECTS)[number];

export type SabotagePhase = "wind-up" | "full" | "wind-down";

/** A live sabotage on a duel: which effect, and when it was sent. */
export type SabotageState = {
  effect: SabotageEffect;
  timestamp: number;
};

