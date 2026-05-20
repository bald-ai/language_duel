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

export interface WeeklyGoalThemeProgress {
  creatorCompleted: boolean;
  partnerCompleted?: boolean;
}

export interface WeeklyGoalState {
  mode?: WeeklyGoalMode;
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
  const effectiveMode: WeeklyGoalMode = goal.mode ?? "shared";
  if (effectiveMode === "shared") {
    const partnerId = (goal as T & { partnerId?: unknown }).partnerId;
    const partnerLocked = (goal as T & { partnerLocked?: boolean }).partnerLocked;
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

  if (effectiveMode === "solo") {
    const partnerId = (goal as T & { partnerId?: unknown }).partnerId;
    const partnerLocked = (goal as T & { partnerLocked?: boolean }).partnerLocked;
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

  throw new WeeklyGoalRuleViolation(
    "INVALID_STATE",
    "Weekly goal mode is missing"
  );
}

export function countCompletedThemes(
  themes: WeeklyGoalThemeProgress[],
  mode: WeeklyGoalMode | undefined
): number {
  return themes.filter((theme) =>
    mode === "solo"
      ? theme.creatorCompleted
      : theme.creatorCompleted && theme.partnerCompleted === true
  ).length;
}

export function areAllThemesCompleted(
  themes: WeeklyGoalThemeProgress[],
  mode: WeeklyGoalMode | undefined
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

export function isGoalInGracePeriod(
  goal: Pick<WeeklyGoalState, "endDate" | "status" | "bigBossStatus">,
  now: number
): boolean {
  if (goal.status === "completed" || goal.bigBossStatus === "defeated") {
    return false;
  }

  const deleteAt = getGoalDeleteAt(goal.endDate);
  if (deleteAt === null) {
    return false;
  }

  return now > goal.endDate! && now < deleteAt;
}

export function isGoalPlayable(
  goal: WeeklyGoalState,
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

export function planWeeklyGoalLock({
  goal,
  role,
  now,
}: {
  goal: WeeklyGoalLockableState;
  role: WeeklyGoalParticipantRole;
  now: number;
}): WeeklyGoalLockPlan {
  if (goal.mode === "solo") {
    if (role !== "creator") {
      throw new WeeklyGoalRuleViolation("INVALID_STATE", "Solo goals can only be started by the creator");
    }
    if (goal.partnerId !== undefined || goal.partnerLocked !== undefined) {
      throw new WeeklyGoalRuleViolation("INVALID_STATE", "Solo weekly goal cannot have partner data");
    }
    if (goal.status !== "draft") {
      throw new WeeklyGoalRuleViolation("INVALID_STATE", "Goal already locked");
    }
    if (goal.creatorLocked) {
      throw new WeeklyGoalRuleViolation("INVALID_STATE", "You already locked this goal");
    }
    validateLockRequirements(goal, now);
    return {
      kind: "activate_goal",
      role,
      updates: { creatorLocked: true, status: "locked", lockedAt: now },
    };
  }

  if (goal.status !== "draft") {
    throw new WeeklyGoalRuleViolation("INVALID_STATE", "Goal already locked");
  }

  if (role === "creator" && goal.creatorLocked) {
    throw new WeeklyGoalRuleViolation("INVALID_STATE", "You already locked this goal");
  }

  if (role === "partner" && goal.partnerLocked) {
    throw new WeeklyGoalRuleViolation("INVALID_STATE", "You already locked this goal");
  }

  validateLockRequirements(goal, now);

  const bothLocked = role === "creator"
    ? goal.partnerLocked
    : goal.creatorLocked;
  const otherRole: WeeklyGoalParticipantRole = role === "creator" ? "partner" : "creator";

  if (bothLocked) {
    return role === "creator"
      ? {
          kind: "activate_goal",
          role,
          otherRole,
          updates: { creatorLocked: true, status: "locked", lockedAt: now },
        }
      : {
          kind: "activate_goal",
          role,
          otherRole,
          updates: { partnerLocked: true, status: "locked", lockedAt: now },
        };
  }

  return role === "creator"
    ? {
        kind: "first_lock",
        role,
        otherRole,
        updates: { creatorLocked: true },
      }
    : {
        kind: "first_lock",
        role,
        otherRole,
        updates: { partnerLocked: true },
      };
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

export function canTriggerGoalBoss(
  goal: WeeklyGoalState,
  which: "mini" | "big",
  now: number
): boolean {
  if (!isGoalPlayable(goal, now)) {
    return false;
  }

  return which === "mini"
    ? getEffectiveMiniBossStatus(goal, now) === "ready"
    : getEffectiveBigBossStatus(goal, now) === "ready";
}
