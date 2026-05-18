export const DUEL_MODES = ["pvp", "pve"] as const;

export type DuelMode = (typeof DUEL_MODES)[number];

export const DUEL_MODE_LABELS: Record<DuelMode, string> = {
  pvp: "PvP",
  pve: "PvE",
};
