import { MIN_THEMES_PER_GOAL } from "@/lib/weeklyGoals";

// Weekly Goals constants

/**
 * Maximum number of themes that can be added to a single weekly goal.
 * This constant is also defined in convex/weeklyGoals.ts (MAX_THEMES_PER_GOAL)
 * to enforce the limit on the backend. Keep these in sync.
 */
export const MAX_THEMES_PER_GOAL = 5;

/**
 * Minimum number of themes required before a weekly goal can be locked.
 */
export const MIN_THEMES_TO_LOCK_GOAL = MIN_THEMES_PER_GOAL;
