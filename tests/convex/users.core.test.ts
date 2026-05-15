import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { consumeCredits } from "@/convex/credits";
import {
  getCurrentUser,
  getUsers,
  isUserOnline,
  searchUsers,
  syncUser,
  updateNickname,
  updatePresence,
} from "@/convex/users";
import {
  LLM_MONTHLY_CREDITS,
  LLM_SMALL_ACTION_CREDITS,
  LLM_THEME_CREDITS,
  TTS_GENERATION_COST,
  TTS_MONTHLY_GENERATIONS,
} from "@/lib/credits/constants";
import {
  createAuthCtx,
  createIndexedQuery,
  insertRow,
  patchRow,
} from "./testUtils/inMemoryDb";
import { NICKNAME_ERRORS } from "@/lib/users/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function callConvex(fn: any, ctx: unknown, args: Record<string, unknown> = {}) {
  return fn._handler(ctx, args);
}

type UserDoc = Pick<
  Doc<"users">,
  | "_id"
  | "_creationTime"
  | "clerkId"
  | "email"
  | "name"
  | "imageUrl"
  | "nickname"
  | "discriminator"
  | "llmCreditsRemaining"
  | "ttsGenerationsRemaining"
  | "creditsMonth"
  | "ttsProvider"
  | "lastSeenAt"
>;

type FriendDoc = Pick<Doc<"friends">, "_id" | "_creationTime" | "userId" | "friendId">;

type FriendRequestDoc = Pick<
  Doc<"friendRequests">,
  "_id" | "_creationTime" | "senderId" | "receiverId" | "status"
>;

type TableName = "users" | "friends" | "friendRequests";

class InMemoryDb {
  public users: UserDoc[] = [];
  public friends: FriendDoc[] = [];
  public friendRequests: FriendRequestDoc[] = [];
  private userIdCounter = 10;

  query(table: TableName) {
    if (table === "users") {
      return createIndexedQuery(this.users);
    }

    if (table === "friends") {
      return createIndexedQuery(this.friends);
    }

    return createIndexedQuery(this.friendRequests);
  }

  async patch(id: Id<"users">, value: Partial<UserDoc>): Promise<void> {
    patchRow(this.users, id, value);
  }

  async insert(table: "users", value: Omit<UserDoc, "_id" | "_creationTime">): Promise<Id<"users">> {
    if (table !== "users") {
      throw new Error(`Unsupported table for insert: ${table}`);
    }

    const inserted = insertRow<UserDoc>(this.users, "user", this.userIdCounter, value);
    this.userIdCounter = inserted.nextCounter;
    return inserted.id as Id<"users">;
  }
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function userDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: Date.now(),
    clerkId: "clerk_1",
    email: "user1@example.com",
    nickname: "UserOne",
    discriminator: 1111,
    llmCreditsRemaining: 20,
    ttsGenerationsRemaining: 10,
    creditsMonth: currentMonthKey(),
    ...overrides,
  };
}

function friendDoc(overrides: Partial<FriendDoc> = {}): FriendDoc {
  return {
    _id: "friend_1" as Id<"friends">,
    _creationTime: Date.now(),
    userId: "user_1" as Id<"users">,
    friendId: "user_2" as Id<"users">,
    ...overrides,
  };
}

function requestDoc(overrides: Partial<FriendRequestDoc> = {}): FriendRequestDoc {
  return {
    _id: "request_1" as Id<"friendRequests">,
    _creationTime: Date.now(),
    senderId: "user_1" as Id<"users">,
    receiverId: "user_3" as Id<"users">,
    status: "pending",
    ...overrides,
  };
}

function createCtx(db: InMemoryDb, identitySubject: string | null) {
  return createAuthCtx(db, identitySubject);
}

describe("users core handlers", () => {
  it("getUsers returns empty list when unauthenticated", async () => {
    const db = new InMemoryDb();

    const result = await callConvex(getUsers, createCtx(db, null), {});

    expect(result).toEqual([]);
  });

  it("getUsers excludes current user and returns public data only", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.users.push(
      userDoc({
        _id: "user_2" as Id<"users">,
        clerkId: "clerk_2",
        email: "friend@example.com",
        nickname: "Friend",
        discriminator: 2222,
      })
    );

    const result = await callConvex(getUsers, createCtx(db, "clerk_1"), {});

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      _id: "user_2",
      nickname: "Friend",
      discriminator: 2222,
    });
    expect(result[0]).not.toHaveProperty("email");
    expect("clerkId" in (result[0] ?? {})).toBe(false);
  });

  it("getCurrentUser returns null when unauthenticated", async () => {
    const db = new InMemoryDb();

    const result = await callConvex(getCurrentUser, createCtx(db, null), {});

    expect(result).toBeNull();
  });

  it("getCurrentUser normalizes stale credits and defaults TTS provider", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({
        _id: "user_1" as Id<"users">,
        clerkId: "clerk_1",
        creditsMonth: "2000-01",
        llmCreditsRemaining: 2,
        ttsGenerationsRemaining: 1,
        ttsProvider: undefined,
      })
    );

    const result = await callConvex(getCurrentUser, createCtx(db, "clerk_1"), {});

    expect(result.llmCreditsRemaining).toBe(LLM_MONTHLY_CREDITS);
    expect(result.ttsGenerationsRemaining).toBe(TTS_MONTHLY_GENERATIONS);
    expect(result.ttsProvider).toBe("resemble");
  });

  it("searchUsers matches nickname#discriminator format", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.users.push(
      userDoc({
        _id: "user_2" as Id<"users">,
        clerkId: "clerk_2",
        email: "alex@example.com",
        nickname: "Alex",
        discriminator: 1234,
      })
    );

    const result = await callConvex(searchUsers, createCtx(db, "clerk_1"), { searchTerm: "Alex#1234" });

    expect(result.map((user: { _id: Id<"users"> }) => user._id)).toEqual(["user_2"]);
  });

  it("searchUsers marks friend and pending states", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1", email: "me@example.com" }));
    db.users.push(userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "friend@example.com" }));
    db.users.push(userDoc({ _id: "user_3" as Id<"users">, clerkId: "clerk_3", email: "sent@example.com" }));
    db.users.push(userDoc({ _id: "user_4" as Id<"users">, clerkId: "clerk_4", email: "received@example.com" }));

    db.friends.push(friendDoc({ userId: "user_1" as Id<"users">, friendId: "user_2" as Id<"users"> }));
    db.friendRequests.push(requestDoc({ senderId: "user_1" as Id<"users">, receiverId: "user_3" as Id<"users">, status: "pending" }));
    db.friendRequests.push(requestDoc({ _id: "request_2" as Id<"friendRequests">, senderId: "user_4" as Id<"users">, receiverId: "user_1" as Id<"users">, status: "pending" }));

    const result = await callConvex(searchUsers, createCtx(db, "clerk_1"), { searchTerm: "@example.com" });
    const byId = new Map<Id<"users">, { _id: Id<"users">; isFriend?: boolean; isPending?: boolean }>(
      result.map((user: { _id: Id<"users">; isFriend?: boolean; isPending?: boolean }) => [user._id, user])
    );

    expect(byId.get("user_2" as Id<"users">)?.isFriend).toBe(true);
    expect(byId.get("user_2" as Id<"users">)?.isPending).toBe(false);
    expect(byId.get("user_3" as Id<"users">)?.isPending).toBe(true);
    expect(byId.get("user_4" as Id<"users">)?.isPending).toBe(true);
  });

  it("syncUser rejects unauthenticated and mismatched identity", async () => {
    const db = new InMemoryDb();
    const callSync = (identity: string | null, args: { clerkId: string; email: string; name?: string; imageUrl?: string }) =>
      callConvex(syncUser, createCtx(db, identity), args);

    await expect(
      callSync(null, { clerkId: "clerk_1", email: "a@example.com" })
    ).rejects.toThrow("Unauthorized");

    await expect(
      callSync("clerk_other", { clerkId: "clerk_1", email: "a@example.com" })
    ).rejects.toThrow("Cannot sync user for another identity");
  });

  it("syncUser existing user does not backfill nickname/discriminator", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({
        _id: "user_1" as Id<"users">,
        clerkId: "clerk_1",
        nickname: undefined,
        discriminator: undefined,
      })
    );

    const id = await callConvex(syncUser, createCtx(db, "clerk_1"), {
      clerkId: "clerk_1",
      email: "u@example.com",
      name: "John__",
    });

    const updated = db.users.find((user) => user._id === id);
    expect(id).toBe("user_1");
    expect(updated?.nickname).toBeUndefined();
    expect(updated?.discriminator).toBeUndefined();
  });

  it("syncUser existing user resets monthly credits when needed", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({
        _id: "user_1" as Id<"users">,
        clerkId: "clerk_1",
        creditsMonth: "2000-01",
        llmCreditsRemaining: 7,
        ttsGenerationsRemaining: 8,
      })
    );

    await callConvex(syncUser, createCtx(db, "clerk_1"), {
      clerkId: "clerk_1",
      email: "u@example.com",
      name: "Jane",
    });

    const updated = db.users[0];
    expect(updated?.llmCreditsRemaining).toBe(LLM_MONTHLY_CREDITS);
    expect(updated?.ttsGenerationsRemaining).toBe(TTS_MONTHLY_GENERATIONS);
    expect(updated?.creditsMonth).toBe(currentMonthKey());
  });

  it("updateNickname rejects invalid nicknames", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));

    await expect(
      callConvex(updateNickname, createCtx(db, "clerk_1"), { nickname: "bad space" })
    ).rejects.toThrow(NICKNAME_ERRORS.INVALID_CHARS);

    await expect(
      callConvex(updateNickname, createCtx(db, "clerk_1"), { nickname: "ab" })
    ).rejects.toThrow(NICKNAME_ERRORS.TOO_SHORT);
  });

  it("updateNickname sets nickname and generates valid discriminator for new nicknames", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));

    const result = await callConvex(updateNickname, createCtx(db, "clerk_1"), { nickname: "ValidName" });

    expect(result.nickname).toBe("ValidName");
    expect(result.discriminator).toBeGreaterThanOrEqual(1000);
    expect(result.discriminator).toBeLessThanOrEqual(9999);
    expect(Number.isInteger(result.discriminator)).toBe(true);
    expect(db.users[0]?.nickname).toBe("ValidName");
  });

  it("updateNickname keeps discriminator unchanged when nickname is unchanged", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({
        _id: "user_1" as Id<"users">,
        clerkId: "clerk_1",
        nickname: "SameName",
        discriminator: 2468,
      })
    );

    const result = await callConvex(updateNickname, createCtx(db, "clerk_1"), { nickname: "  SameName  " });

    expect(result).toEqual({ nickname: "SameName", discriminator: 2468 });
    expect(db.users[0]?.nickname).toBe("SameName");
    expect(db.users[0]?.discriminator).toBe(2468);
  });

  it("consumeCredits rejects invalid costs and decrements balances on success", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({
        _id: "user_1" as Id<"users">,
        clerkId: "clerk_1",
        llmCreditsRemaining: 10,
        ttsGenerationsRemaining: 3,
      })
    );

    const callConsume = (args: { creditType: "llm" | "tts"; cost: number }) =>
      callConvex(consumeCredits, createCtx(db, "clerk_1"), args);

    await expect(callConsume({ creditType: "llm", cost: 0 })).rejects.toThrow("Invalid credit cost");
    await expect(callConsume({ creditType: "tts", cost: TTS_GENERATION_COST + 1 })).rejects.toThrow("Invalid TTS credit cost");
    await expect(callConsume({ creditType: "llm", cost: LLM_THEME_CREDITS + 10 })).rejects.toThrow("Invalid LLM credit cost");

    const llmResult = await callConsume({ creditType: "llm", cost: LLM_SMALL_ACTION_CREDITS });
    expect(llmResult.llmCreditsRemaining).toBe(9);
    expect(llmResult.ttsGenerationsRemaining).toBe(3);

    const ttsResult = await callConsume({ creditType: "tts", cost: TTS_GENERATION_COST });
    expect(ttsResult.llmCreditsRemaining).toBe(9);
    expect(ttsResult.ttsGenerationsRemaining).toBe(2);
  });

  it("isUserOnline and updatePresence handle edge cases", async () => {
    expect(isUserOnline(undefined)).toBe(false);
    expect(isUserOnline(Date.now() - 60_000)).toBe(true);
    expect(isUserOnline(Date.now() - 10 * 60_000)).toBe(false);

    const db = new InMemoryDb();
    await expect(
      callConvex(updatePresence, createCtx(db, null), {})
    ).resolves.toBeUndefined();

    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1", lastSeenAt: undefined }));

    const before = Date.now();
    await callConvex(updatePresence, createCtx(db, "clerk_1"), {});
    const after = Date.now();

    expect((db.users[0]?.lastSeenAt ?? 0) >= before).toBe(true);
    expect((db.users[0]?.lastSeenAt ?? 0) <= after).toBe(true);
  });
});
