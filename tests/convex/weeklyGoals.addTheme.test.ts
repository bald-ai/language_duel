import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { addTheme } from "@/convex/weeklyGoals";
import { createAuthCtx, createIndexedQuery, patchRow } from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "name" | "imageUrl"
>;

type ThemeDoc = Pick<
  Doc<"themes">,
  "_id" | "_creationTime" | "name" | "description" | "createdAt" | "ownerId" | "words"
>;

type WeeklyGoalDoc = Pick<
  Doc<"weeklyGoals">,
  | "_id"
  | "_creationTime"
  | "creatorId"
  | "partnerId"
  | "themes"
  | "creatorLocked"
  | "partnerLocked"
  | "status"
  | "createdAt"
>;

class InMemoryDb {
  constructor(
    public users: UserDoc[],
    public themes: ThemeDoc[],
    public weeklyGoals: WeeklyGoalDoc[]
  ) {}

  query(table: "users" | "themes" | "weeklyGoals") {
    switch (table) {
      case "users":
        return createIndexedQuery(this.users);
      case "themes":
        return createIndexedQuery(this.themes);
      case "weeklyGoals":
        return createIndexedQuery(this.weeklyGoals);
    }
  }

  async get(id: string) {
    return (
      this.users.find((row) => row._id === id) ??
      this.themes.find((row) => row._id === id) ??
      this.weeklyGoals.find((row) => row._id === id) ??
      null
    );
  }

  async patch(id: string, value: Record<string, unknown>) {
    patchRow(this.weeklyGoals, id, value);
  }
}

function buildUser(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "user@example.com",
    name: "User",
    imageUrl: "https://example.com/user.png",
    ...overrides,
  };
}

function buildTheme(themeNumber: number, ownerId: Id<"users">): ThemeDoc {
  return {
    _id: `theme_${themeNumber}` as Id<"themes">,
    _creationTime: themeNumber,
    name: `Theme ${themeNumber}`,
    description: `Description ${themeNumber}`,
    createdAt: themeNumber,
    ownerId,
    words: [
      {
        word: `word-${themeNumber}`,
        answer: `answer-${themeNumber}`,
        wrongAnswers: [`wrong-${themeNumber}-1`, `wrong-${themeNumber}-2`, `wrong-${themeNumber}-3`],
      },
    ],
  };
}

function buildGoal(themeCount: number): WeeklyGoalDoc {
  return {
    _id: "goal_1" as Id<"weeklyGoals">,
    _creationTime: 1,
    creatorId: "user_1" as Id<"users">,
    partnerId: "user_2" as Id<"users">,
    themes: Array.from({ length: themeCount }, (_, index) => ({
      themeId: `theme_${index + 1}` as Id<"themes">,
      themeName: `Theme ${index + 1}`,
      creatorCompleted: false,
      partnerCompleted: false,
    })),
    creatorLocked: false,
    partnerLocked: false,
    status: "editing",
    createdAt: 1,
  };
}

const addThemeHandler = (addTheme as unknown as {
  _handler: (
    ctx: unknown,
    args: { goalId: Id<"weeklyGoals">; themeId: Id<"themes"> }
  ) => Promise<void>;
})._handler;

describe("weeklyGoals addTheme", () => {
  it("allows adding a tenth theme to a goal", async () => {
    const db = new InMemoryDb(
      [
        buildUser(),
        buildUser({
          _id: "user_2" as Id<"users">,
          clerkId: "clerk_2",
          email: "partner@example.com",
          name: "Partner",
        }),
      ],
      Array.from({ length: 10 }, (_, index) =>
        buildTheme(index + 1, ((index + 1) % 2 === 0 ? "user_2" : "user_1") as Id<"users">)
      ),
      [buildGoal(9)]
    );

    await addThemeHandler(createAuthCtx(db, "clerk_1") as never, {
      goalId: "goal_1" as Id<"weeklyGoals">,
      themeId: "theme_10" as Id<"themes">,
    });

    expect(db.weeklyGoals[0].themes).toHaveLength(10);
    expect(db.weeklyGoals[0].themes.at(-1)).toMatchObject({
      themeId: "theme_10",
      themeName: "Theme 10",
    });
  });

  it("blocks adding an eleventh theme to a goal", async () => {
    const db = new InMemoryDb(
      [
        buildUser(),
        buildUser({
          _id: "user_2" as Id<"users">,
          clerkId: "clerk_2",
          email: "partner@example.com",
          name: "Partner",
        }),
      ],
      Array.from({ length: 11 }, (_, index) =>
        buildTheme(index + 1, ((index + 1) % 2 === 0 ? "user_2" : "user_1") as Id<"users">)
      ),
      [buildGoal(10)]
    );

    await expect(
      addThemeHandler(createAuthCtx(db, "clerk_1") as never, {
        goalId: "goal_1" as Id<"weeklyGoals">,
        themeId: "theme_11" as Id<"themes">,
      })
    ).rejects.toThrow("Maximum themes reached");
  });
});
