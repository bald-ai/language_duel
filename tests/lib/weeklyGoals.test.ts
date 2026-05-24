import { describe, expect, it } from "vitest";
import {
  areAllThemesCompleted,
  canEditGoalEndDate,
  canToggleGoalThemeCompletion,
  countCompletedThemes,
  formatGoalCountdown,
  getGoalDeleteAt,
  getEffectiveBigBossStatus,
  getEffectiveGoalStatus,
  getEffectiveMiniBossStatus,
  getGoalDraftExpiresAt,
  isGoalPlayable,
  planWeeklyGoalLock,
  WeeklyGoalRuleViolation,
  type WeeklyGoalState,
} from "@/lib/weeklyGoals";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const GRACE_PERIOD_MS = 48 * HOUR;
const WEEK_MS = 7 * DAY;

function buildGoal(
  overrides: Partial<WeeklyGoalState> = {}
): WeeklyGoalState {
  return {
    mode: "shared",
    themes: [
      { creatorCompleted: true, partnerCompleted: true },
      { creatorCompleted: false, partnerCompleted: false },
    ],
    status: "locked",
    lockedAt: 1_000,
    endDate: 9_000,
    miniBossStatus: "unavailable",
    bigBossStatus: "unavailable",
    ...overrides,
  };
}

describe("weeklyGoals helpers", () => {
  it("keeps the mini boss unavailable when theme count is below the minimum", () => {
    const goal = buildGoal({
      themes: [{ creatorCompleted: true, partnerCompleted: true }],
    });
    expect(getEffectiveMiniBossStatus(goal, 2_000)).toBe("unavailable");
  });

  it("counts only jointly completed themes", () => {
    expect(
      countCompletedThemes([
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: false },
        { creatorCompleted: false, partnerCompleted: true },
      ], "shared")
    ).toBe(1);
  });

  it("counts solo completion from the creator only", () => {
    const themes = [
      { creatorCompleted: true },
      { creatorCompleted: false },
      { creatorCompleted: true },
    ];

    expect(countCompletedThemes(themes, "solo")).toBe(2);
    expect(areAllThemesCompleted(themes, "solo")).toBe(false);
    expect(areAllThemesCompleted(
      [{ creatorCompleted: true }, { creatorCompleted: true }],
      "solo"
    )).toBe(true);
  });

  it("derives the delete deadline from the end date plus the grace window", () => {
    const endDate = 1_000;
    expect(getGoalDeleteAt(endDate)).toBe(endDate + GRACE_PERIOD_MS);
  });

  it("derives the draft expiry from createdAt plus the draft TTL", () => {
    const createdAt = 1_000;
    expect(getGoalDraftExpiresAt(createdAt)).toBe(createdAt + WEEK_MS);
  });

  it("formats the countdown as total-hours hh:mm:ss", () => {
    expect(formatGoalCountdown((47 * 60 * 60 + 59 * 60 + 59) * 1_000)).toBe("47:59:59");
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

    expect(getEffectiveGoalStatus(goal, now)).toBe("grace_period");
    expect(isGoalPlayable(goal, now)).toBe(true);
  });

  it("stops being playable once the grace window is past the delete deadline", () => {
    const goal = buildGoal();
    const deleteAt = getGoalDeleteAt(goal.endDate)!;

    // Still grace_period by effective status, but past the permanent-deletion
    // deadline (e.g. the cleanup cron has not swept it yet) — must not be playable.
    expect(getEffectiveGoalStatus(goal, deleteAt + 1)).toBe("grace_period");
    expect(isGoalPlayable(goal, deleteAt)).toBe(false);
    expect(isGoalPlayable(goal, deleteAt + 1)).toBe(false);
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
      bigBossStatus: "unavailable",
    });

    expect(getEffectiveMiniBossStatus(goal, 5_000)).toBe("unavailable");
    expect(getEffectiveBigBossStatus(goal, 5_000)).toBe("unavailable");
    expect(isGoalPlayable(goal, 5_000)).toBe(false);
  });

  it("makes the big boss ready once all shared themes are done", () => {
    const goal = buildGoal({
      themes: [
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: true },
      ],
    });

    expect(getEffectiveBigBossStatus(goal, 4_000)).toBe("ready");
  });

  it("keeps the mini boss unavailable once all shared themes are done", () => {
    const goal = buildGoal({
      themes: [
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: true },
      ],
    });

    expect(getEffectiveMiniBossStatus(goal, 4_000)).toBe("unavailable");
    expect(getEffectiveBigBossStatus(goal, 4_000)).toBe("ready");
    expect(isGoalPlayable(goal, 4_000)).toBe(true);
  });

  it("keeps the mini boss unavailable after big boss opens even when mini was defeated", () => {
    const goal = buildGoal({
      themes: [
        { creatorCompleted: true, partnerCompleted: true },
        { creatorCompleted: true, partnerCompleted: true },
      ],
      miniBossStatus: "defeated",
    });

    expect(getEffectiveMiniBossStatus(goal, 4_000)).toBe("unavailable");
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
    const goal = buildGoal();
    expect(isGoalPlayable(goal, 5_000)).toBe(true);
    expect(getEffectiveMiniBossStatus(goal, 5_000)).toBe("ready");
    expect(isGoalPlayable(goal, 9_001)).toBe(true);
    expect(getEffectiveMiniBossStatus(goal, 9_001)).toBe("ready");
  });

  it("centralizes whether a weekly-goal theme can be toggled", () => {
    expect(canToggleGoalThemeCompletion({ effectiveStatus: "draft" })).toBe(true);
    expect(canToggleGoalThemeCompletion({ effectiveStatus: "locked" })).toBe(true);
    expect(canToggleGoalThemeCompletion({ effectiveStatus: "grace_period" })).toBe(true);
    expect(canToggleGoalThemeCompletion({ effectiveStatus: "completed" })).toBe(false);
    expect(canToggleGoalThemeCompletion({ effectiveStatus: undefined })).toBe(false);
  });

  it("plans the first weekly-goal lock without side effects", () => {
    const now = 1_000;
    const plan = planWeeklyGoalLock({
      goal: {
        ...buildGoal({
          status: "draft",
          lockedAt: undefined,
          endDate: now + 25 * HOUR,
        }),
        creatorLocked: false,
        partnerLocked: false,
      },
      role: "creator",
      now,
    });

    expect(plan).toEqual({
      kind: "first_lock",
      role: "creator",
      otherRole: "partner",
      updates: { creatorLocked: true },
    });
  });

  it("plans goal activation when the second participant locks", () => {
    const now = 1_000;
    const plan = planWeeklyGoalLock({
      goal: {
        ...buildGoal({
          status: "draft",
          lockedAt: undefined,
          endDate: now + 25 * HOUR,
        }),
        creatorLocked: true,
        partnerLocked: false,
      },
      role: "partner",
      now,
    });

    expect(plan).toEqual({
      kind: "activate_goal",
      role: "partner",
      otherRole: "creator",
      updates: { partnerLocked: true, status: "locked", lockedAt: now },
    });
  });

  it("plans solo goal activation with one creator lock", () => {
    const now = 1_000;
    const plan = planWeeklyGoalLock({
      goal: {
        ...buildGoal({
          mode: "solo",
          themes: [
            { creatorCompleted: false },
            { creatorCompleted: false },
          ],
          status: "draft",
          lockedAt: undefined,
          endDate: now + 25 * HOUR,
        }),
        creatorLocked: false,
        partnerId: undefined,
        partnerLocked: undefined,
      },
      role: "creator",
      now,
    });

    expect(plan).toEqual({
      kind: "activate_goal",
      role: "creator",
      updates: { creatorLocked: true, status: "locked", lockedAt: now },
    });
  });

  it("rejects partner locks for solo goals", () => {
    expect(() =>
      planWeeklyGoalLock({
        goal: {
          ...buildGoal({
            mode: "solo",
            themes: [
              { creatorCompleted: false },
              { creatorCompleted: false },
            ],
            status: "draft",
            lockedAt: undefined,
            endDate: 2_000 + 25 * HOUR,
          }),
          creatorLocked: false,
          partnerId: undefined,
          partnerLocked: undefined,
        },
        role: "partner",
        now: 2_000,
      })
    ).toThrow(WeeklyGoalRuleViolation);
  });

  it("rejects invalid lock plans before side effects run", () => {
    expect(() =>
      planWeeklyGoalLock({
        goal: {
          ...buildGoal({
            status: "draft",
            lockedAt: undefined,
            endDate: 1_000,
          }),
          creatorLocked: false,
          partnerLocked: false,
        },
        role: "creator",
        now: 1_000,
      })
    ).toThrow(WeeklyGoalRuleViolation);
  });
});
