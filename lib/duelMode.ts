export const DUEL_MODES = ["pvp", "pve", "relay"] as const;

export type DuelMode = (typeof DUEL_MODES)[number];

export const DUEL_MODE_LABELS: Record<DuelMode, string> = {
  pvp: "PvP",
  pve: "PvE",
  relay: "Relay",
};

// Relay is only offered from the regular challenge flow (decision #2). Boss and
// spaced-repetition launch surfaces offer this relay-excluding set instead.
export const NON_RELAY_DUEL_MODES: readonly DuelMode[] = ["pvp", "pve"];
