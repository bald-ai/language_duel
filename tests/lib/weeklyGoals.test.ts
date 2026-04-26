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
  getGoalDraftExpiresAt,
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
    status: "locked",
    lockedAt: 1_000,
    endDate: 9_000,
    miniBossStatus: "unavailable",
    bossStatus: "unavailable",
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

  it("derives the draft expiry from createdAt plus the draft TTL", () => {
    expect(getGoalDraftExpiresAt(1_000)).toBe(604_801_000);
  });

  it("formats the grace countdown as total-hours hh:mm:ss", () => {
    expect(formatGoalGraceCountdown((47 * 60 * 60 + 59 * 60 + 59) * 1_000)).toBe("47:59:59");
  });

  it("returns draft as the effective status for unlocked goals", () => {
    expect(
      getEffectiveGoalStatus(
        buildGoal({ status: "draft", lockedAt: undefined, endDate: undefined }),
        2_000
      )
    ).toBe("draft");
  });

  it("returns grace_period once the end date has passed", () => {
    expect(getEffectiveGoalStatus(buildGoal(), 9_001)).toBe("grace_period");
  });

  it("treats the grace window as grace_period but still playable", () => {
    const now = 9_001;
    const goal = buildGoal();

    expect(isGoalInGracePeriod(goal, now)).toBe(true);
    expect(isGoalPlayable(goal, now)).toBe(true);
  });

  it("unlocks the mini boss early once half the themes are jointly completed", () => {
    expect(getEffectiveMiniBossStatus(buildGoal(), 2_000)).toBe("ready");
  });

  it("keeps the mini boss unavailable until enough themes are jointly completed", () => {
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
    ).toBe("unavailable");
  });

  it("keeps bosses unavailable while completed themes are still in draft planning", () => {
    const goal = buildGoal({
      themes: [
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: true },
      ],
      status: "draft",
      lockedAt: undefined,
      miniBossStatus: "unavailable",
      bossStatus: "unavailable",
    });

    expect(getEffectiveMiniBossStatus(goal, 5_000)).toBe("unavailable");
    expect(getEffectiveBossStatus(goal, 5_000)).toBe("unavailable");
    expect(canTriggerGoalBoss(goal, "mini", 5_000)).toBe(false);
    expect(canTriggerGoalBoss(goal, "big", 5_000)).toBe(false);
  });

  it("keeps the big boss unavailable until the mini boss is defeated", () => {
    const goal = buildGoal({
      themes: [
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: true },
      ],
    });

    expect(getEffectiveBossStatus(goal, 4_000)).toBe("unavailable");
  });

  it("makes the big boss ready after mini boss defeat and all shared themes are done", () => {
    const goal = buildGoal({
      themes: [
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: true },
      ],
      miniBossStatus: "defeated",
    });

    expect(getEffectiveBossStatus(goal, 4_000)).toBe("ready");
  });

  it("allows editing the end date while drafting", () => {
    expect(
      canEditGoalEndDate(
        buildGoal({ status: "draft", lockedAt: undefined, endDate: 9_000 }),
        2_000
      )
    ).toBe(true);
  });

  it("blocks end-date edits once both people locked the goal", () => {
    expect(canEditGoalEndDate(buildGoal({ status: "locked" }), 4_000)).toBe(false);
  });

  it("blocks end-date edits after all themes are completed", () => {
    const goal = buildGoal({
      themes: [
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: true },
      ],
      miniBossStatus: "defeated",
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
