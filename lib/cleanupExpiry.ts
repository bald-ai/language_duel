/**
 * Shared expiration helpers used by cleanup jobs.
 */

/**
 * Returns true when a record created at `createdAt` has reached its TTL.
 */
export function isCreatedAtExpired(
  createdAt: number,
  now: number,
  ttlMs: number
): boolean {
  return createdAt <= now - ttlMs;
}

/**
 * Returns true when a weekly goal with expiresAt is already past due.
 */
export function isGoalPastExpiry(expiresAt: number | undefined, now: number): boolean {
  return typeof expiresAt === "number" && expiresAt < now;
}
