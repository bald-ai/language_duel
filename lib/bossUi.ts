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
  mini: "A checkpoint duel using half your themes. Both players must answer every question correctly.",
  big: "The final duel using all your themes. Both players must answer every question correctly to complete the goal.",
} as const;
