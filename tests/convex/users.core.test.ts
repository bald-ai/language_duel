import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  consumeCredits,
  getCurrentUser,
  getUsers,
  isUserOnline,
  searchUsers,
  syncUser,
  updateNickname,
  updatePresence,
  updateTtsProvider,
} from "@/convex/users";
import {
  LLM_MONTHLY_CREDITS,
  LLM_SMALL_ACTION_CREDITS,
  LLM_THEME_CREDITS,
  TTS_GENERATION_COST,
  TTS_MONTHLY_GENERATIONS,
} from "@/lib/credits/constants";

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
type IndexFilters = Record<string, unknown>;
type NoArgs = Record<string, never>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public friends: FriendDoc[] = [];
  public friendRequests: FriendRequestDoc[] = [];
  private userIdCounter = 10;

  query(table: TableName) {
    const getRows = () => {
      if (table === "users") return [...this.users];
      if (table === "friends") return [...this.friends];
      return [...this.friendRequests];
    };

    const createResult = (rows: Array<UserDoc | FriendDoc | FriendRequestDoc>) => ({
      take: async (count: number) => rows.slice(0, count),
      collect: async () => rows,
      first: async () => rows[0] ?? null,
      unique: async () => rows[0] ?? null,
      filter: (predicate: (q: { eq: (lhs: unknown, rhs: unknown) => boolean; field: (name: string) => string }) => boolean) => {
        const q = {
          eq: (lhs: unknown, rhs: unknown) => lhs === rhs,
          field: (name: string) => name,
        };
        const filtered = rows.filter((row) => predicate({
          eq: (lhs: unknown, rhs: unknown) => lhs === rhs,
          field: (name: string) => (row as Record<string, unknown>)[name] as string,
        }));
        void q;
        return createResult(filtered);
      },
    });

    return {
      ...createResult(getRows()),
      withIndex: (
        indexName: string,
        builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
      ) => {
        const filters: IndexFilters = {};
        const q = {
          eq: (field: string, value: unknown) => {
            filters[field] = value;
            return q;
          },
        };
        builder(q);

        const rows = this.rowsByIndex(table, indexName, filters);
        return createResult(rows);
      },
    };
  }

  async patch(id: Id<"users">, value: Partial<UserDoc>): Promise<void> {
    const index = this.users.findIndex((user) => user._id === id);
    if (index < 0) throw new Error("User not found");
    this.users[index] = { ...this.users[index], ...value };
  }

  async insert(table: "users", value: Omit<UserDoc, "_id" | "_creationTime">): Promise<Id<"users">> {
    if (table !== "users") {
      throw new Error(`Unsupported table for insert: ${table}`);
    }

    const id = `user_${this.userIdCounter++}` as Id<"users">;
    this.users.push({
      _id: id,
      _creationTime: Date.now(),
      ...value,
    });
    return id;
  }

  private rowsByIndex(table: TableName, indexName: string, filters: IndexFilters) {
    if (table === "users" && indexName === "by_clerk_id") {
      const clerkId = filters.clerkId as string;
      return this.users.filter((user) => user.clerkId === clerkId);
    }

    if (table === "users" && indexName === "by_nickname_discriminator") {
      const nickname = filters.nickname as string;
      return this.users.filter((user) => user.nickname === nickname);
    }

    if (table === "friends" && indexName === "by_user") {
      const userId = filters.userId as Id<"users">;
      return this.friends.filter((friend) => friend.userId === userId);
    }

    if (table === "friendRequests" && indexName === "by_sender") {
      const senderId = filters.senderId as Id<"users">;
      return this.friendRequests.filter((request) => request.senderId === senderId);
    }

    if (table === "friendRequests" && indexName === "by_receiver") {
      const receiverId = filters.receiverId as Id<"users">;
      const status = filters.status as FriendRequestDoc["status"] | undefined;
      return this.friendRequests.filter(
        (request) =>
          request.receiverId === receiverId &&
          (status === undefined || request.status === status)
      );
    }

    throw new Error(`Unsupported index lookup: ${table}.${indexName}`);
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
  return {
    db,
    auth: {
      getUserIdentity: async () =>
        identitySubject ? { subject: identitySubject } : null,
    },
  };
}

describe("users core handlers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("getUsers returns empty list when unauthenticated", async () => {
    const db = new InMemoryDb();
    const handler = (getUsers as unknown as { _handler: (ctx: unknown, args: NoArgs) => Promise<unknown[]> })._handler;

    const result = await handler(createCtx(db, null), {});

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

    const handler = (getUsers as unknown as {
      _handler: (ctx: unknown, args: NoArgs) => Promise<Array<Record<string, unknown>>>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_1"), {});

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      _id: "user_2",
      nickname: "Friend",
      discriminator: 2222,
    });
    expect(result[0]).not.toHaveProperty("email");
    expect("clerkId" in (result[0] ?? {})).toBe(false);
  });

  it("getCurrentUser returns null unauthenticated and returns normalized authenticated profile", async () => {
    const db = new InMemoryDb();
    const handler = (getCurrentUser as unknown as { _handler: (ctx: unknown, args: NoArgs) => Promise<unknown> })._handler;

    const unauth = await handler(createCtx(db, null), {});
    expect(unauth).toBeNull();

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

    const profile = (await handler(createCtx(db, "clerk_1"), {})) as {
      llmCreditsRemaining: number;
      ttsGenerationsRemaining: number;
      ttsProvider: string;
    };

    expect(profile.llmCreditsRemaining).toBe(LLM_MONTHLY_CREDITS);
    expect(profile.ttsGenerationsRemaining).toBe(TTS_MONTHLY_GENERATIONS);
    expect(profile.ttsProvider).toBe("resemble");
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

    const handler = (searchUsers as unknown as {
      _handler: (ctx: unknown, args: { searchTerm: string }) => Promise<Array<{ _id: Id<"users"> }>>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_1"), { searchTerm: "Alex#1234" });

    expect(result.map((user) => user._id)).toEqual(["user_2"]);
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

    const handler = (searchUsers as unknown as {
      _handler: (ctx: unknown, args: { searchTerm: string }) => Promise<Array<{ _id: Id<"users">; isFriend?: boolean; isPending?: boolean }>>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_1"), { searchTerm: "@example.com" });
    const byId = new Map(result.map((user) => [user._id, user]));

    expect(byId.get("user_2" as Id<"users">)?.isFriend).toBe(true);
    expect(byId.get("user_2" as Id<"users">)?.isPending).toBe(false);
    expect(byId.get("user_3" as Id<"users">)?.isPending).toBe(true);
    expect(byId.get("user_4" as Id<"users">)?.isPending).toBe(true);
  });

  it("syncUser rejects unauthenticated and mismatched identity", async () => {
    const db = new InMemoryDb();
    const handler = (syncUser as unknown as {
      _handler: (
        ctx: unknown,
        args: { clerkId: string; email: string; name?: string; imageUrl?: string }
      ) => Promise<Id<"users">>;
    })._handler;

    await expect(
      handler(createCtx(db, null), {
        clerkId: "clerk_1",
        email: "a@example.com",
      })
    ).rejects.toThrow("Unauthorized");

    await expect(
      handler(createCtx(db, "clerk_other"), {
        clerkId: "clerk_1",
        email: "a@example.com",
      })
    ).rejects.toThrow("Cannot sync user for another identity");
  });

  it("syncUser existing user fills missing nickname/discriminator", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({
        _id: "user_1" as Id<"users">,
        clerkId: "clerk_1",
        nickname: undefined,
        discriminator: undefined,
      })
    );

    const handler = (syncUser as unknown as {
      _handler: (
        ctx: unknown,
        args: { clerkId: string; email: string; name?: string; imageUrl?: string }
      ) => Promise<Id<"users">>;
    })._handler;

    const id = await handler(createCtx(db, "clerk_1"), {
      clerkId: "clerk_1",
      email: "u@example.com",
      name: "John__",
    });

    const updated = db.users.find((user) => user._id === id);
    expect(id).toBe("user_1");
    expect(updated?.nickname).toBe("John__");
    expect(typeof updated?.discriminator).toBe("number");
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

    const handler = (syncUser as unknown as {
      _handler: (
        ctx: unknown,
        args: { clerkId: string; email: string; name?: string; imageUrl?: string }
      ) => Promise<Id<"users">>;
    })._handler;

    await handler(createCtx(db, "clerk_1"), {
      clerkId: "clerk_1",
      email: "u@example.com",
      name: "Jane",
    });

    const updated = db.users[0];
    expect(updated?.llmCreditsRemaining).toBe(LLM_MONTHLY_CREDITS);
    expect(updated?.ttsGenerationsRemaining).toBe(TTS_MONTHLY_GENERATIONS);
    expect(updated?.creditsMonth).toBe(currentMonthKey());
  });

  it("updateNickname validates input and applies generated discriminator", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));

    const handler = (updateNickname as unknown as {
      _handler: (ctx: unknown, args: { nickname: string }) => Promise<{ nickname: string; discriminator: number }>;
    })._handler;

    await expect(handler(createCtx(db, "clerk_1"), { nickname: "bad space" })).rejects.toThrow(
      "Nickname can only contain letters, numbers, and underscores"
    );

    await expect(handler(createCtx(db, "clerk_1"), { nickname: "ab" })).rejects.toThrow(
      "Nickname must be between 3 and 20 characters"
    );

    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = await handler(createCtx(db, "clerk_1"), { nickname: "ValidName" });

    expect(result.nickname).toBe("ValidName");
    expect(result.discriminator).toBe(1000);
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

    const handler = (updateNickname as unknown as {
      _handler: (ctx: unknown, args: { nickname: string }) => Promise<{ nickname: string; discriminator: number }>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_1"), { nickname: "  SameName  " });

    expect(result).toEqual({ nickname: "SameName", discriminator: 2468 });
    expect(db.users[0]?.nickname).toBe("SameName");
    expect(db.users[0]?.discriminator).toBe(2468);
  });

  it("updateTtsProvider updates preference", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1", ttsProvider: "resemble" }));

    const handler = (updateTtsProvider as unknown as {
      _handler: (ctx: unknown, args: { ttsProvider: "resemble" | "elevenlabs" }) => Promise<{ ttsProvider: "resemble" | "elevenlabs" }>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_1"), { ttsProvider: "elevenlabs" });

    expect(result.ttsProvider).toBe("elevenlabs");
    expect(db.users[0]?.ttsProvider).toBe("elevenlabs");
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

    const handler = (consumeCredits as unknown as {
      _handler: (
        ctx: unknown,
        args: { creditType: "llm" | "tts"; cost: number }
      ) => Promise<{ llmCreditsRemaining: number; ttsGenerationsRemaining: number; creditsMonth: string }>;
    })._handler;

    await expect(
      handler(createCtx(db, "clerk_1"), { creditType: "llm", cost: 0 })
    ).rejects.toThrow("Invalid credit cost");
    await expect(
      handler(createCtx(db, "clerk_1"), { creditType: "tts", cost: TTS_GENERATION_COST + 1 })
    ).rejects.toThrow("Invalid TTS credit cost");
    await expect(
      handler(createCtx(db, "clerk_1"), { creditType: "llm", cost: LLM_THEME_CREDITS + 10 })
    ).rejects.toThrow("Invalid LLM credit cost");

    const llmResult = await handler(createCtx(db, "clerk_1"), {
      creditType: "llm",
      cost: LLM_SMALL_ACTION_CREDITS,
    });
    expect(llmResult.llmCreditsRemaining).toBe(9);
    expect(llmResult.ttsGenerationsRemaining).toBe(3);

    const ttsResult = await handler(createCtx(db, "clerk_1"), {
      creditType: "tts",
      cost: TTS_GENERATION_COST,
    });
    expect(ttsResult.llmCreditsRemaining).toBe(9);
    expect(ttsResult.ttsGenerationsRemaining).toBe(2);
  });

  it("isUserOnline and updatePresence handle edge cases", async () => {
    expect(isUserOnline(undefined)).toBe(false);
    expect(isUserOnline(Date.now() - 60_000)).toBe(true);
    expect(isUserOnline(Date.now() - 10 * 60_000)).toBe(false);

    const db = new InMemoryDb();
    const handler = (updatePresence as unknown as {
      _handler: (ctx: unknown, args: NoArgs) => Promise<void>;
    })._handler;

    await expect(handler(createCtx(db, null), {})).resolves.toBeUndefined();

    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1", lastSeenAt: undefined }));

    const before = Date.now();
    await handler(createCtx(db, "clerk_1"), {});
    const after = Date.now();

    expect((db.users[0]?.lastSeenAt ?? 0) >= before).toBe(true);
    expect((db.users[0]?.lastSeenAt ?? 0) <= after).toBe(true);
  });
});
