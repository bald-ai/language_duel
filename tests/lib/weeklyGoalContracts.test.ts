import { describe, expect, it } from "vitest";
import { normalizeWeeklyGoal, planWeeklyGoalLock, getWeeklyGoalLockFlags, getEffectiveGoalStatus,
  getGoalDeleteAt, getGoalDraftExpiresAt, isGoalPlayable, type WeeklyGoalLockableState } from "@/lib/weeklyGoals";

const now = 1000;
const day = 86400000;
function goal(changes: Partial<WeeklyGoalLockableState> = {}): WeeklyGoalLockableState {
  return { mode: "shared", status: "draft", creatorLocked: false, partnerLocked: false, partnerId: "partner",
    endDate: now + day, miniBossStatus: "unavailable", bigBossStatus: "unavailable",
    themes: [{ creatorCompleted: false, partnerCompleted: false }, { creatorCompleted: false, partnerCompleted: false }], ...changes };
}
const solo = () => goal({ mode: "solo", partnerId: undefined, partnerLocked: undefined,
  themes: [{ creatorCompleted: false }, { creatorCompleted: false }] });

describe("weekly goal contracts", () => {
  it("preserves valid shared and solo goals without changing progress", () => {
    for (const valid of [goal(), solo()]) {
      expect(normalizeWeeklyGoal(valid)).toBe(valid);
    }
  });
  it.each([
    [goal({ partnerId: undefined }), "Shared weekly goal is missing partner data"],
    [goal({ partnerLocked: undefined }), "Shared weekly goal is missing partner data"],
    [goal({ themes: [{ creatorCompleted: true }] }), "Shared weekly goal is missing partner theme progress"],
    [{ ...solo(), partnerId: "partner" }, "Solo weekly goal cannot have partner data"],
    [{ ...solo(), partnerLocked: false }, "Solo weekly goal cannot have partner data"],
    [{ ...solo(), themes: [{ creatorCompleted: true, partnerCompleted: false }] }, "Solo weekly goal cannot have partner theme progress"],
  ])("rejects inconsistent participant state %#", (invalid, message) => {
    expect(() => normalizeWeeklyGoal(invalid)).toThrow(message);
  });
  it.each([
    ["none", false, false], ["viewer_locked", true, false], ["partner_locked", false, true], ["both_locked", true, true],
  ] as const)("projects %s relative to the viewer", (state, viewerLocked, partnerLocked) => {
    expect(getWeeklyGoalLockFlags(state)).toEqual({ viewerLocked, partnerLocked });
  });
  it.each(["creator", "partner"] as const)("plans both lock orders for %s without mutating the goal", role => {
    const first = goal();
    expect(() => planWeeklyGoalLock({ goal: first, role, now })).not.toThrow();
    const otherRole = role === "creator" ? "partner" : "creator";
    const updates = role === "creator" ? { creatorLocked: true } : { partnerLocked: true };
    expect(planWeeklyGoalLock({ goal: first, role, now })).toEqual({ kind: "first_lock", role, otherRole, updates });
    expect(first.creatorLocked).toBe(false);
    expect(first.partnerLocked).toBe(false);
    const second = goal(role === "creator" ? { partnerLocked: true } : { creatorLocked: true });
    expect(planWeeklyGoalLock({ goal: second, role, now })).toEqual({ kind: "activate_goal", role, otherRole,
      updates: { ...updates, status: "locked", lockedAt: now } });
  });
  it.each([
    [goal({ status: "locked" }), "creator", "Goal already locked"],
    [goal({ creatorLocked: true }), "creator", "You already locked this goal"],
    [goal({ partnerLocked: true }), "partner", "You already locked this goal"],
    [{ ...solo(), status: "locked" }, "creator", "Goal already locked"],
    [{ ...solo(), creatorLocked: true }, "creator", "You already locked this goal"],
    [{ ...solo(), partnerId: "partner" }, "creator", "Solo weekly goal cannot have partner data"],
    [{ ...solo(), partnerLocked: false }, "creator", "Solo weekly goal cannot have partner data"],
    [solo(), "partner", "Solo goals can only be started by the creator"],
    [goal({ themes: [] }), "creator", "Add at least 2 themes before locking"],
    [goal({ endDate: undefined }), "creator", "Choose an end date before locking"],
    [goal({ endDate: now + day - 1 }), "creator", "End date must be at least 24 hours from now"],
  ] as const)("rejects invalid lock attempts %#", (invalid, role, message) => {
    expect(() => planWeeklyGoalLock({ goal: invalid, role, now })).toThrow(message);
  });
  it("enforces the exact end and grace boundaries and preserves completion", () => {
    const locked = goal({ status: "locked", endDate: now });
    expect(getEffectiveGoalStatus(locked, now)).toBe("locked");
    expect(getEffectiveGoalStatus(locked, now + 1)).toBe("grace_period");
    expect(isGoalPlayable(locked, now + 2 * day - 1)).toBe(true);
    expect(isGoalPlayable(locked, now + 2 * day)).toBe(false);
    expect(isGoalPlayable(goal({ status: "grace_period", endDate: undefined }), now)).toBe(false);
    expect(getEffectiveGoalStatus(goal({ status: "completed" }), now)).toBe("completed");
    expect(getEffectiveGoalStatus(goal({ bigBossStatus: "defeated" }), now)).toBe("completed");
    expect(getGoalDeleteAt(undefined)).toBeNull();
    expect(getGoalDraftExpiresAt(undefined)).toBeNull();
  });
});
