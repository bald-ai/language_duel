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
 * Returns true once the goal end date has passed.
 */
export function isGoalPastEndDate(
  endDate: number | undefined,
  now: number
): boolean {
  return typeof endDate === "number" && endDate < now;
}

/**
 * Returns true once the goal has moved past its post-end-date grace window.
 */
export function isGoalPastGracePeriod(
  endDate: number | undefined,
  now: number,
  gracePeriodMs: number
): boolean {
  return (
    typeof endDate === "number" &&
    endDate + gracePeriodMs < now
  );
}
