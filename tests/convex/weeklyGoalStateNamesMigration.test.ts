import { describe, expect, it } from "vitest";
import {
  mapWeeklyGoalBossStatusName,
  mapWeeklyGoalLifecycleStatusName,
  migrateWeeklyGoalStateNames,
  verifyWeeklyGoalStateNames,
} from "@/convex/migrations";
import { createIndexedQuery, patchRow } from "./testUtils/inMemoryDb";

type WeeklyGoalRow = {
  _id: string;
  _creationTime: number;
  status: string;
  miniBossStatus: string;
  bossStatus: string;
};

class InMemoryDb {
  constructor(public weeklyGoals: WeeklyGoalRow[]) {}

  query(table: "weeklyGoals") {
    if (table !== "weeklyGoals") {
      throw new Error(`Unexpected table: ${table}`);
    }

    return createIndexedQuery(this.weeklyGoals);
  }

  async patch(id: string, value: Record<string, unknown>) {
    patchRow(this.weeklyGoals, id, value);
  }
}

const migrateHandler = (migrateWeeklyGoalStateNames as unknown as {
  _handler: (ctx: { db: InMemoryDb }, args: Record<string, never>) => Promise<{
    checkedGoals: number;
    updatedGoals: number;
    updatedLifecycleStatuses: number;
    updatedMiniBossStatuses: number;
    updatedBossStatuses: number;
  }>;
})._handler;

const verifyHandler = (verifyWeeklyGoalStateNames as unknown as {
  _handler: (ctx: { db: InMemoryDb }, args: Record<string, never>) => Promise<{
    checkedGoals: number;
    oldLifecycleCount: number;
    oldBossCount: number;
    lifecycleFieldWithBossValueCount: number;
    bossFieldWithLifecycleValueCount: number;
    invalidLifecycleCount: number;
    invalidBossCount: number;
    sampleIds: Record<string, string[]>;
    ok: boolean;
  }>;
})._handler;

function goalRow(overrides: Partial<WeeklyGoalRow>): WeeklyGoalRow {
  return {
    _id: "goal_1",
    _creationTime: 1,
    status: "draft",
    miniBossStatus: "unavailable",
    bossStatus: "unavailable",
    ...overrides,
  };
}

describe("weekly goal state-name migration", () => {
  it("maps lifecycle statuses to the new vocabulary", () => {
    expect(mapWeeklyGoalLifecycleStatusName("editing")).toBe("draft");
    expect(mapWeeklyGoalLifecycleStatusName("active")).toBe("locked");
    expect(mapWeeklyGoalLifecycleStatusName("expired")).toBe("grace_period");
    expect(mapWeeklyGoalLifecycleStatusName("completed")).toBe("completed");
  });

  it("maps boss statuses to the new vocabulary, including the completed collision", () => {
    expect(mapWeeklyGoalBossStatusName("locked")).toBe("unavailable");
    expect(mapWeeklyGoalBossStatusName("available")).toBe("ready");
    expect(mapWeeklyGoalBossStatusName("completed")).toBe("defeated");
  });

  it("migrates weekly goal rows field by field", async () => {
    const db = new InMemoryDb([
      goalRow({
        _id: "goal_draft",
        status: "editing",
        miniBossStatus: "locked",
        bossStatus: "available",
      }),
      goalRow({
        _id: "goal_locked",
        status: "active",
        miniBossStatus: "available",
        bossStatus: "locked",
      }),
      goalRow({
        _id: "goal_grace",
        status: "expired",
        miniBossStatus: "completed",
        bossStatus: "completed",
      }),
      goalRow({
        _id: "goal_completed",
        status: "completed",
        miniBossStatus: "completed",
        bossStatus: "completed",
      }),
    ]);

    await expect(migrateHandler({ db }, {})).resolves.toEqual({
      checkedGoals: 4,
      updatedGoals: 4,
      updatedLifecycleStatuses: 3,
      updatedMiniBossStatuses: 4,
      updatedBossStatuses: 4,
    });

    expect(db.weeklyGoals).toEqual([
      expect.objectContaining({
        _id: "goal_draft",
        status: "draft",
        miniBossStatus: "unavailable",
        bossStatus: "ready",
      }),
      expect.objectContaining({
        _id: "goal_locked",
        status: "locked",
        miniBossStatus: "ready",
        bossStatus: "unavailable",
      }),
      expect.objectContaining({
        _id: "goal_grace",
        status: "grace_period",
        miniBossStatus: "defeated",
        bossStatus: "defeated",
      }),
      expect.objectContaining({
        _id: "goal_completed",
        status: "completed",
        miniBossStatus: "defeated",
        bossStatus: "defeated",
      }),
    ]);
  });

  it("verifies clean migrated rows", async () => {
    const db = new InMemoryDb([
      goalRow({ _id: "goal_draft", status: "draft" }),
      goalRow({ _id: "goal_locked", status: "locked", miniBossStatus: "ready" }),
      goalRow({ _id: "goal_grace", status: "grace_period", bossStatus: "ready" }),
      goalRow({ _id: "goal_completed", status: "completed", bossStatus: "defeated" }),
    ]);

    await expect(verifyHandler({ db }, {})).resolves.toMatchObject({
      checkedGoals: 4,
      oldLifecycleCount: 0,
      oldBossCount: 0,
      lifecycleFieldWithBossValueCount: 0,
      bossFieldWithLifecycleValueCount: 0,
      invalidLifecycleCount: 0,
      invalidBossCount: 0,
      ok: true,
    });
  });

  it("verifies leftover old values and cross-field wrong values", async () => {
    const db = new InMemoryDb([
      goalRow({ _id: "old_lifecycle", status: "editing" }),
      goalRow({ _id: "old_boss", status: "locked", miniBossStatus: "available" }),
      goalRow({ _id: "boss_in_lifecycle", status: "ready" }),
      goalRow({
        _id: "lifecycle_in_boss",
        miniBossStatus: "draft",
        bossStatus: "grace_period",
      }),
      goalRow({ _id: "invalid_values", status: "paused", bossStatus: "paused" }),
    ]);

    const result = await verifyHandler({ db }, {});

    expect(result).toMatchObject({
      checkedGoals: 5,
      oldLifecycleCount: 1,
      oldBossCount: 1,
      lifecycleFieldWithBossValueCount: 1,
      bossFieldWithLifecycleValueCount: 1,
      invalidLifecycleCount: 2,
      invalidBossCount: 2,
      ok: false,
    });
    expect(result.sampleIds.oldLifecycle).toContain("old_lifecycle");
    expect(result.sampleIds.oldBoss).toContain("old_boss");
    expect(result.sampleIds.lifecycleFieldWithBossValue).toContain("boss_in_lifecycle");
    expect(result.sampleIds.bossFieldWithLifecycleValue).toContain("lifecycle_in_boss");
    expect(result.sampleIds.invalidLifecycle).toContain("boss_in_lifecycle");
    expect(result.sampleIds.invalidLifecycle).toContain("invalid_values");
    expect(result.sampleIds.invalidBoss).toContain("lifecycle_in_boss");
    expect(result.sampleIds.invalidBoss).toContain("invalid_values");
  });
});
