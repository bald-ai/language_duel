import { describe, expect, it } from "vitest";
import {
  canEditGoalEndDate,
  canTriggerGoalBoss,
  countCompletedThemes,
  formatGoalGraceCountdown,
  getGoalDeleteAt,
  getEffectiveBossStatus,
  getEffectiveGoalStatus,
  getEffectiveMiniBossStatus,
  getGoalPlanningExpiresAt,
  isGoalInGracePeriod,
  isGoalPlayable,
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

  it("derives the delete deadline from the end date plus the grace window", () => {
    expect(getGoalDeleteAt(1_000)).toBe(172_801_000);
  });

  it("derives the planning expiry from createdAt plus the editing TTL", () => {
    expect(getGoalPlanningExpiresAt(1_000)).toBe(604_801_000);
  });

  it("formats the grace countdown as total-hours hh:mm:ss", () => {
    expect(formatGoalGraceCountdown((47 * 60 * 60 + 59 * 60 + 59) * 1_000)).toBe("47:59:59");
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

  it("treats the grace window as expired but still playable", () => {
    const now = 9_001;
    const goal = buildGoal();

    expect(isGoalInGracePeriod(goal, now)).toBe(true);
    expect(isGoalPlayable(goal, now)).toBe(true);
  });

  it("unlocks the mini boss early once half the themes are jointly completed", () => {
    expect(getEffectiveMiniBossStatus(buildGoal(), 2_000)).toBe("available");
  });

  it("keeps the mini boss locked until enough themes are jointly completed", () => {
    expect(
      getEffectiveMiniBossStatus(
        buildGoal({
          themes: [
            { creatorCompleted: true, partnerCompleted: false },
            { creatorCompleted: false, partnerCompleted: false },
          ],
        }),
        5_000
      )
    ).toBe("locked");
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

  it("blocks end-date edits once both people locked the goal", () => {
    expect(canEditGoalEndDate(buildGoal({ status: "active" }), 4_000)).toBe(false);
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

  it("keeps end-date edits blocked during grace", () => {
    expect(canEditGoalEndDate(buildGoal(), 9_001)).toBe(false);
  });

  it("allows triggering the mini boss during the grace window", () => {
    expect(canTriggerGoalBoss(buildGoal(), "mini", 5_000)).toBe(true);
    expect(canTriggerGoalBoss(buildGoal(), "mini", 9_001)).toBe(true);
  });
});
