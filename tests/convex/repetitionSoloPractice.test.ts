import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { completeRepetitionSoloPracticeForCurrentUser, recordRepetitionSoloMasteryForCurrentUser } from "@/convex/weeklyGoalRepetitions/soloPractice";
import { createAuthCtx, createIndexedQuery, patchRow } from "./testUtils/inMemoryDb";
const now = 400_000_000;
const userId = "user" as Id<"users">;
const goalId = "goal" as Id<"weeklyGoals">;
const sessionId = "session" as Id<"soloPracticeSessions">;
function fixture(changes: Partial<Doc<"soloPracticeSessions">> = {}) {
  const goals: Doc<"weeklyGoals">[] = [{ _id: goalId, _creationTime: 1, createdAt: 1, completedAt: 1, creatorId: userId,
    mode: "solo", status: "completed", creatorLocked: true, themes: [], miniBossStatus: "defeated", bigBossStatus: "defeated" }];
  const sessions: Doc<"soloPracticeSessions">[] = [{ _id: sessionId, _creationTime: 1, createdAt: 1, weeklyGoalId: goalId,
    userId, sourceType: "spaced_repetition", spacedRepetitionStep: 1, themeIds: [], status: "practicing",
    sessionItems: [{ kind: "word", word: "cat", answer: "gato", wrongAnswers: ["perro"], themeId: "theme" as Id<"themes">, themeName: "Animals" }], ...changes }];
  const records: Doc<"weeklyGoalRepetitions">[] = [{ _id: "record" as Id<"weeklyGoalRepetitions">, _creationTime: 1, createdAt: 1,
    updatedAt: 1, weeklyGoalId: goalId, userId, completedSteps: [] }];
  const users = [{ _id: userId, clerkId: "clerk" }];
  const tables = { users, weeklyGoals: goals, soloPracticeSessions: sessions, weeklyGoalRepetitions: records };
  const patch = vi.fn(async (id: string, values: Record<string, unknown>) => {
    if (id === sessionId) patchRow(sessions, id, values); else patchRow(records, id, values);
  });
  const db = { get: async (id: string) => [...goals, ...sessions, ...records, ...users].find(row => row._id === id) ?? null,
    query: (table: keyof typeof tables) => createIndexedQuery<{ _id: string }>(tables[table]), patch };
  return { goals, sessions, records, patch, ctx: createAuthCtx(db, "clerk") };
}
beforeEach(() => { vi.spyOn(Date, "now").mockReturnValue(now); vi.spyOn(console, "warn").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());
const completion = { soloPracticeSessionId: sessionId, completedStep: 1 };

describe("repetition solo completion boundaries", () => {
  it.each(["missing", "other-owner", "other-source", "missing-step", "completed", "unmastered", "missing-goal", "active-goal"])("does not advance %s sessions", async scenario => {
    const db = fixture({ masteredItemIndices: [0] });
    if (scenario === "missing") db.sessions.length = 0;
    if (scenario === "other-owner") db.sessions[0].userId = "other" as Id<"users">;
    if (scenario === "other-source") db.sessions[0].sourceType = "weekly_goal";
    if (scenario === "missing-step") db.sessions[0].spacedRepetitionStep = undefined;
    if (scenario === "completed") db.sessions[0].status = "completed";
    if (scenario === "unmastered") db.sessions[0].masteredItemIndices = [];
    if (scenario === "missing-goal") db.goals.length = 0;
    if (scenario === "active-goal") db.goals[0].status = "locked";
    await expect(completeRepetitionSoloPracticeForCurrentUser(db.ctx as never, completion)).resolves.toEqual({ advanced: false });
    expect(db.patch).not.toHaveBeenCalled();
  });
  it.each([0, 2, 1.5, NaN])( "rejects mismatched or nonintegral completed steps: %s", async completedStep => {
    const db = fixture({ masteredItemIndices: [0] });
    await expect(completeRepetitionSoloPracticeForCurrentUser(db.ctx as never, { ...completion, completedStep })).resolves.toEqual({ advanced: false });
    expect(db.patch).not.toHaveBeenCalled();
  });
  it("requires mastery of every actual index rather than matching counts", async () => {
    const db = fixture({ masteredItemIndices: [99] });
    await expect(completeRepetitionSoloPracticeForCurrentUser(db.ctx as never, completion)).resolves.toEqual({ advanced: false });
    expect(db.patch).not.toHaveBeenCalled();
  });
  it("completes once and records authoritative progress", async () => {
    const db = fixture({ masteredItemIndices: [0] });
    await expect(completeRepetitionSoloPracticeForCurrentUser(db.ctx as never, completion)).resolves.toEqual({ advanced: true });
    expect(db.records[0].completedSteps).toEqual([{ completedAt: now, completedVia: "solo_practice", soloPracticeSessionId: sessionId, duelId: undefined }]);
    expect(db.sessions[0]).toMatchObject({ status: "completed", completedAt: now });
    await expect(completeRepetitionSoloPracticeForCurrentUser(db.ctx as never, completion)).resolves.toEqual({ advanced: false });
    expect(db.records[0].completedSteps).toHaveLength(1);
  });
  it("closes a valid finished session even when its repetition is not currently due", async () => {
    const db = fixture({ masteredItemIndices: [0] });
    db.goals[0].completedAt = now;
    await expect(completeRepetitionSoloPracticeForCurrentUser(db.ctx as never, completion)).resolves.toEqual({ advanced: false });
    expect(db.sessions[0].status).toBe("completed");
    expect(db.records[0].completedSteps).toEqual([]);
  });
});

describe("repetition mastery writes", () => {
  it.each(["missing", "other-owner", "other-source", "completed"])("rejects %s sessions before writing", async scenario => {
    const db = fixture();
    if (scenario === "missing") db.sessions.length = 0;
    if (scenario === "other-owner") db.sessions[0].userId = "other" as Id<"users">;
    if (scenario === "other-source") db.sessions[0].sourceType = "weekly_goal";
    if (scenario === "completed") db.sessions[0].status = "completed";
    await expect(recordRepetitionSoloMasteryForCurrentUser(db.ctx as never, { soloPracticeSessionId: sessionId, itemIndex: 0 })).rejects.toThrow("not active");
    expect(db.patch).not.toHaveBeenCalled();
  });
  it.each([-1, 1, 0.5, NaN])("rejects invalid item index %s", async itemIndex => {
    const db = fixture();
    await expect(recordRepetitionSoloMasteryForCurrentUser(db.ctx as never, { soloPracticeSessionId: sessionId, itemIndex })).rejects.toThrow("Invalid solo practice item index");
    expect(db.patch).not.toHaveBeenCalled();
  });
  it.each(["missing-goal", "active-goal", "missing-step"])("retains mastery without advancing when %s", async scenario => {
    const db = fixture();
    if (scenario === "missing-goal") db.goals.length = 0;
    if (scenario === "active-goal") db.goals[0].status = "locked";
    if (scenario === "missing-step") db.sessions[0].spacedRepetitionStep = undefined;
    await expect(recordRepetitionSoloMasteryForCurrentUser(db.ctx as never, { soloPracticeSessionId: sessionId, itemIndex: 0 })).resolves.toEqual({ masteredCount: 1, totalCount: 1 });
    expect(db.sessions[0]).toMatchObject({ status: "practicing", masteredItemIndices: [0], progressUpdatedAt: now });
    expect(db.records[0].completedSteps).toEqual([]);
  });
  it("sorts and deduplicates out-of-order mastery before completing the session", async () => {
    const db = fixture();
    const item = db.sessions[0].sessionItems[0];
    db.sessions[0].sessionItems.push(item, item);
    for (const itemIndex of [2, 2, 0]) await recordRepetitionSoloMasteryForCurrentUser(db.ctx as never, { soloPracticeSessionId: sessionId, itemIndex });
    expect(db.sessions[0].masteredItemIndices).toEqual([0, 2]);
    expect(db.sessions[0].status).toBe("practicing");
    await expect(recordRepetitionSoloMasteryForCurrentUser(db.ctx as never, { soloPracticeSessionId: sessionId, itemIndex: 1 })).resolves.toEqual({ masteredCount: 3, totalCount: 3 });
    expect(db.sessions[0].masteredItemIndices).toEqual([0, 1, 2]);
    expect(db.sessions[0].status).toBe("completed");
    expect(db.records[0].completedSteps).toHaveLength(1);
  });
});
