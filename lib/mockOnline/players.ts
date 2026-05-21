import type { PlayerSlot, Scores } from "./state";

export function otherSlot(slot: PlayerSlot): PlayerSlot {
  return slot === "host" ? "guest" : "host";
}

export function addScore(scores: Scores, slot: PlayerSlot, by: number): Scores {
  return slot === "host"
    ? { ...scores, host: scores.host + by }
    : { ...scores, guest: scores.guest + by };
}
