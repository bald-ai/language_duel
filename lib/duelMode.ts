export const DUEL_MODES = ["pvp", "pve", "relay", "tbt"] as const;

export type DuelMode = (typeof DUEL_MODES)[number];

export const DUEL_MODE_LABELS: Record<DuelMode, string> = {
  pvp: "PvP",
  pve: "PvE",
  relay: "Relay",
  tbt: "Tag Team",
};

// Limited-lives launch surfaces (boss and spaced repetition) intentionally keep
// the classic modes only. Relay and Tag Team are regular-challenge-only.
export const LIMITED_LIVES_DUEL_MODES: readonly DuelMode[] = ["pvp", "pve"];
