import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  loadWeeklyGoalSessionThemesByThemeIds,
} from "@/convex/helpers/weeklyGoalSnapshots";
import { createIndexedQuery } from "./testUtils/inMemoryDb";

type WordThemeBranch = Extract<Doc<"themes">, { contentType: "word" }>;
type WordSnapshotBranch = Extract<
  Doc<"weeklyGoalThemeSnapshots">,
  { contentType: "word" }
>;
type ThemeDoc = Pick<WordThemeBranch, "_id" | "name" | "words">;
type GoalDoc = Pick<Doc<"weeklyGoals">, "_id" | "status">;
type SnapshotDoc = Pick<
  WordSnapshotBranch,
  | "_id"
  | "_creationTime"
  | "weeklyGoalId"
  | "originalThemeId"
  | "order"
  | "name"
  | "description"
  | "wordType"
  | "words"
  | "lockedAt"
  | "createdAt"
>;

class InMemoryDb {
  constructor(
    public themes: ThemeDoc[] = [],
    public weeklyGoalThemeSnapshots: SnapshotDoc[] = []
  ) {}

  query(_table: "weeklyGoalThemeSnapshots") {
    return createIndexedQuery(this.weeklyGoalThemeSnapshots);
  }

  async get(id: Id<"themes">) {
    return this.themes.find((theme) => theme._id === id) ?? null;
  }
}

function themeDoc(id: string, name: string): ThemeDoc {
  return {
    _id: id as Id<"themes">,
    name,
    words: [{ word: name, answer: `${name} answer`, wrongAnswers: ["a", "b", "c"] }],
  };
}

function snapshotDoc(id: string, themeId: string, order: number): SnapshotDoc {
  return {
    _id: id as Id<"weeklyGoalThemeSnapshots">,
    _creationTime: 1,
    weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
    originalThemeId: themeId as Id<"themes">,
    order,
    name: `Snapshot ${themeId}`,
    description: "Snapshot words",
    wordType: "nouns",
    words: [{ word: themeId, answer: `${themeId} answer`, wrongAnswers: ["a", "b", "c"] }],
    lockedAt: 1,
    createdAt: 1,
  };
}

describe("weekly goal snapshot session loading", () => {
  it("uses live themes while the goal is still draft", async () => {
    const db = new InMemoryDb([themeDoc("theme_1", "Live Theme")]);
    const goal: GoalDoc = {
      _id: "goal_1" as Id<"weeklyGoals">,
      status: "draft",
    };

    const themes = await loadWeeklyGoalSessionThemesByThemeIds(
      { db } as never,
      goal,
      ["theme_1" as Id<"themes">]
    );

    expect(themes).toMatchObject([{ name: "Live Theme" }]);
  });

  it("throws instead of falling back to live themes after lock when a snapshot is missing", async () => {
    const db = new InMemoryDb(
      [themeDoc("theme_1", "Live Theme 1"), themeDoc("theme_2", "Live Theme 2")],
      [snapshotDoc("snapshot_1", "theme_1", 0)]
    );
    const goal: GoalDoc = {
      _id: "goal_1" as Id<"weeklyGoals">,
      status: "locked",
    };

    await expect(
      loadWeeklyGoalSessionThemesByThemeIds(
        { db } as never,
        goal,
        ["theme_1" as Id<"themes">, "theme_2" as Id<"themes">]
      )
    ).rejects.toThrow("Weekly goal snapshot is missing for a locked goal");
  });
});
