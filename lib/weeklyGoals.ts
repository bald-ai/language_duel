import { GRACE_PERIOD_MS, MIN_GOAL_DURATION_MS, WEEKLY_GOAL_DRAFT_TTL_MS } from "./weeklyGoalTiming";

export const MIN_THEMES_PER_GOAL = 2;
export const MAX_THEMES_PER_GOAL = 10;

export type WeeklyGoalLifecycleStatus =
  | "draft"
  | "locked"
  | "grace_period"
  | "completed";
export type WeeklyGoalBossStatus = "unavailable" | "ready" | "defeated";
export type WeeklyGoalMode = "solo" | "shared";
export type WeeklyGoalParticipantRole = "creator" | "partner";

/**
 * The lock situation from the viewer's perspective. This is the single
 * representation of "I locked / they locked / both / neither" so that no read
 * path has to re-derive it from the raw creatorLocked/partnerLocked booleans.
 */
export type WeeklyGoalLockState =
  | "none"
  | "viewer_locked"
  | "partner_locked"
  | "both_locked";

/** Expand a WeeklyGoalLockState back into the two viewer-relative booleans. */
export function getWeeklyGoalLockFlags(lockState: WeeklyGoalLockState): {
  viewerLocked: boolean;
  partnerLocked: boolean;
} {
  return {
    viewerLocked: lockState === "viewer_locked" || lockState === "both_locked",
    partnerLocked: lockState === "partner_locked" || lockState === "both_locked",
  };
}

export interface WeeklyGoalThemeProgress {
  creatorCompleted: boolean;
  partnerCompleted?: boolean;
}

export interface WeeklyGoalState {
  mode: WeeklyGoalMode;
  themes: WeeklyGoalThemeProgress[];
  status: WeeklyGoalLifecycleStatus;
  lockedAt?: number;
  endDate?: number;
  miniBossStatus: WeeklyGoalBossStatus;
  bigBossStatus: WeeklyGoalBossStatus;
}

export interface WeeklyGoalLockableState extends WeeklyGoalState {
  partnerId?: unknown;
  creatorLocked: boolean;
  partnerLocked?: boolean;
}

export interface SoloThemeProgress extends WeeklyGoalThemeProgress {
  creatorCompleted: boolean;
  partnerCompleted?: undefined;
}

export interface SharedThemeProgress extends WeeklyGoalThemeProgress {
  creatorCompleted: boolean;
  partnerCompleted: boolean;
}

export type SoloGoal<T extends WeeklyGoalState = WeeklyGoalState> = T & {
  mode: "solo";
  partnerId?: undefined;
  partnerLocked?: undefined;
  themes: SoloThemeProgress[];
};

export type SharedGoal<T extends WeeklyGoalState = WeeklyGoalState> = T & {
  mode: "shared";
  partnerId: unknown;
  partnerLocked: boolean;
  themes: SharedThemeProgress[];
};

export type NormalizedWeeklyGoal<T extends WeeklyGoalState = WeeklyGoalState> =
  | SoloGoal<T>
  | SharedGoal<T>;

export type WeeklyGoalRuleCode =
  | "INVALID_STATE"
  | "INVALID_INPUT";

export class WeeklyGoalRuleViolation extends Error {
  constructor(
    public readonly code: WeeklyGoalRuleCode,
    message: string
  ) {
    super(message);
    this.name = "WeeklyGoalRuleViolation";
  }
}

export type WeeklyGoalLockPlan =
  | {
      kind: "first_lock";
      role: WeeklyGoalParticipantRole;
      otherRole?: WeeklyGoalParticipantRole;
      updates: { creatorLocked: true } | { partnerLocked: true };
    }
  | {
      kind: "activate_goal";
      role: WeeklyGoalParticipantRole;
      otherRole?: WeeklyGoalParticipantRole;
      updates:
        | { creatorLocked: true; status: "locked"; lockedAt: number }
        | { partnerLocked: true; status: "locked"; lockedAt: number };
    };

export function normalizeWeeklyGoal<T extends WeeklyGoalState>(
  goal: T
): NormalizedWeeklyGoal<T> {
  const partnerId = (goal as T & { partnerId?: unknown }).partnerId;
  const partnerLocked = (goal as T & { partnerLocked?: boolean }).partnerLocked;

  if (goal.mode === "shared") {
    if (partnerId === undefined || partnerLocked === undefined) {
      throw new WeeklyGoalRuleViolation(
        "INVALID_STATE",
        "Shared weekly goal is missing partner data"
      );
    }
    if (goal.themes.some((theme) => theme.partnerCompleted === undefined)) {
      throw new WeeklyGoalRuleViolation(
        "INVALID_STATE",
        "Shared weekly goal is missing partner theme progress"
      );
    }
    return goal as SharedGoal<T>;
  }

  // mode === "solo"
  if (partnerId !== undefined || partnerLocked !== undefined) {
    throw new WeeklyGoalRuleViolation(
      "INVALID_STATE",
      "Solo weekly goal cannot have partner data"
    );
  }
  if (goal.themes.some((theme) => theme.partnerCompleted !== undefined)) {
    throw new WeeklyGoalRuleViolation(
      "INVALID_STATE",
      "Solo weekly goal cannot have partner theme progress"
    );
  }
  return goal as SoloGoal<T>;
}

export function isGoalThemeCompleted(
  theme: WeeklyGoalThemeProgress,
  mode: WeeklyGoalMode
): boolean {
  return mode === "solo"
    ? theme.creatorCompleted
    : theme.creatorCompleted && theme.partnerCompleted === true;
}

export function countCompletedThemes(
  themes: WeeklyGoalThemeProgress[],
  mode: WeeklyGoalMode
): number {
  return themes.filter((theme) => isGoalThemeCompleted(theme, mode)).length;
}

export function areAllThemesCompleted(
  themes: WeeklyGoalThemeProgress[],
  mode: WeeklyGoalMode
): boolean {
  return themes.length > 0 && countCompletedThemes(themes, mode) === themes.length;
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

export function isGoalPlayable(
  goal: WeeklyGoalState,
  now: number
): boolean {
  const effectiveStatus = getEffectiveGoalStatus(goal, now);
  if (effectiveStatus === "locked") {
    return true;
  }
  if (effectiveStatus === "grace_period") {
    // Playable only until the permanent-deletion deadline; a goal past deleteAt
    // but not yet swept by the cleanup cron must not be boss-playable.
    const deleteAt = getGoalDeleteAt(goal.endDate);
    return deleteAt !== null && now < deleteAt;
  }
  return false;
}

export function formatGoalCountdown(timeRemainingMs: number): string {
  const clampedMs = Math.max(0, timeRemainingMs);
  const totalSeconds = Math.floor(clampedMs / 1000);
  const totalHours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(totalHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getEffectiveGoalStatus(
  goal: WeeklyGoalState,
  now: number
): WeeklyGoalLifecycleStatus {
  if (goal.status === "completed" || goal.bigBossStatus === "defeated") {
    return "completed";
  }

  if (goal.status === "draft") {
    return "draft";
  }

  if (goal.status === "grace_period") {
    return "grace_period";
  }

  if (typeof goal.endDate === "number" && now > goal.endDate) {
    return "grace_period";
  }

  return "locked";
}

export function getEffectiveMiniBossStatus(
  goal: WeeklyGoalState,
  now: number
): WeeklyGoalBossStatus {
  if (getEffectiveGoalStatus(goal, now) === "draft") {
    return "unavailable";
  }

  const completedThemeCount = countCompletedThemes(goal.themes, goal.mode);
  const unlockThreshold = getMiniBossUnlockThreshold(goal.themes.length);

  if (areAllThemesCompleted(goal.themes, goal.mode)) {
    return "unavailable";
  }

  if (goal.miniBossStatus === "defeated") {
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

export function getEffectiveBigBossStatus(
  goal: WeeklyGoalState,
  now: number
): WeeklyGoalBossStatus {
  if (goal.bigBossStatus === "defeated") {
    return "defeated";
  }

  if (getEffectiveGoalStatus(goal, now) === "draft") {
    return "unavailable";
  }

  const allThemesCompleted = areAllThemesCompleted(goal.themes, goal.mode);

  if (allThemesCompleted) {
    return "ready";
  }

  return "unavailable";
}

export function canEditGoalEndDate(
  goal: WeeklyGoalState,
  now: number
): boolean {
  return getEffectiveGoalStatus(goal, now) === "draft";
}

export function canToggleGoalThemeCompletion({
  effectiveStatus,
}: {
  effectiveStatus: WeeklyGoalLifecycleStatus | undefined;
}): boolean {
  return effectiveStatus !== undefined && effectiveStatus !== "completed";
}

function validateParticipantLock(
  goal: WeeklyGoalLockableState,
  role: WeeklyGoalParticipantRole
): void {
  if (goal.mode === "solo") {
    if (role !== "creator") {
      throw new WeeklyGoalRuleViolation("INVALID_STATE", "Solo goals can only be started by the creator");
    }
    if (goal.partnerId !== undefined || goal.partnerLocked !== undefined) {
      throw new WeeklyGoalRuleViolation("INVALID_STATE", "Solo weekly goal cannot have partner data");
    }
  }
  if (goal.status !== "draft") {
    throw new WeeklyGoalRuleViolation("INVALID_STATE", "Goal already locked");
  }
  const alreadyLocked = role === "creator" ? goal.creatorLocked : goal.partnerLocked;
  if (alreadyLocked) {
    throw new WeeklyGoalRuleViolation("INVALID_STATE", "You already locked this goal");
  }
}

export function planWeeklyGoalLock({
  goal,
  role,
  now,
}: {
  goal: WeeklyGoalLockableState;
  role: WeeklyGoalParticipantRole;
  now: number;
}): WeeklyGoalLockPlan {
  validateParticipantLock(goal, role);
  validateLockRequirements(goal, now);
  const updates = role === "creator"
    ? { creatorLocked: true as const }
    : { partnerLocked: true as const };
  if (goal.mode === "solo") {
    return { kind: "activate_goal", role,
      updates: { ...updates, status: "locked", lockedAt: now } };
  }
  const otherRole = role === "creator" ? "partner" : "creator";
  const otherLocked = role === "creator" ? goal.partnerLocked : goal.creatorLocked;
  if (otherLocked) {
    return { kind: "activate_goal", role, otherRole,
      updates: { ...updates, status: "locked", lockedAt: now } };
  }
  return { kind: "first_lock", role, otherRole, updates };
}

function validateLockRequirements(goal: WeeklyGoalLockableState, now: number): void {
  if (goal.themes.length < MIN_THEMES_PER_GOAL) {
    const minThemesRequired: number = MIN_THEMES_PER_GOAL;
    const themeLabel = minThemesRequired === 1 ? "theme" : "themes";
    throw new WeeklyGoalRuleViolation(
      "INVALID_INPUT",
      `Add at least ${minThemesRequired} ${themeLabel} before locking`
    );
  }

  if (typeof goal.endDate !== "number") {
    throw new WeeklyGoalRuleViolation("INVALID_INPUT", "Choose an end date before locking");
  }

  if (goal.endDate - now < MIN_GOAL_DURATION_MS) {
    throw new WeeklyGoalRuleViolation(
      "INVALID_INPUT",
      "End date must be at least 24 hours from now"
    );
  }
}
