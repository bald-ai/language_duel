import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { toggleCompletion } from "@/convex/weeklyGoals";
import {
  createAuthCtx,
  createIndexedQuery,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email">;
type WeeklyGoalDoc = Pick<
  Doc<"weeklyGoals">,
  | "_id"
  | "_creationTime"
  | "mode"
  | "creatorId"
  | "partnerId"
  | "themes"
  | "creatorLocked"
  | "partnerLocked"
  | "status"
  | "createdAt"
  | "miniBossStatus"
  | "bigBossStatus"
  | "endDate"
  | "lockedAt"
>;

class InMemoryDb {
  constructor(
    public users: UserDoc[],
    public weeklyGoals: WeeklyGoalDoc[]
  ) {}

  query(table: "users" | "weeklyGoals") {
    return table === "users"
      ? createIndexedQuery(this.users)
      : createIndexedQuery(this.weeklyGoals);
  }

  async get(id: Id<"users"> | Id<"weeklyGoals">) {
    return (
      this.users.find((row) => row._id === id) ??
      this.weeklyGoals.find((row) => row._id === id) ??
      null
    );
  }

  async patch(id: Id<"weeklyGoals">, value: Record<string, unknown>) {
    patchRow(this.weeklyGoals, id, value);
  }
}

function userDoc(overrides: Partial<UserDoc>): UserDoc {
  return {
    _id: "user_creator" as Id<"users">,
    _creationTime: 1,
    clerkId: "creator",
    email: "creator@example.com",
    ...overrides,
  };
}

function goalDoc(overrides: Partial<WeeklyGoalDoc> = {}): WeeklyGoalDoc {
  return {
    _id: "goal_1" as Id<"weeklyGoals">,
    _creationTime: 1,
    mode: "shared",
    creatorId: "user_creator" as Id<"users">,
    partnerId: "user_partner" as Id<"users">,
    themes: [
      {
        themeId: "theme_1" as Id<"themes">,
        themeName: "Theme 1",
        creatorCompleted: false,
        partnerCompleted: false,
      },
    ],
    creatorLocked: true,
    partnerLocked: true,
    status: "locked",
    createdAt: 1,
    lockedAt: 2,
    endDate: 100_000,
    miniBossStatus: "unavailable",
    bigBossStatus: "unavailable",
    ...overrides,
  };
}

const handler = (toggleCompletion as unknown as {
  _handler: (
    ctx: unknown,
    args: { goalId: Id<"weeklyGoals">; themeId: Id<"themes"> }
  ) => Promise<void>;
})._handler;

describe("weeklyGoals toggleCompletion", () => {
  it("toggles the caller completion flag while the goal is active", async () => {
    const db = new InMemoryDb(
      [
        userDoc({ _id: "user_creator" as Id<"users">, clerkId: "creator" }),
        userDoc({ _id: "user_partner" as Id<"users">, clerkId: "partner" }),
      ],
      [goalDoc()]
    );

    await handler(createAuthCtx(db, "creator") as never, {
      goalId: "goal_1" as Id<"weeklyGoals">,
      themeId: "theme_1" as Id<"themes">,
    });

    expect(db.weeklyGoals[0]?.themes[0]?.creatorCompleted).toBe(true);
    expect(db.weeklyGoals[0]?.themes[0]?.partnerCompleted).toBe(false);
  });

  it("rejects completion changes after the goal is completed", async () => {
    const db = new InMemoryDb(
      [
        userDoc({ _id: "user_creator" as Id<"users">, clerkId: "creator" }),
        userDoc({ _id: "user_partner" as Id<"users">, clerkId: "partner" }),
      ],
      [goalDoc({ status: "completed", bigBossStatus: "defeated" })]
    );

    await expect(
      handler(createAuthCtx(db, "creator") as never, {
        goalId: "goal_1" as Id<"weeklyGoals">,
        themeId: "theme_1" as Id<"themes">,
      })
    ).rejects.toThrow("Theme completion can no longer be changed");
  });
});



it("toggles the partner independently and supports undo", async () => {
  const db = new InMemoryDb([userDoc({ _id: "user_partner" as Id<"users">, clerkId: "partner" })], [goalDoc()]);
  const args = { goalId: "goal_1" as Id<"weeklyGoals">, themeId: "theme_1" as Id<"themes"> };
  await handler(createAuthCtx(db, "partner"), args);
  expect(db.weeklyGoals[0].themes[0]).toMatchObject({ creatorCompleted: false, partnerCompleted: true });
  await handler(createAuthCtx(db, "partner"), args);
  expect(db.weeklyGoals[0].themes[0]).toMatchObject({ creatorCompleted: false, partnerCompleted: false });
});

it("toggles solo completion without adding a partner field", async () => {
  const goal = goalDoc({ mode: "solo", partnerId: undefined, partnerLocked: undefined });
  delete goal.themes[0].partnerCompleted;
  const db = new InMemoryDb([userDoc({})], [goal]);
  await handler(createAuthCtx(db, "creator"), { goalId: goal._id, themeId: goal.themes[0].themeId });
  expect(db.weeklyGoals[0].themes[0]).toEqual({ themeId: "theme_1", themeName: "Theme 1", creatorCompleted: true });
});

it("rejects a theme outside the goal without changing progress", async () => {
  const goal = goalDoc();
  const db = new InMemoryDb([userDoc({})], [goal]);
  await expect(handler(createAuthCtx(db, "creator"), { goalId: goal._id, themeId: "missing" as Id<"themes"> })).rejects.toThrow("Theme not in goal");
  expect(db.weeklyGoals[0]).toEqual(goal);
});
