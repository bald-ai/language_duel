import { SABOTAGE_DURATION_MS } from "./constants";
import type { SabotageState } from "./types";

/**
 * Wall-clock expiry for a sabotage, or `null` when it has none.
 *
 * Only sticky sabotage expires on a timer (a fixed `SABOTAGE_DURATION_MS`
 * window). Movement sabotages (bounce/trampoline/reverse) are bound to the
 * current question instead of the clock, so they have no time-based expiry.
 */
export function getSabotageExpiryAt(sabotage?: SabotageState): number | null {
  if (!sabotage) return null;

  if (sabotage.effect === "sticky") {
    return sabotage.timestamp + SABOTAGE_DURATION_MS;
  }

  return null;
}

/**
 * Whether a sabotage is currently affecting its target.
 *
 * - sticky: active until its fixed-duration expiry.
 * - movement: active only while the question it was sent during is still in
 *   progress (`timestamp >= questionStartTime`). With no question in flight
 *   there is nothing to apply.
 */
export function isSabotageActive(params: {
  sabotage?: SabotageState;
  now: number;
  questionStartTime?: number;
}): boolean {
  const { sabotage, now, questionStartTime } = params;

  if (!sabotage) return false;

  if (sabotage.effect === "sticky") {
    const expiresAt = getSabotageExpiryAt(sabotage);
    return expiresAt !== null && now < expiresAt;
  }

  if (typeof questionStartTime !== "number") {
    return false;
  }

  return sabotage.timestamp >= questionStartTime;
}
