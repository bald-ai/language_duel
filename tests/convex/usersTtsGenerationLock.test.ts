import { describe, expect, it } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { acquireTtsGenerationLock, releaseTtsGenerationLock } from "@/convex/users";

type UserDoc = {
  _id: Id<"users">;
  _creationTime: number;
  clerkId: string;
  email: string;
  ttsGenerationLockToken?: string;
  ttsGenerationLockExpiresAt?: number;
};

class InMemoryDb {
  public users: UserDoc[] = [];

  async get(id: Id<"users">): Promise<UserDoc | null> {
    return this.users.find((user) => user._id === id) ?? null;
  }

  async patch(id: Id<"users">, value: Partial<UserDoc>): Promise<void> {
    const index = this.users.findIndex((user) => user._id === id);
    if (index < 0) {
      throw new Error("User not found");
    }

    const current = this.users[index]!;
    const next: UserDoc = { ...current };

    for (const [key, incoming] of Object.entries(value) as Array<[keyof UserDoc, UserDoc[keyof UserDoc]]>) {
      if (incoming === undefined) {
        delete (next as Record<string, unknown>)[key];
      } else {
        (next as Record<string, unknown>)[key] = incoming;
      }
    }

    this.users[index] = next;
  }
}

function createCtx(db: InMemoryDb) {
  return { db };
}

describe("users TTS generation lock", () => {
  it("acquires lock when user has no active lock", async () => {
    const db = new InMemoryDb();
    const userId = "user_1" as Id<"users">;
    db.users.push({
      _id: userId,
      _creationTime: Date.now(),
      clerkId: "clerk_1",
      email: "test@example.com",
    });

    const handler = (
      acquireTtsGenerationLock as unknown as {
        _handler: (ctx: unknown, args: unknown) => Promise<{ expiresAt: number }>;
      }
    )._handler;

    const before = Date.now();
    const result = await handler(createCtx(db), {
      userId,
      token: "token_a",
      lockMs: 60_000,
    });
    const after = Date.now();

    const user = await db.get(userId);
    expect(user?.ttsGenerationLockToken).toBe("token_a");
    expect(user?.ttsGenerationLockExpiresAt).toBeDefined();
    expect(result.expiresAt).toBeGreaterThanOrEqual(before + 59_000);
    expect(result.expiresAt).toBeLessThanOrEqual(after + 61_000);
  });

  it("rejects acquire when another active lock exists", async () => {
    const db = new InMemoryDb();
    const userId = "user_2" as Id<"users">;
    db.users.push({
      _id: userId,
      _creationTime: Date.now(),
      clerkId: "clerk_2",
      email: "test@example.com",
      ttsGenerationLockToken: "token_active",
      ttsGenerationLockExpiresAt: Date.now() + 120_000,
    });

    const handler = (
      acquireTtsGenerationLock as unknown as {
        _handler: (ctx: unknown, args: unknown) => Promise<{ expiresAt: number }>;
      }
    )._handler;

    await expect(
      handler(createCtx(db), {
        userId,
        token: "token_other",
        lockMs: 60_000,
      })
    ).rejects.toThrow("TTS generation is already running for this user");
  });

  it("re-acquires lock when previous lock expired", async () => {
    const db = new InMemoryDb();
    const userId = "user_3" as Id<"users">;
    db.users.push({
      _id: userId,
      _creationTime: Date.now(),
      clerkId: "clerk_3",
      email: "test@example.com",
      ttsGenerationLockToken: "token_old",
      ttsGenerationLockExpiresAt: Date.now() - 1_000,
    });

    const acquireHandler = (
      acquireTtsGenerationLock as unknown as {
        _handler: (ctx: unknown, args: unknown) => Promise<{ expiresAt: number }>;
      }
    )._handler;

    await acquireHandler(createCtx(db), {
      userId,
      token: "token_new",
      lockMs: 30_000,
    });

    const user = await db.get(userId);
    expect(user?.ttsGenerationLockToken).toBe("token_new");
    expect((user?.ttsGenerationLockExpiresAt ?? 0) > Date.now()).toBe(true);
  });

  it("releases only when token matches", async () => {
    const db = new InMemoryDb();
    const userId = "user_4" as Id<"users">;
    db.users.push({
      _id: userId,
      _creationTime: Date.now(),
      clerkId: "clerk_4",
      email: "test@example.com",
      ttsGenerationLockToken: "token_active",
      ttsGenerationLockExpiresAt: Date.now() + 60_000,
    });

    const releaseHandler = (
      releaseTtsGenerationLock as unknown as {
        _handler: (ctx: unknown, args: unknown) => Promise<{ released: boolean }>;
      }
    )._handler;

    const wrongTokenResult = await releaseHandler(createCtx(db), {
      userId,
      token: "token_wrong",
    });
    expect(wrongTokenResult.released).toBe(false);
    expect((await db.get(userId))?.ttsGenerationLockToken).toBe("token_active");

    const correctTokenResult = await releaseHandler(createCtx(db), {
      userId,
      token: "token_active",
    });
    expect(correctTokenResult.released).toBe(true);

    const userAfter = await db.get(userId);
    expect(userAfter?.ttsGenerationLockToken).toBeUndefined();
    expect(userAfter?.ttsGenerationLockExpiresAt).toBeUndefined();
  });
});
