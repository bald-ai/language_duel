"use client";

import type { GoalWithUsers } from "@/convex/weeklyGoals";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { getMiniBossUnlockThreshold } from "@/lib/weeklyGoals";
import { MIN_THEMES_TO_LOCK_GOAL } from "../constants";
import {
  BOSS_INFO_COPY,
  formatBossStatus,
  getBossButtonStyle,
  isBossButtonDisabled,
} from "../bossUi";

interface GoalBossProgressPanelProps {
  selectedGoal: GoalWithUsers;
  isDraft: boolean;
  allSelectedThemesCompleted: boolean;
  miniBossDisplayStatus: "unavailable" | "ready" | "defeated";
  miniBossLabel: string;
  onStartMiniBoss: () => void;
  onStartBigBoss: () => void;
}

export function GoalBossProgressPanel({
  selectedGoal,
  isDraft,
  allSelectedThemesCompleted,
  miniBossDisplayStatus,
  miniBossLabel,
  onStartMiniBoss,
  onStartBigBoss,
}: GoalBossProgressPanelProps) {
  const colors = useAppearanceColors();
  const guidance = bossGuidance({ selectedGoal, isDraft, allSelectedThemesCompleted });

  return (
    <section
      className="rounded-2xl border-2 p-4 space-y-3"
      style={{
        backgroundColor: colors.background.elevated,
        borderColor: colors.primary.dark,
      }}
    >
      <div className="flex items-center justify-between">
        <p
          className="text-sm font-bold uppercase tracking-wide"
          style={{ color: colors.text.DEFAULT }}
        >
          Boss Progress
        </p>
        <div className="flex items-center gap-2">
          <p className="text-sm" style={{ color: colors.text.muted }}>
            Shared themes: {selectedGoal.completedThemeCount}/{selectedGoal.goal.themes.length}
          </p>
          <details className="relative">
            <summary
              className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border text-xs font-bold"
              style={{
                borderColor: colors.primary.dark,
                backgroundColor: colors.background.DEFAULT,
                color: colors.text.muted,
              }}
              aria-label="Boss info"
            >
              i
            </summary>
            <div
              className="absolute right-0 top-8 z-10 w-72 rounded-xl border-2 p-3 text-xs shadow-lg"
              style={{
                borderColor: colors.primary.dark,
                backgroundColor: colors.background.elevated,
                color: colors.text.DEFAULT,
              }}
            >
              <p className="font-semibold" style={{ color: colors.text.DEFAULT }}>
                Mini Boss
              </p>
              <p style={{ color: colors.text.muted }}>
                {BOSS_INFO_COPY.mini}
              </p>
              <p className="mt-3 font-semibold" style={{ color: colors.text.DEFAULT }}>
                Big Boss
              </p>
              <p style={{ color: colors.text.muted }}>
                {BOSS_INFO_COPY.big}
              </p>
            </div>
          </details>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onStartMiniBoss}
          disabled={allSelectedThemesCompleted || isBossButtonDisabled(selectedGoal.miniBossStatus)}
          className="flex-1 rounded-xl border-2 px-3 py-2 text-left transition-all disabled:opacity-60"
          style={getBossButtonStyle(miniBossDisplayStatus, colors)}
          data-testid="goals-mini-boss-trigger"
        >
          <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
            Mini Boss
          </p>
          <p className="font-semibold" style={{ color: colors.text.DEFAULT }}>
            {miniBossLabel}
          </p>
        </button>
        <button
          onClick={onStartBigBoss}
          disabled={isBossButtonDisabled(selectedGoal.bigBossStatus)}
          className="flex-1 rounded-xl border-2 px-3 py-2 text-left transition-all disabled:opacity-60"
          style={getBossButtonStyle(selectedGoal.bigBossStatus, colors)}
          data-testid="goals-big-boss-trigger"
        >
          <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
            Big Boss
          </p>
          <p className="font-semibold" style={{ color: colors.text.DEFAULT }}>
            {formatBossStatus(selectedGoal.bigBossStatus)}
          </p>
        </button>
      </div>
      {guidance && <p className="text-xs" style={{ color: colors.text.muted }}>{guidance}</p>}
    </section>
  );
}

function bossGuidance({ selectedGoal, isDraft, allSelectedThemesCompleted }: Pick<GoalBossProgressPanelProps, "selectedGoal" | "isDraft" | "allSelectedThemesCompleted">): string | null {
  if (isDraft) return `Lock the goal with at least ${MIN_THEMES_TO_LOCK_GOAL} themes and an end date to start boss tracking.`;
  if (allSelectedThemesCompleted) return "All themes completed - Do big boss!";
  if (selectedGoal.miniBossStatus === "unavailable") {
    const threshold = getMiniBossUnlockThreshold(selectedGoal.goal.themes.length);
    return `Mini boss unlocks when ${threshold} theme${threshold === 1 ? " is" : "s are"} done.`;
  }
  if (selectedGoal.bigBossStatus !== "unavailable") return null;
  return selectedGoal.miniBossStatus === "ready"
    ? "Tap Mini Boss to start, or complete all themes to unlock the big boss."
    : "Complete all themes to unlock the big boss.";
}
