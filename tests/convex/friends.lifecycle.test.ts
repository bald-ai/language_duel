import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  acceptFriendRequestNotification,
  rejectFriendRequestNotification,
  sendFriendRequest,
  getFriends,
  getSentRequests,
  cleanupExpiredFriendRequests,
  cleanupResolvedFriendRequests,
} from "@/convex/friends";
import {
  FRIEND_REQUEST_TTL_MS,
  RESOLVED_FRIEND_REQUEST_TTL_MS,
} from "@/convex/constants";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";

type Table = "users" | "friends" | "friendRequests" | "notifications";
type Row = Doc<Table>;
const currentId = "current" as Id<"users">;
const peerId = "peer" as Id<"users">;
const now = 2_000_000_000_000;
function user(id: string, overrides: Partial<Doc<"users">> = {}): Doc<"users"> {
  return {
    _id: id as Id<"users">,
    _creationTime: 1,
    clerkId: id,
    email: `${id}@example.test`,
    nickname: id,
    discriminator: 1234,
    ...overrides,
  };
}
function request(
  id: string,
  overrides: Partial<Doc<"friendRequests">> = {},
): Doc<"friendRequests"> {
  return {
    _id: id as Id<"friendRequests">,
    _creationTime: 1,
    senderId: currentId,
    receiverId: peerId,
    createdAt: now,
    status: "pending",
    ...overrides,
  };
}
function friendship(id: string, friendId: string): Doc<"friends"> {
  return {
    _id: id as Id<"friends">,
    _creationTime: 1,
    userId: currentId,
    friendId: friendId as Id<"users">,
    createdAt: 20,
  };
}
function notification(
  id: string,
  requestId: string,
  overrides: Partial<Doc<"notifications">> = {},
): Doc<"notifications"> {
  return {
    _id: id as Id<"notifications">,
    _creationTime: 1,
    type: "friend_request",
    fromUserId: currentId,
    toUserId: peerId,
    payload: { friendRequestId: requestId as Id<"friendRequests"> },
    status: "pending",
    createdAt: now - FRIEND_REQUEST_TTL_MS - 1,
    ...overrides,
  };
}
function fixture(identity: string | null = "current") {
  const tables: { [T in Table]: Doc<T>[] } = {
    users: [user("current"), user("peer")],
    friends: [],
    friendRequests: [],
    notifications: [],
  };
  const db = {
    query: (table: Table) => createIndexedQuery<Row>(tables[table]),
    get: async (id: string) =>
      Object.values(tables)
        .flat()
        .find((row) => row._id === id) ?? null,
    insert: vi.fn(async (table: Table, fields: Record<string, unknown>) => {
      const id = `${table}_${tables[table].length}`;
      (tables[table] as Row[]).push({
        _id: id,
        _creationTime: now,
        ...fields,
      } as Row);
      return id;
    }),
    patch: vi.fn(async (id: string, fields: Record<string, unknown>) => {
      const row = Object.values(tables)
        .flat()
        .find((row) => row._id === id);
      if (!row) throw new Error(`Missing row ${id}`);
      Object.assign(row, fields);
    }),
    delete: vi.fn(async (id: string) => {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex((row) => row._id === id);
        if (index >= 0) rows.splice(index, 1);
      }
    }),
  };
  return { db, tables, ctx: createAuthCtx(db, identity) };
}
function call(
  fn: unknown,
  ctx: unknown,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  return (
    fn as {
      _handler: (
        ctx: unknown,
        args: Record<string, unknown>,
      ) => Promise<unknown>;
    }
  )._handler(ctx, args);
}
describe("friend request lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());

  it("creates one pending request with the linked recipient notification", async () => {
    const f = fixture();
    f.tables.friendRequests.push(
      request("old", { status: "rejected" }),
      request("unrelated", { receiverId: "someone" as Id<"users"> }),
    );
    await expect(
      call(sendFriendRequest, f.ctx, { receiverId: peerId }),
    ).resolves.toEqual({ requestId: "friendRequests_2" });
    expect(f.tables.friendRequests[2]).toMatchObject({
      senderId: currentId,
      receiverId: peerId,
      status: "pending",
      createdAt: now,
    });
    expect(f.tables.notifications).toEqual([
      {
        _id: "notifications_0",
        _creationTime: now,
        type: "friend_request",
        fromUserId: currentId,
        toUserId: peerId,
        status: "pending",
        payload: { friendRequestId: "friendRequests_2" },
        createdAt: now,
      },
    ]);
  });

  it.each(["self", "missing", "friends", "sent", "received"] as const)(
    "rejects %s without writing a request or notification",
    async (state) => {
      const f = fixture();
      if (state === "friends")
        f.tables.friends.push(friendship("friend", peerId));
      if (state === "sent") f.tables.friendRequests.push(request("sent"));
      if (state === "received")
        f.tables.friendRequests.push(
          request("received", { senderId: peerId, receiverId: currentId }),
        );
      const receiverId =
        state === "self" ? currentId : state === "missing" ? "missing" : peerId;
      const messages = {
        self: "yourself",
        missing: "User not found",
        friends: "Already friends",
        sent: "already sent",
        received: "already sent you",
      };
      await expect(
        call(sendFriendRequest, f.ctx, { receiverId }),
      ).rejects.toThrow(messages[state]);
      expect(f.db.insert).not.toHaveBeenCalled();
      expect(f.db.patch).not.toHaveBeenCalled();
    },
  );

  it.each([null, "missing"])(
    "rejects unauthenticated/unregistered sender %s",
    async (identity) => {
      const f = fixture(identity);
      await expect(
        call(sendFriendRequest, f.ctx, { receiverId: peerId }),
      ).rejects.toThrow(identity === null ? "Unauthorized" : "User not found");
      expect(f.db.insert).not.toHaveBeenCalled();
    },
  );

  it.each([acceptFriendRequestNotification, rejectFriendRequestNotification])(
    "checks receiver ownership and existence through notifications",
    async (fn) => {
      const f = fixture();
      f.tables.notifications.push(notification("pending", "request", { toUserId: currentId }), notification("missing_notice", "missing", { toUserId: currentId }));
      await expect(call(fn, f.ctx, { notificationId: "missing_notice" })).rejects.toThrow(
        "Friend request not found",
      );
      f.tables.friendRequests.push(request("request"));
      await expect(call(fn, f.ctx, { notificationId: "pending" })).rejects.toThrow(
        fn === acceptFriendRequestNotification ? "Cannot accept" : "Cannot reject",
      );
      expect(f.db.patch).not.toHaveBeenCalled();
      expect(f.db.insert).not.toHaveBeenCalled();
    },
  );

  it.each([acceptFriendRequestNotification, rejectFriendRequestNotification])(
    "resolves a notified request and dismisses only its active recipient notifications",
    async (fn) => {
      const f = fixture("peer");
      f.tables.friendRequests.push(request("request"));
      f.tables.notifications.push(
        notification("pending", "request"),
        notification("read", "request", { status: "read" }),
        notification("other", "other"),
      );
      await expect(call(fn, f.ctx, { notificationId: "pending" })).resolves.toEqual({
        success: true,
      });
      expect(f.tables.friendRequests[0].status).toBe(
        fn === acceptFriendRequestNotification ? "accepted" : "rejected",
      );
      expect(f.tables.notifications.map((row) => row.status)).toEqual([
        "dismissed",
        "dismissed",
        "pending",
      ]);
      expect(f.tables.friends.map((row) => [row.userId, row.friendId])).toEqual(
        fn === acceptFriendRequestNotification
          ? [
              [peerId, currentId],
              [currentId, peerId],
            ]
          : [],
      );
      await expect(call(fn, f.ctx, { notificationId: "pending" })).rejects.toThrow(
        "no longer pending",
      );
    },
  );
});

describe("friend list projections", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());
  it.each([getFriends, getSentRequests])(
    "returns an empty list for signed-out callers",
    async (fn) => {
      await expect(call(fn, fixture(null).ctx)).resolves.toEqual([]);
    },
  );
  it("only projects pending sent requests whose receiver still exists", async () => {
    const f = fixture();
    f.tables.friendRequests.push(
      request("pending"),
      request("resolved", { status: "accepted" }),
      request("missing_receiver_request", {
        receiverId: "deleted" as Id<"users">,
      }),
      request("incoming", { senderId: peerId, receiverId: currentId }),
    );
    await expect(call(getSentRequests, f.ctx)).resolves.toEqual([
      {
        requestId: "pending",
        senderId: currentId,
        receiverId: peerId,
        nickname: "peer",
        discriminator: 1234,
        name: undefined,
        imageUrl: undefined,
        createdAt: now,
      },
    ]);
  });
  it("sorts online friends first and each group by recency, omitting deleted users", async () => {
    const f = fixture();
    f.tables.users.push(
      user("offline", { lastSeenAt: now - 600_000 }),
      user("onlineOlder", { lastSeenAt: now - 1000 }),
      user("online", { lastSeenAt: now }),
      user("never"),
    );
    f.tables.friends.push(
      ...["peer", "onlineOlder", "offline", "online", "never", "deleted"].map(
        (id) => friendship(`f_${id}`, id),
      ),
    );
    const rows = (await call(getFriends, f.ctx)) as Array<{
      friendId: string;
      isOnline: boolean;
    }>;
    expect(rows.map((row) => row.friendId)).toEqual([
      "online",
      "onlineOlder",
      "offline",
      "peer",
      "never",
    ]);
    expect(rows.map((row) => row.isOnline)).toEqual([
      true,
      true,
      false,
      false,
      false,
    ]);
  });
});

describe("friend request retention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });
  afterEach(() => vi.useRealTimers());
  it("rejects only old pending requests and dismisses matching old active notifications", async () => {
    const f = fixture();
    const cutoff = now - FRIEND_REQUEST_TTL_MS;
    f.tables.friendRequests.push(
      request("expired", { createdAt: cutoff - 1 }),
      request("boundary", { createdAt: cutoff }),
      request("new"),
      request("resolved", { createdAt: cutoff - 1, status: "accepted" }),
    );
    f.tables.notifications.push(
      notification("pending", "expired"),
      notification("read", "expired", { status: "read" }),
      notification("other", "other"),
      notification("boundary", "expired", { createdAt: cutoff }),
      notification("dismissed", "expired", { status: "dismissed" }),
      notification("wrongPayload", "expired", {
        payload: {
          challengeId: "challenge" as Id<"challenges">,
          duelMode: "pvp",
        },
      }),
    );
    await call(cleanupExpiredFriendRequests, f.ctx);
    expect(f.tables.friendRequests.map((row) => row.status)).toEqual([
      "rejected",
      "pending",
      "pending",
      "accepted",
    ]);
    expect(f.tables.notifications.map((row) => row.status)).toEqual([
      "dismissed",
      "dismissed",
      "pending",
      "pending",
      "dismissed",
      "pending",
    ]);
    f.db.patch.mockClear();
    await call(cleanupExpiredFriendRequests, f.ctx);
    expect(f.db.patch).not.toHaveBeenCalled();
  });
  it("deletes old resolved requests while preserving pending and exact-cutoff rows", async () => {
    const f = fixture();
    const cutoff = now - RESOLVED_FRIEND_REQUEST_TTL_MS;
    f.tables.friendRequests.push(
      request("accepted", { status: "accepted", createdAt: cutoff - 1 }),
      request("rejected", { status: "rejected", createdAt: cutoff - 1 }),
      request("pending", { createdAt: cutoff - 1 }),
      request("boundary", { status: "accepted", createdAt: cutoff }),
      request("recent", { status: "rejected" }),
    );
    await expect(call(cleanupResolvedFriendRequests, f.ctx)).resolves.toEqual({
      deletedCount: 2,
    });
    expect(f.tables.friendRequests.map((row) => row._id)).toEqual([
      "pending",
      "boundary",
      "recent",
    ]);
    await expect(call(cleanupResolvedFriendRequests, f.ctx)).resolves.toEqual({
      deletedCount: 0,
    });
  });
});
