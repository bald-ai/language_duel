import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { advanceUserIfReady } from "@/convex/weeklyGoalRepetitions/attemptMutations";
import { buildBoardItem } from "@/convex/weeklyGoalRepetitions/readModel";
import { assertSnapshotContentReady, loadSpacedRepetitionSnapshotContent } from "@/convex/weeklyGoalRepetitions/contentLoading";
import { createIndexedQuery, patchRow } from "./testUtils/inMemoryDb";
const day = 86400000;
const creatorId = "creator" as Id<"users">;
const goalId = "goal" as Id<"weeklyGoals">;
const themeId = "theme" as Id<"themes">;
function goal(changes: Partial<Doc<"weeklyGoals">> = {}): Doc<"weeklyGoals"> {
  return { _id: goalId, _creationTime: 1, createdAt: 1, completedAt: 1000, mode: "solo", creatorId,
    creatorLocked: true, miniBossStatus: "defeated", bigBossStatus: "defeated", status: "completed",
    themes: [{ themeId, themeName: "Animals", creatorCompleted: true }], ...changes };
}
function record(changes: Partial<Doc<"weeklyGoalRepetitions">> = {}): Doc<"weeklyGoalRepetitions"> {
  return { _id: "record" as Id<"weeklyGoalRepetitions">, _creationTime: 1, createdAt: 1000, updatedAt: 1000,
    weeklyGoalId: goalId, userId: creatorId, completedSteps: [], ...changes };
}
function database(records: Doc<"weeklyGoalRepetitions">[]) {
  return { query: () => createIndexedQuery(records), patch: vi.fn(async (id: string, values: Record<string, unknown>) => patchRow(records, id, values)) };
}
beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("persisted repetition advancement", () => {
  it("advances exactly at due time, preserves history, and rejects stale repeated completion", async () => {
    const records = [record({ completedSteps: [{ completedAt: 5000, completedVia: "solo_practice" }] })];
    const db = database(records);
    const args = { ctx: { db } as never, goal: goal(), userId: creatorId, completedVia: "duel" as const,
      duelId: "duel" as Id<"duels">, expectedStep: 2, now: 5000 + 7 * day };
    await expect(advanceUserIfReady({ ...args, now: args.now - 1 })).resolves.toBe(false);
    expect(db.patch).not.toHaveBeenCalled();
    await expect(advanceUserIfReady(args)).resolves.toBe(true);
    expect(records[0].completedSteps).toEqual([
      { completedAt: 5000, completedVia: "solo_practice" },
      { completedAt: 5000 + 7 * day, completedVia: "duel", duelId: "duel", soloPracticeSessionId: undefined },
    ]);
    expect(records[0].updatedAt).toBe(args.now);
    await expect(advanceUserIfReady({ ...args, now: args.now + 20 * day })).resolves.toBe(false);
    expect(db.patch).toHaveBeenCalledTimes(1);
  });
  it.each(["missing-record", "finished", "missing-completion", "future", "wrong-step"])("does not persist an invalid advance: %s", async scenario => {
    const records = scenario === "missing-record" ? [] : [record(scenario === "finished" ? {
      completedSteps: Array.from({ length: 6 }, (_, index) => ({ completedAt: index + 1, completedVia: "duel" as const })),
    } : {})];
    const db = database(records);
    const before = structuredClone(records);
    const args = { ctx: { db } as never, goal: goal(scenario === "missing-completion" ? { completedAt: undefined } : {}),
      userId: creatorId, completedVia: "solo_practice" as const, now: scenario === "future" ? 1000 + 3 * day - 1 : 1000 + 3 * day,
      expectedStep: scenario === "wrong-step" ? 2 : 1 };
    await expect(advanceUserIfReady(args)).resolves.toBe(false);
    expect(db.patch).not.toHaveBeenCalled();
    expect(records).toEqual(before);
  });
  it("advances the current step when no expected step is supplied", async () => {
    const records = [record()];
    const db = database(records);
    await expect(advanceUserIfReady({ ctx: { db } as never, goal: goal(), userId: creatorId, now: 1000 + 3 * day,
      completedVia: "solo_practice", soloPracticeSessionId: "solo" as Id<"soloPracticeSessions"> })).resolves.toBe(true);
    expect(records[0].completedSteps[0]).toEqual({ completedAt: 1000 + 3 * day, completedVia: "solo_practice", soloPracticeSessionId: "solo", duelId: undefined });
  });
});

describe("repetition board availability", () => {
  const content = { ok: true as const, itemCount: 2, themeCount: 1, themeSummary: "Animals", sessionItems: [] };
  it.each([[3 * day + 999, "coming_up", false, 1], [3 * day + 1000, "ready", true, 0]] as const)("respects due boundary %i", (now, bucket, canStart, daysRemaining) => {
    const view = buildBoardItem({ goal: goal(), record: record(), partner: null, content, now });
    expect(view).toMatchObject({ bucket, canStart, daysRemaining, dueAt: 1000 + 3 * day, step: 1, totalSteps: 6,
      themeNames: ["Animals"], itemCount: 2, contentAvailable: true, duelAvailable: false });
  });
  it("blocks launch when snapshot content is unavailable", () => {
    expect(buildBoardItem({ goal: goal({ mode: "shared" }), record: record(), partner: { _id: creatorId },
      content: { ok: false, message: "Snapshot missing" }, now: 1000 + 3 * day })).toMatchObject({
      bucket: "ready", canStart: false, contentAvailable: false, unavailableReason: "Snapshot missing", itemCount: 0, duelAvailable: true,
    });
  });
  it("marks all six steps done and never reopens the schedule", () => {
    expect(buildBoardItem({ goal: goal({ mode: "shared" }), record: record({
      completedSteps: Array.from({ length: 6 }, (_, i) => ({ completedAt: i, completedVia: "duel" })),
    }), partner: null, content, now: 999999999999 })).toMatchObject({ bucket: "done", step: null, dueAt: null,
      daysRemaining: 0, canStart: false, duelAvailable: false });
  });
  it("rejects a completed goal without its completion timestamp", () => {
    expect(() => buildBoardItem({ goal: goal({ completedAt: undefined }), record: record(), partner: null, content, now: 1 })).toThrow("missing completion time");
  });
});

function snapshot(): Doc<"weeklyGoalThemeSnapshots"> {
  return { _id: "snapshot" as Id<"weeklyGoalThemeSnapshots">, _creationTime: 1, weeklyGoalId: goalId, originalThemeId: themeId,
    name: "Snapshot Animals", description: "", order: 0, lockedAt: 1, createdAt: 1, contentType: "word",
    words: [{ word: "cat", answer: "gato", wrongAnswers: ["perro", "pez", "ave"] }] };
}
describe("repetition snapshot integrity", () => {
  it.each(["missing", "empty-word", "empty-sentence", "no-themes"])("rejects unusable snapshots consistently: %s", async scenario => {
    const original = snapshot();
    const snapshots = scenario === "missing" ? [] : [scenario === "empty-sentence"
      ? { ...original, contentType: "sentence", words: undefined, sentenceRounds: [] }
      : { ...original, words: [] }];
    const ctx = { db: { query: () => createIndexedQuery(snapshots) } } as never;
    const current = goal(scenario === "no-themes" ? { themes: [] } : {});
    const probe = await assertSnapshotContentReady(ctx, current);
    const loaded = await loadSpacedRepetitionSnapshotContent(ctx, current);
    expect(loaded).toEqual(probe);
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) expect(loaded.message).toMatch(/snapshot|no items/);
  });
  it("builds the session from the locked snapshot and not live themes", async () => {
    const query = vi.fn(() => createIndexedQuery([snapshot()]));
    const ctx = { db: { query } } as never;
    expect(await assertSnapshotContentReady(ctx, goal())).toEqual({ ok: true });
    const result = await loadSpacedRepetitionSnapshotContent(ctx, goal());
    expect(result).toMatchObject({ ok: true, itemCount: 1, themeCount: 1,
      sessionItems: [{ kind: "word", word: "cat", answer: "gato", themeName: "Snapshot Animals", themeId }] });
    expect(query.mock.calls).toEqual([["weeklyGoalThemeSnapshots"], ["weeklyGoalThemeSnapshots"]]);
  });
});
