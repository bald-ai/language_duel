import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  acceptFriendRequestNotification,
  rejectFriendRequestNotification,
} from "@/convex/friends";
import {
  createAuthCtx,
  createIndexedQuery,
  insertRow,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email">;
type FriendDoc = Pick<
  Doc<"friends">,
  "_id" | "_creationTime" | "userId" | "friendId" | "createdAt"
>;
type FriendRequestDoc = Pick<
  Doc<"friendRequests">,
  "_id" | "_creationTime" | "senderId" | "receiverId" | "status" | "createdAt"
>;
type NotificationDoc = Pick<
  Doc<"notifications">,
  "_id" | "_creationTime" | "type" | "fromUserId" | "toUserId" | "status" | "payload" | "createdAt"
>;

type TableName = "users" | "friends" | "friendRequests" | "notifications";

class InMemoryDb {
  public users: UserDoc[] = [];
  public friends: FriendDoc[] = [];
  public friendRequests: FriendRequestDoc[] = [];
  public notifications: NotificationDoc[] = [];
  private friendIdCounter = 10;

  query(table: TableName) {
    switch (table) {
      case "users":
        return createIndexedQuery(this.users);
      case "friends":
        return createIndexedQuery(this.friends);
      case "friendRequests":
        return createIndexedQuery(this.friendRequests);
      case "notifications":
        return createIndexedQuery(this.notifications);
    }
  }

  async get(id: string) {
    return (
      this.users.find((row) => row._id === id) ??
      this.friendRequests.find((row) => row._id === id) ??
      this.notifications.find((row) => row._id === id) ??
      null
    );
  }

  async patch(id: string, value: Record<string, unknown>) {
    if (this.friendRequests.some((row) => row._id === id)) {
      patchRow(this.friendRequests, id, value);
      return;
    }

    patchRow(this.notifications, id, value);
  }

  async insert(table: "friends", value: Omit<FriendDoc, "_id" | "_creationTime">) {
    const inserted = insertRow<FriendDoc>(
      this.friends,
      "friendship",
      this.friendIdCounter,
      value
    );
    this.friendIdCounter = inserted.nextCounter;
    return inserted.id as Id<"friends">;
  }
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

function friendRequestDoc(overrides: Partial<FriendRequestDoc> = {}): FriendRequestDoc {
  return {
    _id: "request_1" as Id<"friendRequests">,
    _creationTime: Date.now(),
    senderId: "user_2" as Id<"users">,
    receiverId: "user_1" as Id<"users">,
    status: "pending",
    createdAt: Date.now(),
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

function createCtx(db: InMemoryDb) {
  return createAuthCtx(db, "clerk_1");
}

const acceptNotificationHandler = (acceptFriendRequestNotification as unknown as {
  _handler: (
    ctx: unknown,
    args: { notificationId: Id<"notifications"> }
  ) => Promise<{ success: true }>;
})._handler;

const rejectNotificationHandler = (rejectFriendRequestNotification as unknown as {
  _handler: (
    ctx: unknown,
    args: { notificationId: Id<"notifications"> }
  ) => Promise<{ success: true }>;
})._handler;

describe("friend request notification resolution", () => {
  it("accepts a pending request and dismisses all related receiver notifications", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.users.push(userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" }));
    db.friendRequests.push(friendRequestDoc());
    db.notifications.push(notificationDoc({ _id: "notification_1" as Id<"notifications"> }));
    db.notifications.push(
      notificationDoc({ _id: "notification_2" as Id<"notifications">, status: "read" })
    );

    const result = await acceptNotificationHandler(createCtx(db), {
      notificationId: "notification_1" as Id<"notifications">,
    });

    expect(result).toEqual({ success: true });
    expect(db.friendRequests[0].status).toBe("accepted");
    expect(db.friends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: "user_1", friendId: "user_2" }),
        expect.objectContaining({ userId: "user_2", friendId: "user_1" }),
      ])
    );
    expect(db.notifications.every((notification) => notification.status === "dismissed")).toBe(true);
  });

  it("rejecting from a notification still requires the request to be pending", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.friendRequests.push(friendRequestDoc({ status: "accepted" }));
    db.notifications.push(notificationDoc());

    await expect(
      rejectNotificationHandler(createCtx(db), {
        notificationId: "notification_1" as Id<"notifications">,
      })
    ).rejects.toThrow("Friend request is no longer pending");

    expect(db.friendRequests[0].status).toBe("accepted");
    expect(db.notifications[0].status).toBe("pending");
  });
});
