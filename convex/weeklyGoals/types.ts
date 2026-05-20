import type { Doc } from "../_generated/dataModel";
import type {
  WeeklyGoalMode,
  WeeklyGoalBossStatus,
  WeeklyGoalLifecycleStatus,
} from "../../lib/weeklyGoals";
import type { BossType } from "../../lib/limitedLives";
import type { UserSummary } from "../helpers/userSummary";

export type { BossType };
export type { UserSummary };
export type WeeklyGoalPracticeSource = "live" | "snapshot";
export type GoalRole = "creator" | "partner";

export interface GoalWithUsers {
  goal: Doc<"weeklyGoals">;
  mode: WeeklyGoalMode;
  creator: UserSummary | null;
  partner: UserSummary | null;
  viewerRole: GoalRole;
  effectiveStatus: WeeklyGoalLifecycleStatus;
  miniBossStatus: WeeklyGoalBossStatus;
  bigBossStatus: WeeklyGoalBossStatus;
  completedThemeCount: number;
  canEditEndDate: boolean;
}
