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

export function getGoalMidpointAt(
  lockedAt: number | undefined,
  endDate: number | undefined
): number | null {
  if (typeof lockedAt !== "number" || typeof endDate !== "number") {
    return null;
  }

  if (endDate <= lockedAt) {
    return null;
  }

  return lockedAt + Math.floor((endDate - lockedAt) / 2);
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

  const midpointAt = getGoalMidpointAt(goal.lockedAt, goal.endDate);
  const completedThemeCount = countCompletedThemes(goal.themes);
  const unlockThreshold = getMiniBossUnlockThreshold(goal.themes.length);
  const reachedMidpoint = typeof midpointAt === "number" && now >= midpointAt;

  if (
    goal.themes.length >= MIN_THEMES_PER_GOAL &&
    (reachedMidpoint || completedThemeCount >= unlockThreshold)
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
  const effectiveStatus = getEffectiveGoalStatus(goal, now);
  const effectiveBossStatus = getEffectiveBossStatus(goal, now);

  return (
    effectiveStatus === "editing" ||
    (effectiveStatus === "active" &&
      effectiveBossStatus === "locked" &&
      !areAllThemesCompleted(goal.themes))
  );
}

export function canTriggerGoalBoss(
  goal: WeeklyGoalStateLike,
  which: "mini" | "big",
  now: number
): boolean {
  if (getEffectiveGoalStatus(goal, now) !== "active") {
    return false;
  }

  return which === "mini"
    ? getEffectiveMiniBossStatus(goal, now) === "available"
    : getEffectiveBossStatus(goal, now) === "available";
}
