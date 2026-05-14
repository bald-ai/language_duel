import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { dismissNotification, markNotificationRead } from "@/convex/notifications";
import { createAuthCtx, createIndexedQuery, patchRow } from "./testUtils/inMemoryDb";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email">;
type NotificationDoc = Pick<
  Doc<"notifications">,
  "_id" | "_creationTime" | "type" | "fromUserId" | "toUserId" | "status" | "payload" | "createdAt"
>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public notifications: NotificationDoc[] = [];

  query(table: "users" | "notifications") {
    if (table === "users") {
      return createIndexedQuery(this.users);
    }
    return createIndexedQuery(this.notifications);
  }

  async get(id: string) {
    return this.notifications.find((row) => row._id === id) ?? null;
  }

  async patch(id: string, value: Record<string, unknown>) {
    patchRow(this.notifications, id, value);
  }
}

const dismissHandler = (dismissNotification as unknown as {
  _handler: (
    ctx: unknown,
    args: { notificationId: Id<"notifications"> }
  ) => Promise<void>;
})._handler;

const markReadHandler = (markNotificationRead as unknown as {
  _handler: (
    ctx: unknown,
    args: { notificationId: Id<"notifications"> }
  ) => Promise<void>;
})._handler;

function createCtx(db: InMemoryDb, clerkId: string) {
  return createAuthCtx(db, clerkId);
}

function userDoc(overrides: Partial<UserDoc>): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: Date.now(),
    clerkId: "clerk_1",
    email: "user@example.com",
    ...overrides,
  };
}

function notificationDoc(overrides: Partial<NotificationDoc> = {}): NotificationDoc {
  return {
    _id: "notification_1" as Id<"notifications">,
    _creationTime: Date.now(),
    type: "friend_request",
    fromUserId: "user_2" as Id<"users">,
    toUserId: "user_1" as Id<"users">,
    status: "pending",
    payload: { friendRequestId: "request_1" as Id<"friendRequests"> },
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("notifications authorization", () => {
  it("dismissNotification rejects wrong users", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.users.push(userDoc({ _id: "user_3" as Id<"users">, clerkId: "clerk_3" }));
    db.notifications.push(notificationDoc());

    await expect(
      dismissHandler(createCtx(db, "clerk_3"), {
        notificationId: "notification_1" as Id<"notifications">,
      })
    ).rejects.toThrow("Not authorized to dismiss this notification");
  });

  it("markNotificationRead rejects wrong users", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.users.push(userDoc({ _id: "user_3" as Id<"users">, clerkId: "clerk_3" }));
    db.notifications.push(notificationDoc());

    await expect(
      markReadHandler(createCtx(db, "clerk_3"), {
        notificationId: "notification_1" as Id<"notifications">,
      })
    ).rejects.toThrow("Not authorized to modify this notification");
  });
});
