import { describe, expect, it } from "vitest";
import { getWeeklyGoalPracticeThemes } from "@/convex/weeklyGoals";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";

type UserDoc = Doc<"users">;
type ThemeDoc = Doc<"themes">;
type WeeklyGoalDoc = Doc<"weeklyGoals">;
type SnapshotDoc = Doc<"weeklyGoalThemeSnapshots">;

class InMemoryDb {
  constructor(
    public users: UserDoc[],
    public themes: ThemeDoc[],
    public weeklyGoals: WeeklyGoalDoc[],
    public weeklyGoalThemeSnapshots: SnapshotDoc[] = []
  ) {}

  query(table: "users" | "themes" | "weeklyGoals" | "weeklyGoalThemeSnapshots") {
    switch (table) {
      case "users":
        return createIndexedQuery(this.users);
      case "themes":
        return createIndexedQuery(this.themes);
      case "weeklyGoals":
        return createIndexedQuery(this.weeklyGoals);
      case "weeklyGoalThemeSnapshots":
        return createIndexedQuery(this.weeklyGoalThemeSnapshots);
    }
  }

  async get(id: Id<"users"> | Id<"themes"> | Id<"weeklyGoals"> | Id<"weeklyGoalThemeSnapshots">) {
    return (
      this.users.find((row) => row._id === id) ??
      this.themes.find((row) => row._id === id) ??
      this.weeklyGoals.find((row) => row._id === id) ??
      this.weeklyGoalThemeSnapshots.find((row) => row._id === id) ??
      null
    );
  }
}

function buildUser(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_creator" as Id<"users">,
    _creationTime: 1,
    clerkId: "creator",
    email: "creator@example.com",
    ...overrides,
  };
}

function buildTheme(overrides: Partial<ThemeDoc> = {}): ThemeDoc {
  return {
    _id: "theme_1" as Id<"themes">,
    _creationTime: 1,
    name: "Live Theme 1",
    description: "Live theme",
    wordType: "nouns",
    words: [{ word: "cat", answer: "kocka", wrongAnswers: ["pes", "dum", "les"] }],
    createdAt: 1,
    ownerId: "user_creator" as Id<"users">,
    ...overrides,
  };
}

function buildGoal(overrides: Partial<WeeklyGoalDoc> = {}): WeeklyGoalDoc {
  return {
    _id: "goal_1" as Id<"weeklyGoals">,
    _creationTime: 1,
    creatorId: "user_creator" as Id<"users">,
    partnerId: "user_partner" as Id<"users">,
    themes: [
      {
        themeId: "theme_1" as Id<"themes">,
        themeName: "Theme 1",
        creatorCompleted: false,
        partnerCompleted: false,
      },
      {
        themeId: "theme_2" as Id<"themes">,
        themeName: "Theme 2",
        creatorCompleted: false,
        partnerCompleted: false,
      },
    ],
    creatorLocked: false,
    partnerLocked: false,
    miniBossStatus: "unavailable",
    bossStatus: "unavailable",
    status: "draft",
    createdAt: 1,
    endDate: Date.now() + 100_000,
    lockedAt: undefined,
    ...overrides,
  };
}

function buildSnapshot(overrides: Partial<SnapshotDoc> = {}): SnapshotDoc {
  return {
    _id: "snapshot_1" as Id<"weeklyGoalThemeSnapshots">,
    _creationTime: 1,
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    originalThemeId: "theme_1" as Id<"themes">,
    order: 0,
    name: "Snapshot Theme 1",
    description: "Snapshot theme",
    wordType: "nouns",
    words: [{ word: "snapshot-cat", answer: "snapshot-kocka", wrongAnswers: ["pes", "dum", "les"] }],
    lockedAt: 2,
    createdAt: 2,
    ...overrides,
  };
}

const handler = (getWeeklyGoalPracticeThemes as unknown as {
  _handler: (
    ctx: unknown,
    args: { weeklyGoalId: Id<"weeklyGoals">; themeIds?: Id<"themes">[] }
  ) => Promise<unknown>;
})._handler;

function createDb(goal: WeeklyGoalDoc, snapshots: SnapshotDoc[] = []) {
  return new InMemoryDb(
    [
      buildUser(),
      buildUser({
        _id: "user_partner" as Id<"users">,
        clerkId: "partner",
        email: "partner@example.com",
      }),
      buildUser({
        _id: "user_outsider" as Id<"users">,
        clerkId: "outsider",
        email: "outsider@example.com",
      }),
    ],
    [
      buildTheme(),
      buildTheme({
        _id: "theme_2" as Id<"themes">,
        name: "Live Theme 2",
        words: [{ word: "dog", answer: "pes", wrongAnswers: ["cat", "dum", "les"] }],
      }),
    ],
    [goal],
    snapshots
  );
}

describe("getWeeklyGoalPracticeThemes", () => {
  it("loads live originals before full lock and allows partner access", async () => {
    const db = createDb(buildGoal({ creatorLocked: true }));

    const result = await handler(
      createAuthCtx(db, "partner") as never,
      { weeklyGoalId: "goal_1" as Id<"weeklyGoals"> }
    );

    expect(result).toMatchObject({
      ok: true,
      source: "live",
      themes: [{ name: "Live Theme 1" }, { name: "Live Theme 2" }],
    });
  });

  it("loads snapshots after lock and never falls back to live originals", async () => {
    const db = createDb(
      buildGoal({ status: "locked", creatorLocked: true, partnerLocked: true, lockedAt: 2 }),
      [buildSnapshot()]
    );

    const result = await handler(
      createAuthCtx(db, "creator") as never,
      { weeklyGoalId: "goal_1" as Id<"weeklyGoals"> }
    );

    expect(result).toMatchObject({
      ok: false,
      message: "\"Theme 2\" snapshot is no longer available. Practice cannot start from the live theme after lock.",
    });
  });

  it("returns selected snapshot themes in goal order after lock", async () => {
    const db = createDb(
      buildGoal({ status: "locked", creatorLocked: true, partnerLocked: true, lockedAt: 2 }),
      [
        buildSnapshot(),
        buildSnapshot({
          _id: "snapshot_2" as Id<"weeklyGoalThemeSnapshots">,
          originalThemeId: "theme_2" as Id<"themes">,
          order: 1,
          name: "Snapshot Theme 2",
        }),
      ]
    );

    const result = await handler(
      createAuthCtx(db, "creator") as never,
      {
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        themeIds: ["theme_2" as Id<"themes">, "theme_1" as Id<"themes">],
      }
    );

    expect(result).toMatchObject({
      ok: true,
      source: "snapshot",
      themes: [{ name: "Snapshot Theme 1" }, { name: "Snapshot Theme 2" }],
    });
  });

  it("rejects invalid selected ids and unauthorised users cleanly", async () => {
    const db = createDb(buildGoal());

    await expect(
      handler(createAuthCtx(db, "creator") as never, {
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        themeIds: ["theme_missing" as Id<"themes">],
      })
    ).resolves.toMatchObject({
      ok: false,
      message: "One selected theme is not part of this weekly goal.",
    });

    await expect(
      handler(createAuthCtx(db, "outsider") as never, {
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
      })
    ).resolves.toBeNull();
  });
});
