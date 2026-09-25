import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { QueryCtx } from "@/convex/_generated/server";
import { loadLaunchPreviewForUser, loadRepetitionBoardForUser } from "@/convex/weeklyGoalRepetitions/board";
import { createIndexedQuery } from "./testUtils/inMemoryDb";
import { DAY_MS } from "@/lib/spacedRepetition";
const userId = "user" as Id<"users">;
const partnerId = "partner" as Id<"users">;
const now = 100 * DAY_MS;
function goal(id: string, changes: Partial<Doc<"weeklyGoals">> = {}): Doc<"weeklyGoals"> {
  return { _id: id as Id<"weeklyGoals">, _creationTime: 1, createdAt: 1, creatorId: userId, mode: "solo", status: "completed", completedAt: now - 4 * DAY_MS,
    creatorLocked: true, miniBossStatus: "defeated", bigBossStatus: "defeated", themes: [{ themeId: "theme" as Id<"themes">, themeName: "Words", creatorCompleted: true }], ...changes };
}
function repetition(g: Doc<"weeklyGoals">, changes: Partial<Doc<"weeklyGoalRepetitions">> = {}): Doc<"weeklyGoalRepetitions"> {
  return { _id: `rep-${g._id}` as Id<"weeklyGoalRepetitions">, _creationTime: 1, weeklyGoalId: g._id, userId, createdAt: 1, updatedAt: 1, completedSteps: [], ...changes };
}
function snapshot(g: Doc<"weeklyGoals">): Doc<"weeklyGoalThemeSnapshots"> {
  return { _id: `snapshot-${g._id}` as Id<"weeklyGoalThemeSnapshots">, _creationTime: 1, weeklyGoalId: g._id,
    originalThemeId: "theme" as Id<"themes">, name: "Saved words", description: "", order: 0, lockedAt: 1, createdAt: 1, contentType: "word",
    words: [{ word: "cat", answer: "gato", wrongAnswers: ["perro"] }] };
}
function database(goals: Doc<"weeklyGoals">[], records = goals.map(g => repetition(g)), snapshots = goals.map(snapshot), hasPartner = true) {
  const users = hasPartner ? [{ _id: partnerId, name: "Partner" }] : [];
  const tables = { weeklyGoals: goals, weeklyGoalRepetitions: records, weeklyGoalThemeSnapshots: snapshots, users };
  const query = vi.fn((table: keyof typeof tables) => createIndexedQuery<{ _id: string }>(tables[table]));
  const get = vi.fn(async (id: string) => [...goals, ...records, ...snapshots, ...users].find(row => row._id === id) ?? null);
  return { ctx: { db: { query, get } } as unknown as QueryCtx, query, get };
}
beforeEach(() => vi.spyOn(Date, "now").mockReturnValue(now));
afterEach(() => vi.restoreAllMocks());

describe("repetition board loading", () => {
  it("returns an empty board without completed goals", async () => {
    const db = database([goal("draft", { status: "draft" })]);
    expect(await loadRepetitionBoardForUser(db.ctx, userId)).toEqual({ stats: { total: 0, ready: 0, comingUp: 0, done: 0 }, all: [], ready: [], comingUp: [], done: [] });
  });
  it("groups and sorts due dates and finished updates while omitting untracked or incomplete goals", async () => {
    const goals = [goal("ready-late"), goal("ready-early", { completedAt: now - 5 * DAY_MS }),
      goal("future-late", { completedAt: now }), goal("future-early", { completedAt: now - DAY_MS }),
      goal("done-old"), goal("done-new"), goal("missing-record"), goal("missing-date", { completedAt: undefined }),
      goal("outsider", { creatorId: partnerId })];
    const records = goals.filter(g => g._id !== "missing-record").map(g => repetition(g, String(g._id).startsWith("done") ? {
      updatedAt: g._id === "done-new" ? 20 : 10,
      completedSteps: Array.from({ length: 6 }, (_, i) => ({ completedAt: i + 1, completedVia: "duel" as const })),
    } : {}));
    const db = database(goals, records);
    const board = await loadRepetitionBoardForUser(db.ctx, userId);
    expect(board.stats).toEqual({ total: 6, ready: 2, comingUp: 2, done: 2 });
    expect(board.all.map(item => item.weeklyGoalId)).toEqual(["ready-early", "ready-late", "future-early", "future-late", "done-new", "done-old"]);
    expect(board.ready.every(item => item.canStart && item.contentAvailable)).toBe(true);
    expect(board.comingUp.every(item => !item.canStart)).toBe(true);
    expect(db.query.mock.calls.filter(([table]) => table === "weeklyGoalThemeSnapshots")).toHaveLength(2);
  });
  it("includes partner goals and surfaces missing snapshots without loading live content", async () => {
    const current = goal("shared", { mode: "shared", creatorId: partnerId, partnerId: userId, partnerLocked: true });
    const db = database([current], [repetition(current)], []);
    const board = await loadRepetitionBoardForUser(db.ctx, userId);
    expect(board.ready[0]).toMatchObject({ canStart: false, contentAvailable: false, duelAvailable: true, partner: { _id: partnerId, name: "Partner" } });
    expect(board.ready[0].unavailableReason).toContain("snapshot is missing");
    expect(db.query.mock.calls.some(([table]) => String(table) === "themes")).toBe(false);
  });
});

describe("repetition launch previews", () => {
  it.each(["missing", "not-completed", "no-date", "outsider", "no-record"])("rejects %s previews", async scenario => {
    const current = goal("goal", scenario === "not-completed" ? { status: "draft" } : scenario === "no-date" ? { completedAt: undefined } : scenario === "outsider" ? { creatorId: partnerId } : {});
    const db = database(scenario === "missing" ? [] : [current], scenario === "no-record" ? [] : [repetition(current)]);
    expect(await loadLaunchPreviewForUser(db.ctx, userId, current._id)).toBeNull();
    expect(db.query.mock.calls.some(([table]) => table === "weeklyGoalThemeSnapshots")).toBe(false);
  });
  it.each([true, false])("reports shared partner availability %s and loads saved item counts", async hasPartner => {
    const current = goal("shared", { mode: "shared", partnerId, partnerLocked: true });
    const db = database([current], undefined, undefined, hasPartner);
    expect(await loadLaunchPreviewForUser(db.ctx, userId, current._id)).toMatchObject({ bucket: "ready", itemCount: 1, themeSummary: "Saved words", livesTotal: 2, duelAvailable: hasPartner, canStart: true });
  });
  it("uses a deferred summary for a future solo session", async () => {
    const current = goal("future", { completedAt: now }); const db = database([current]);
    expect(await loadLaunchPreviewForUser(db.ctx, userId, current._id)).toMatchObject({ bucket: "coming_up", itemCount: 0, themeSummary: "", duelAvailable: false, canStart: false });
    expect(db.query.mock.calls.some(([table]) => table === "weeklyGoalThemeSnapshots")).toBe(false);
  });
  it("reports snapshot failure without inventing a theme summary", async () => {
    const current = goal("broken"); const db = database([current], undefined, []);
    expect(await loadLaunchPreviewForUser(db.ctx, userId, current._id)).toMatchObject({ contentAvailable: false, themeSummary: "", itemCount: 0, canStart: false });
  });
});
