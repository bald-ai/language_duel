import { describe, expect, it } from "vitest";
import { buildGoalWithUsers, shouldIncludeGoal, sortGoalsByRecency, validateEndDateTimestamp,
  validateGoalEndDateAtLeast24hAhead } from "@/convex/weeklyGoals/readModels";
import type { Doc, Id } from "@/convex/_generated/dataModel";
const creatorId = "creator" as Id<"users">;
const partnerId = "partner" as Id<"users">;
function goal(changes: Partial<Doc<"weeklyGoals">> = {}): Doc<"weeklyGoals"> {
  return { _id: "goal" as Id<"weeklyGoals">, _creationTime: 1, createdAt: 1, mode: "shared", creatorId, partnerId,
    creatorLocked: false, partnerLocked: false, miniBossStatus: "unavailable", bigBossStatus: "unavailable", status: "draft",
    themes: [{ themeId: "theme" as Id<"themes">, themeName: "Animals", creatorCompleted: true, partnerCompleted: false }], ...changes };
}
const users = new Map<Id<"users">, Doc<"users"> | null>([
  [creatorId, { _id: creatorId, _creationTime: 1, clerkId: "clerk-creator", name: "Creator", email: "private@example.test" }],
  [partnerId, { _id: partnerId, _creationTime: 2, clerkId: "clerk-partner", nickname: "Partner", email: "partner@example.test" }],
]);

describe("weekly goal read model", () => {
  it.each([
    [false, false, "creator", "none"], [true, false, "creator", "viewer_locked"],
    [false, true, "creator", "partner_locked"], [true, true, "creator", "both_locked"],
    [false, false, "partner", "none"], [true, false, "partner", "partner_locked"],
    [false, true, "partner", "viewer_locked"], [true, true, "partner", "both_locked"],
  ] as const)("maps shared locks %s/%s for %s", (creatorLocked, partnerLocked, viewerRole, lockState) => {
    const view = buildGoalWithUsers(goal({ creatorLocked, partnerLocked }), users, viewerRole, 1000);
    expect(view.lockState).toBe(lockState);
    expect(view.viewerRole).toBe(viewerRole);
    expect(view.completedThemeCount).toBe(0);
    expect(view.canEditEndDate).toBe(true);
    expect(view.creator).toEqual({ _id: creatorId, name: "Creator", nickname: undefined, discriminator: undefined, imageUrl: undefined });
    expect(view.partner?.nickname).toBe("Partner");
  });
  it.each([false, true])("forces the creator perspective for solo locks %s", creatorLocked => {
    const view = buildGoalWithUsers(goal({ mode: "solo", partnerId: undefined, partnerLocked: undefined, creatorLocked,
      themes: [{ themeId: "theme" as Id<"themes">, themeName: "Animals", creatorCompleted: true }] }), users, "partner", 1000);
    expect(view.viewerRole).toBe("creator");
    expect(view.lockState).toBe(creatorLocked ? "viewer_locked" : "none");
    expect(view.partner).toBeNull();
    expect(view.completedThemeCount).toBe(1);
  });
  it("projects missing users as null without losing goal progress", () => {
    const view = buildGoalWithUsers(goal(), new Map(), "creator", 1000);
    expect(view.creator).toBeNull();
    expect(view.partner).toBeNull();
    expect(view.goal.themes).toHaveLength(1);
  });
  it("keeps grace goals visible but excludes completed goals", () => {
    expect(shouldIncludeGoal(goal({ status: "locked", endDate: 1 }), 1000000000)).toBe(true);
    expect(shouldIncludeGoal(goal({ status: "completed" }), 1000)).toBe(false);
    expect(shouldIncludeGoal(goal({ bigBossStatus: "defeated" }), 1000)).toBe(false);
  });
  it.each([NaN, Infinity, -Infinity])("rejects nonfinite end date %s", date => {
    expect(() => validateEndDateTimestamp(date)).toThrow("Invalid end date");
  });
  it("accepts finite timestamps and enforces the exact 24-hour boundary", () => {
    expect(() => validateEndDateTimestamp(0)).not.toThrow();
    expect(() => validateGoalEndDateAtLeast24hAhead(86400999, 1000)).toThrow("at least 24 hours");
    expect(() => validateGoalEndDateAtLeast24hAhead(86401000, 1000)).not.toThrow();
  });
  it("sorts by lock time then creation time without mutating the source", () => {
    const models = [goal({ createdAt: 2 }), goal({ lockedAt: 5, createdAt: 1 }), goal({ lockedAt: 5, createdAt: 3 })]
      .map(item => buildGoalWithUsers(item, users, "creator", 1000));
    const sorted = sortGoalsByRecency(models);
    expect(sorted).toEqual([models[2], models[1], models[0]]);
    expect(models[0].goal.createdAt).toBe(2);
  });
});
