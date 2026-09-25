import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@/convex/_generated/dataModel";
import { acquireTtsGenerationLock, releaseTtsGenerationLock } from "@/convex/ttsGenerationLocks";
import { patchRow } from "./testUtils/inMemoryDb";

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
    patchRow(this.users, id, value as Record<string, unknown>);
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


describe("TTS lock lease boundaries", () => {
  afterEach(() => vi.useRealTimers());
  const acquire = (acquireTtsGenerationLock as unknown as { _handler: (ctx: unknown, args: { userId: Id<"users">; token: string; lockMs?: number }) => Promise<{ expiresAt: number }> })._handler;
  const release = (releaseTtsGenerationLock as unknown as { _handler: (ctx: unknown, args: { userId: Id<"users">; token: string }) => Promise<{ released: boolean }> })._handler;
  const userId = "lease_user" as Id<"users">;
  function fixture() {
    vi.useFakeTimers(); vi.setSystemTime(2_000_000_000_000);
    const db = new InMemoryDb();
    db.users.push({ _id: userId, _creationTime: 1, clerkId: "clerk", email: "user@example.test" });
    return db;
  }
  it.each([[undefined, 600_000], [0, 600_000], [-1, 600_000], [900_000, 600_000], [1234.9, 1234]] as const)("normalizes requested lease %s to %s milliseconds", async (lockMs, expected) => {
    const db = fixture();
    await expect(acquire({ db }, { userId, token: "lease", lockMs })).resolves.toEqual({ expiresAt: Date.now() + expected });
    expect(db.users[0]).toMatchObject({ ttsGenerationLockToken: "lease", ttsGenerationLockExpiresAt: Date.now() + expected });
  });
  it("lets the same token renew an active lease", async () => {
    const db = fixture(); Object.assign(db.users[0], { ttsGenerationLockToken: "same", ttsGenerationLockExpiresAt: Date.now() + 1000 });
    await expect(acquire({ db }, { userId, token: "same", lockMs: 2000 })).resolves.toEqual({ expiresAt: Date.now() + 2000 });
  });
  it("allows replacement exactly at expiry", async () => {
    const db = fixture(); Object.assign(db.users[0], { ttsGenerationLockToken: "old", ttsGenerationLockExpiresAt: Date.now() });
    await expect(acquire({ db }, { userId, token: "replacement", lockMs: 1000 })).resolves.toEqual({ expiresAt: Date.now() + 1000 });
    expect(db.users[0].ttsGenerationLockToken).toBe("replacement");
  });
  it("rejects acquisition for a deleted user but safely reports an absent release", async () => {
    const db = fixture(); db.users.length = 0;
    await expect(acquire({ db }, { userId, token: "lease" })).rejects.toThrow("User not found");
    await expect(release({ db }, { userId, token: "lease" })).resolves.toEqual({ released: false });
  });
});
