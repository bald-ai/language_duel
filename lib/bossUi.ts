import { colors } from "./theme";
import type { WeeklyGoalBossStatus } from "./weeklyGoals";

export function formatBossStatus(status: WeeklyGoalBossStatus): string {
  switch (status) {
    case "unavailable":
      return "Unavailable";
    case "ready":
      return "Ready";
    case "defeated":
      return "✓ Defeated";
  }
}

export function getBossButtonStyle(status: WeeklyGoalBossStatus) {
  return {
    borderColor:
      status === "defeated"
        ? colors.status.success.DEFAULT
        : status === "ready"
          ? colors.cta.DEFAULT
          : colors.primary.dark,
    backgroundColor:
      status === "defeated"
        ? `${colors.status.success.DEFAULT}15`
        : status === "ready"
          ? `${colors.cta.DEFAULT}15`
          : colors.background.DEFAULT,
  };
}

export function isBossButtonDisabled(status: WeeklyGoalBossStatus): boolean {
  return status !== "ready";
}

export const BOSS_INFO_COPY = {
  mini: "Mini Boss unlocks halfway through shared completed themes. Defeat it before Big Boss opens to give Big Boss +1 shared life.",
  big: "Lives are shared by the couple. Big Boss opens after all themes are completed and completes the goal at Bronze or better.",
} as const;
