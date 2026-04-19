import { describe, expect, it } from "vitest";
import {
  canEditGoalEndDate,
  canTriggerGoalBoss,
  countCompletedThemes,
  getCountdownBossType,
  getEffectiveBossStatus,
  getEffectiveGoalStatus,
  getEffectiveMiniBossStatus,
  getGoalMidpointAt,
  MIN_THEMES_PER_GOAL,
  type WeeklyGoalStateLike,
} from "@/lib/weeklyGoals";

function buildGoal(
  overrides: Partial<WeeklyGoalStateLike> = {}
): WeeklyGoalStateLike {
  return {
    themes: [
      { creatorCompleted: true, partnerCompleted: true },
      { creatorCompleted: false, partnerCompleted: false },
    ],
    status: "active",
    lockedAt: 1_000,
    endDate: 9_000,
    miniBossStatus: "locked",
    bossStatus: "locked",
    ...overrides,
  };
}

describe("weeklyGoals helpers", () => {
  it("keeps the minimum lock requirement at two themes", () => {
    expect(MIN_THEMES_PER_GOAL).toBe(2);
  });

  it("counts only jointly completed themes", () => {
    expect(
      countCompletedThemes([
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: false },
        { creatorCompleted: false, partnerCompleted: true },
      ])
    ).toBe(1);
  });

  it("derives midpoint from lockedAt and endDate", () => {
    expect(getGoalMidpointAt(1_000, 9_000)).toBe(5_000);
  });

  it("returns editing as the effective status for unlocked goals", () => {
    expect(
      getEffectiveGoalStatus(
        buildGoal({ status: "editing", lockedAt: undefined, endDate: undefined }),
        2_000
      )
    ).toBe("editing");
  });

  it("returns expired once the end date has passed", () => {
    expect(getEffectiveGoalStatus(buildGoal(), 9_001)).toBe("expired");
  });

  it("unlocks the mini boss at the midpoint", () => {
    expect(getEffectiveMiniBossStatus(buildGoal(), 5_000)).toBe("available");
  });

  it("switches the countdown to the big boss once mini boss is completed early", () => {
    expect(
      getCountdownBossType(buildGoal({ miniBossStatus: "completed" }), 2_000)
    ).toBe("big");
  });

  it("unlocks the mini boss early once half the themes are jointly completed", () => {
    expect(getEffectiveMiniBossStatus(buildGoal(), 2_000)).toBe("available");
  });

  it("keeps the big boss locked until the mini boss is completed", () => {
    const goal = buildGoal({
      themes: [
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: true },
      ],
    });

    expect(getEffectiveBossStatus(goal, 4_000)).toBe("locked");
  });

  it("makes the big boss available after mini boss completion and all shared themes are done", () => {
    const goal = buildGoal({
      themes: [
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: true },
      ],
      miniBossStatus: "completed",
    });

    expect(getEffectiveBossStatus(goal, 4_000)).toBe("available");
  });

  it("allows editing the end date while planning", () => {
    expect(
      canEditGoalEndDate(
        buildGoal({ status: "editing", lockedAt: undefined, endDate: 9_000 }),
        2_000
      )
    ).toBe(true);
  });

  it("blocks end-date edits after all themes are completed", () => {
    const goal = buildGoal({
      themes: [
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: true },
      ],
      miniBossStatus: "completed",
    });

    expect(canEditGoalEndDate(goal, 4_000)).toBe(false);
  });

  it("allows triggering the mini boss only while the goal is active", () => {
    expect(canTriggerGoalBoss(buildGoal(), "mini", 5_000)).toBe(true);
    expect(canTriggerGoalBoss(buildGoal(), "mini", 9_001)).toBe(false);
  });
});
