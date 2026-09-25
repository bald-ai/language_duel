import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getVisibleGoalsForViewer, getGoalForViewer, getBossLaunchPreviewForViewer, getEligibleThemesForViewer } from "@/convex/weeklyGoals/queries";
import { createIndexedQuery } from "./testUtils/inMemoryDb";
const now = 2_000_000_000_000;
const creator = "creator" as Id<"users">;
const partner = "partner" as Id<"users">;
const goalId = "goal" as Id<"weeklyGoals">;
function goal(overrides: Partial<Doc<"weeklyGoals">> = {}): Doc<"weeklyGoals"> {
  return { _id: goalId, _creationTime: 1, createdAt: now, mode: "shared", creatorId: creator, partnerId: partner, status: "draft", creatorLocked: false, partnerLocked: false, miniBossStatus: "unavailable", bigBossStatus: "unavailable", themes: [], ...overrides };
}
function theme(id: string, ownerId: Id<"users">): Doc<"themes"> {
  return { _id: id as Id<"themes">, _creationTime: 1, createdAt: 1, ownerId, name: id, description: "", visibility: "private", contentType: "word", words: [{ word: "cat", answer: "gato", wrongAnswers: ["perro"] }] };
}
function fixture(goals: Doc<"weeklyGoals">[] = [goal()]) {
  const users: Doc<"users">[] = [{ _id: creator, _creationTime: 1, clerkId: "creator", email: "private@example.test", nickname: "Creator" }, { _id: partner, _creationTime: 1, clerkId: "partner", email: "private@example.test", nickname: "Partner" }];
  const themes = [theme("own", creator), theme("theirs", partner), theme("unrelated", "stranger" as Id<"users">)];
  const snapshots: Doc<"weeklyGoalThemeSnapshots">[] = [];
  const ctx = { db: {
    query: (table: "weeklyGoals" | "themes" | "users" | "weeklyGoalThemeSnapshots") => {
      switch (table) {
        case "weeklyGoals": return createIndexedQuery(goals);
        case "themes": return createIndexedQuery(themes);
        case "users": return createIndexedQuery(users);
        case "weeklyGoalThemeSnapshots": return createIndexedQuery(snapshots);
      }
    },
    get: async (id: string) => [...goals, ...users, ...themes].find(row => row._id === id) ?? null,
  } };
  return { ctx, goals, themes, snapshots };
}
describe("weekly goal viewer queries", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); });
  afterEach(() => vi.useRealTimers());
  it("combines creator and partner goals, omits completed/unrelated goals and orders by recency", async () => {
    const f = fixture([
      goal({ _id: "old" as Id<"weeklyGoals">, createdAt: now - 100 }),
      goal({ _id: "partner_view" as Id<"weeklyGoals">, creatorId: partner, partnerId: creator, status: "locked", lockedAt: now - 20, endDate: now + 1000 }),
      goal({ _id: "solo" as Id<"weeklyGoals">, mode: "solo", partnerId: undefined, partnerLocked: undefined, createdAt: now - 10 }),
      goal({ _id: "completed" as Id<"weeklyGoals">, status: "completed" }),
      goal({ _id: "effectively_complete" as Id<"weeklyGoals">, bigBossStatus: "defeated" }),
      goal({ _id: "unrelated" as Id<"weeklyGoals">, creatorId: "stranger" as Id<"users">, partnerId: partner }),
    ]);
    const list = await getVisibleGoalsForViewer(f.ctx as never, creator);
    expect(list.map(row => row.goal._id)).toEqual(["partner_view", "solo", "old"]);
    expect(list.map(row => row.viewerRole)).toEqual(["partner", "creator", "creator"]);
    expect(list[1].partner).toBeNull();
    expect(list[0].creator).toEqual({ _id: partner, nickname: "Partner", discriminator: undefined, name: undefined, imageUrl: undefined });
  });
  it.each([creator, partner])("projects a single visible goal for participant %s", async userId => {
    const f = fixture();
    const result = await getGoalForViewer(f.ctx as never, userId, goalId);
    expect(result).toMatchObject({ mode: "shared", viewerRole: userId === creator ? "creator" : "partner", goal: { _id: goalId } });
  });
  it.each(["missing", "outsider", "completed"])("hides a goal and boss preview for %s", async state => {
    const f = fixture(state === "missing" ? [] : [goal({ status: state === "completed" ? "completed" : "draft" })]);
    const userId = state === "outsider" ? "outsider" as Id<"users"> : creator;
    await expect(getGoalForViewer(f.ctx as never, userId, goalId)).resolves.toBeNull();
    await expect(getBossLaunchPreviewForViewer(f.ctx as never, userId, goalId, "mini")).resolves.toBeNull();
  });
  it("offers both participants' themes and excludes themes already in the goal", async () => {
    const f = fixture([goal({ themes: [{ themeId: "own" as Id<"themes">, themeName: "own", creatorCompleted: false, partnerCompleted: false }] })]);
    await expect(getEligibleThemesForViewer(f.ctx as never, partner, goalId)).resolves.toEqual([f.themes[1]]);
  });
  it("limits solo eligibility to the creator's themes", async () => {
    const f = fixture([goal({ mode: "solo", partnerId: undefined, partnerLocked: undefined })]);
    await expect(getEligibleThemesForViewer(f.ctx as never, creator, goalId)).resolves.toEqual([f.themes[0]]);
  });
  it.each(["missing", "outsider"])("offers no eligible themes to %s", async state => {
    const f = fixture(state === "missing" ? [] : [goal()]);
    await expect(getEligibleThemesForViewer(f.ctx as never, state === "outsider" ? "outsider" as Id<"users"> : creator, goalId)).resolves.toEqual([]);
  });
  it.each(["mini", "big"] as const)("builds %s preview from frozen content, even when live themes change", async bossType => {
    const f = fixture([goal({ status: "locked", lockedAt: now - 1000, endDate: now + 86_400_000, creatorLocked: true, partnerLocked: true, miniBossStatus: "ready", bigBossStatus: "ready", themes: [
      { themeId: "own" as Id<"themes">, themeName: "own", creatorCompleted: true, partnerCompleted: true },
      { themeId: "theirs" as Id<"themes">, themeName: "theirs", creatorCompleted: false, partnerCompleted: true },
    ] })]);
    for (const [index, id] of ["own", "theirs"].entries()) f.snapshots.push({ _id: `snapshot_${index}` as Id<"weeklyGoalThemeSnapshots">, _creationTime: 1, createdAt: now - 1000, lockedAt: now - 1000, weeklyGoalId: goalId, originalThemeId: id as Id<"themes">, order: index, name: id, description: "", contentType: "word", words: [{ word: "one", answer: "uno", wrongAnswers: ["dos"] }, { word: "two", answer: "dos", wrongAnswers: ["uno"] }] });
    const result = await getBossLaunchPreviewForViewer(f.ctx as never, partner, goalId, bossType);
    expect(result).toMatchObject({ mode: "shared", themeCount: bossType === "mini" ? 1 : 2, itemCount: bossType === "mini" ? 2 : 4, selectedBossStatus: bossType === "mini" ? "ready" : "unavailable" });
    expect(result?.livesTotal).toBeGreaterThan(0);
  });
});
