import { GRACE_PERIOD_MS, WEEKLY_GOAL_EDITING_TTL_MS } from "../convex/constants";

export const MIN_THEMES_PER_GOAL = 2;

export type WeeklyGoalBossStatus = "locked" | "available" | "completed";
export type WeeklyGoalLifecycleStatus =
  | "editing"
  | "active"
  | "expired"
  | "completed";

export interface WeeklyGoalThemeProgress {
  creatorCompleted: boolean;
  partnerCompleted: boolean;
}

export interface WeeklyGoalStateLike {
  themes: WeeklyGoalThemeProgress[];
  status: WeeklyGoalLifecycleStatus;
  lockedAt?: number;
  endDate?: number;
  miniBossStatus: WeeklyGoalBossStatus;
  bossStatus: WeeklyGoalBossStatus;
}

export function countCompletedThemes(
  themes: WeeklyGoalThemeProgress[]
): number {
  return themes.filter((theme) => theme.creatorCompleted && theme.partnerCompleted)
    .length;
}

export function areAllThemesCompleted(
  themes: WeeklyGoalThemeProgress[]
): boolean {
  return themes.length > 0 && countCompletedThemes(themes) === themes.length;
}

export function getMiniBossUnlockThreshold(themeCount: number): number {
  return Math.floor(themeCount / 2);
}

export function getGoalDeleteAt(
  endDate: number | undefined
): number | null {
  if (typeof endDate !== "number") {
    return null;
  }

  return endDate + GRACE_PERIOD_MS;
}

export function getGoalPlanningExpiresAt(
  createdAt: number | undefined
): number | null {
  if (typeof createdAt !== "number") {
    return null;
  }

  return createdAt + WEEKLY_GOAL_EDITING_TTL_MS;
}

export function isGoalInGracePeriod(
  goal: Pick<WeeklyGoalStateLike, "endDate" | "status" | "bossStatus">,
  now: number
): boolean {
  if (goal.status === "completed" || goal.bossStatus === "completed") {
    return false;
  }

  const deleteAt = getGoalDeleteAt(goal.endDate);
  if (deleteAt === null) {
    return false;
  }

  return now > goal.endDate! && now < deleteAt;
}

export function isGoalPlayable(
  goal: WeeklyGoalStateLike,
  now: number
): boolean {
  const effectiveStatus = getEffectiveGoalStatus(goal, now);

  if (effectiveStatus === "editing" || effectiveStatus === "completed") {
    return false;
  }

  return effectiveStatus === "active" || isGoalInGracePeriod(goal, now);
}

export function formatGoalGraceCountdown(timeRemainingMs: number): string {
  const clampedMs = Math.max(0, timeRemainingMs);
  const totalSeconds = Math.floor(clampedMs / 1000);
  const totalHours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(totalHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getEffectiveGoalStatus(
  goal: WeeklyGoalStateLike,
  now: number
): WeeklyGoalLifecycleStatus {
  if (goal.status === "completed" || goal.bossStatus === "completed") {
    return "completed";
  }

  if (goal.status === "editing") {
    return "editing";
  }

  if (goal.status === "expired") {
    return "expired";
  }

  if (typeof goal.endDate === "number" && now > goal.endDate) {
    return "expired";
  }

  return "active";
}

export function getEffectiveMiniBossStatus(
  goal: WeeklyGoalStateLike,
  now: number
): WeeklyGoalBossStatus {
  if (goal.miniBossStatus === "completed") {
    return "completed";
  }

  if (getEffectiveGoalStatus(goal, now) === "editing") {
    return "locked";
  }

  const completedThemeCount = countCompletedThemes(goal.themes);
  const unlockThreshold = getMiniBossUnlockThreshold(goal.themes.length);

  if (
    goal.themes.length >= MIN_THEMES_PER_GOAL &&
    completedThemeCount >= unlockThreshold
  ) {
    return "available";
  }

  return "locked";
}

export function getEffectiveBossStatus(
  goal: WeeklyGoalStateLike,
  now: number,
  miniBossStatus = getEffectiveMiniBossStatus(goal, now)
): WeeklyGoalBossStatus {
  if (goal.bossStatus === "completed") {
    return "completed";
  }

  if (getEffectiveGoalStatus(goal, now) === "editing") {
    return "locked";
  }

  const allThemesCompleted = areAllThemesCompleted(goal.themes);

  if (
    miniBossStatus === "completed" &&
    allThemesCompleted
  ) {
    return "available";
  }

  return "locked";
}

export function canEditGoalEndDate(
  goal: WeeklyGoalStateLike,
  now: number
): boolean {
  return getEffectiveGoalStatus(goal, now) === "editing";
}

export function canTriggerGoalBoss(
  goal: WeeklyGoalStateLike,
  which: "mini" | "big",
  now: number
): boolean {
  if (!isGoalPlayable(goal, now)) {
    return false;
  }

  return which === "mini"
    ? getEffectiveMiniBossStatus(goal, now) === "available"
    : getEffectiveBossStatus(goal, now) === "available";
}
