import { GRACE_PERIOD_MS, WEEKLY_GOAL_DRAFT_TTL_MS } from "../convex/constants";

export const MIN_THEMES_PER_GOAL = 2;

export type WeeklyGoalLifecycleStatus =
  | "draft"
  | "locked"
  | "grace_period"
  | "completed";
export type LegacyWeeklyGoalLifecycleStatus = "editing" | "active" | "expired";
export type WeeklyGoalStoredLifecycleStatus =
  | WeeklyGoalLifecycleStatus
  | LegacyWeeklyGoalLifecycleStatus;
export type WeeklyGoalBossStatus = "unavailable" | "ready" | "defeated";
export type LegacyWeeklyGoalBossStatus = "locked" | "available" | "completed";
export type WeeklyGoalStoredBossStatus =
  | WeeklyGoalBossStatus
  | LegacyWeeklyGoalBossStatus;

export interface WeeklyGoalThemeProgress {
  creatorCompleted: boolean;
  partnerCompleted: boolean;
}

export interface WeeklyGoalStateLike {
  themes: WeeklyGoalThemeProgress[];
  status: WeeklyGoalStoredLifecycleStatus;
  lockedAt?: number;
  endDate?: number;
  miniBossStatus: WeeklyGoalStoredBossStatus;
  bossStatus: WeeklyGoalStoredBossStatus;
}

export function normalizeWeeklyGoalLifecycleStatus(
  status: WeeklyGoalStoredLifecycleStatus
): WeeklyGoalLifecycleStatus {
  switch (status) {
    case "editing":
      return "draft";
    case "active":
      return "locked";
    case "expired":
      return "grace_period";
    default:
      return status;
  }
}

export function normalizeWeeklyGoalBossStatus(
  status: WeeklyGoalStoredBossStatus
): WeeklyGoalBossStatus {
  switch (status) {
    case "locked":
      return "unavailable";
    case "available":
      return "ready";
    case "completed":
      return "defeated";
    default:
      return status;
  }
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

export function getGoalDraftExpiresAt(
  createdAt: number | undefined
): number | null {
  if (typeof createdAt !== "number") {
    return null;
  }

  return createdAt + WEEKLY_GOAL_DRAFT_TTL_MS;
}

export function isGoalInGracePeriod(
  goal: Pick<WeeklyGoalStateLike, "endDate" | "status" | "bossStatus">,
  now: number
): boolean {
  const status = normalizeWeeklyGoalLifecycleStatus(goal.status);
  const bossStatus = normalizeWeeklyGoalBossStatus(goal.bossStatus);

  if (status === "completed" || bossStatus === "defeated") {
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

  if (effectiveStatus === "draft" || effectiveStatus === "completed") {
    return false;
  }

  return effectiveStatus === "locked" || isGoalInGracePeriod(goal, now);
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
  const status = normalizeWeeklyGoalLifecycleStatus(goal.status);
  const bossStatus = normalizeWeeklyGoalBossStatus(goal.bossStatus);

  if (status === "completed" || bossStatus === "defeated") {
    return "completed";
  }

  if (status === "draft") {
    return "draft";
  }

  if (status === "grace_period") {
    return "grace_period";
  }

  if (typeof goal.endDate === "number" && now > goal.endDate) {
    return "grace_period";
  }

  return "locked";
}

export function getEffectiveMiniBossStatus(
  goal: WeeklyGoalStateLike,
  now: number
): WeeklyGoalBossStatus {
  if (getEffectiveGoalStatus(goal, now) === "draft") {
    return "unavailable";
  }

  const completedThemeCount = countCompletedThemes(goal.themes);
  const unlockThreshold = getMiniBossUnlockThreshold(goal.themes.length);

  if (areAllThemesCompleted(goal.themes)) {
    return "unavailable";
  }

  if (normalizeWeeklyGoalBossStatus(goal.miniBossStatus) === "defeated") {
    return "defeated";
  }

  if (
    goal.themes.length >= MIN_THEMES_PER_GOAL &&
    completedThemeCount >= unlockThreshold
  ) {
    return "ready";
  }

  return "unavailable";
}

export function getEffectiveBossStatus(
  goal: WeeklyGoalStateLike,
  now: number
): WeeklyGoalBossStatus {
  if (normalizeWeeklyGoalBossStatus(goal.bossStatus) === "defeated") {
    return "defeated";
  }

  if (getEffectiveGoalStatus(goal, now) === "draft") {
    return "unavailable";
  }

  const allThemesCompleted = areAllThemesCompleted(goal.themes);

  if (allThemesCompleted) {
    return "ready";
  }

  return "unavailable";
}

export function canEditGoalEndDate(
  goal: WeeklyGoalStateLike,
  now: number
): boolean {
  return getEffectiveGoalStatus(goal, now) === "draft";
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
    ? getEffectiveMiniBossStatus(goal, now) === "ready"
    : getEffectiveBossStatus(goal, now) === "ready";
}
