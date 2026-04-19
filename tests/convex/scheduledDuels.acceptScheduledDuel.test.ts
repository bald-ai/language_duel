import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { acceptScheduledDuel } from "@/convex/scheduledDuels";
import {
  createAuthCtx,
  createIndexedQuery,
  insertRow,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "name" | "imageUrl" | "nickname"
>;

type ThemeDoc = Pick<
  Doc<"themes">,
  "_id" | "_creationTime" | "name" | "description" | "createdAt" | "ownerId" | "words"
>;

type ScheduledDuelDoc = Pick<
  Doc<"scheduledDuels">,
  | "_id"
  | "_creationTime"
  | "proposerId"
  | "recipientId"
  | "themeIds"
  | "scheduledTime"
  | "status"
  | "mode"
  | "createdAt"
  | "updatedAt"
> &
  Partial<Pick<Doc<"scheduledDuels">, "classicDifficultyPreset" | "proposerReady" | "recipientReady">>;

type NotificationDoc = Pick<
  Doc<"notifications">,
  | "_id"
  | "_creationTime"
  | "type"
  | "fromUserId"
  | "toUserId"
  | "status"
  | "payload"
  | "createdAt"
>;

class InMemoryDb {
  private notificationCounter = 10;

  constructor(
    public users: UserDoc[],
    public themes: ThemeDoc[],
    public scheduledDuels: ScheduledDuelDoc[],
    public notifications: NotificationDoc[] = []
  ) {}

  query(table: "users" | "themes" | "scheduledDuels" | "notifications") {
    switch (table) {
      case "users":
        return createIndexedQuery(this.users);
      case "themes":
        return createIndexedQuery(this.themes);
      case "scheduledDuels":
        return createIndexedQuery(this.scheduledDuels);
      case "notifications":
        return createIndexedQuery(this.notifications);
    }
  }

  async get(id: string) {
    return (
      this.users.find((row) => row._id === id) ??
      this.themes.find((row) => row._id === id) ??
      this.scheduledDuels.find((row) => row._id === id) ??
      this.notifications.find((row) => row._id === id) ??
      null
    );
  }

  async patch(id: string, value: Record<string, unknown>) {
    if (this.notifications.some((row) => row._id === id)) {
      patchRow(this.notifications, id, value);
      return;
    }

    patchRow(this.scheduledDuels, id, value);
  }

  async insert(table: "notifications", value: Record<string, unknown>) {
    const { id, nextCounter } = insertRow(
      this.notifications,
      "notification",
      this.notificationCounter,
      value
    );
    this.notificationCounter = nextCounter;
    return id as Id<"notifications">;
  }
}

function buildUser(overrides: Partial<UserDoc>): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "user@example.com",
    name: "User",
    imageUrl: "https://example.com/user.png",
    nickname: "User",
    ...overrides,
  };
}

function buildTheme(overrides: Partial<ThemeDoc> = {}): ThemeDoc {
  return {
    _id: "theme_1" as Id<"themes">,
    _creationTime: 1,
    name: "Theme 1",
    description: "A theme",
    createdAt: Date.now(),
    ownerId: "user_creator" as Id<"users">,
    words: [
      { word: "cat", answer: "kocka", wrongAnswers: ["strom", "most", "more"] },
    ],
    ...overrides,
  };
}

function buildScheduledDuel(overrides: Partial<ScheduledDuelDoc> = {}): ScheduledDuelDoc {
  return {
    _id: "scheduled_1" as Id<"scheduledDuels">,
    _creationTime: 1,
    proposerId: "user_creator" as Id<"users">,
    recipientId: "user_partner" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    scheduledTime: Date.now() + 60 * 60 * 1000,
    status: "pending",
    mode: "solo",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

function buildNotification(overrides: Partial<NotificationDoc> = {}): NotificationDoc {
  return {
    _id: "notification_1" as Id<"notifications">,
    _creationTime: 1,
    type: "scheduled_duel",
    fromUserId: "user_creator" as Id<"users">,
    toUserId: "user_partner" as Id<"users">,
    status: "pending",
    payload: {
      scheduledDuelId: "scheduled_1" as Id<"scheduledDuels">,
      themeId: "theme_1" as Id<"themes">,
      themeName: "Theme 1",
      scheduledTime: Date.now() + 60 * 60 * 1000,
      mode: "solo",
    },
    createdAt: Date.now(),
    ...overrides,
  };
}

const acceptScheduledDuelHandler = (acceptScheduledDuel as unknown as {
  _handler: (
    ctx: unknown,
    args: { scheduledDuelId: Id<"scheduledDuels"> }
  ) => Promise<{ success: true }>;
})._handler;

describe("scheduledDuels acceptScheduledDuel", () => {
  it("keeps the in-app accepted notification flow but no longer schedules an email", async () => {
    const scheduledCalls: Array<{ trigger: string; toUserId: Id<"users"> }> = [];
    const db = new InMemoryDb(
      [
        buildUser({ _id: "user_creator" as Id<"users">, clerkId: "creator", nickname: "Creator" }),
        buildUser({ _id: "user_partner" as Id<"users">, clerkId: "partner", nickname: "Partner" }),
      ],
      [buildTheme()],
      [buildScheduledDuel()],
      [buildNotification()]
    );

    await acceptScheduledDuelHandler(
      createAuthCtx(db, "partner", {
        scheduler: {
          runAfter: async (
            _delay: number,
            _fn: unknown,
            payload: { trigger: string; toUserId: Id<"users"> }
          ) => {
            scheduledCalls.push(payload);
          },
        },
      }) as never,
      { scheduledDuelId: "scheduled_1" as Id<"scheduledDuels"> }
    );

    expect(db.scheduledDuels[0]).toMatchObject({
      status: "accepted",
      proposerReady: false,
      recipientReady: false,
    });
    expect(
      db.notifications.some(
        (notification) =>
          notification.toUserId === ("user_creator" as Id<"users">) &&
          notification.type === "scheduled_duel" &&
          notification.status === "pending" &&
          (notification.payload as { scheduledDuelStatus?: string }).scheduledDuelStatus ===
            "accepted"
      )
    ).toBe(true);
    expect(scheduledCalls).toEqual([]);
  });
});
