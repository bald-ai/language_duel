/**
 * Timer options for learn phase (in seconds)
 * 1, 2, 3, 4, 5, 7, 10, 15 minutes
 */
export const TIMER_OPTIONS = [60, 120, 180, 240, 300, 420, 600, 900] as const;

export type TimerOption = typeof TIMER_OPTIONS[number];
