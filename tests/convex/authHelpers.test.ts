import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  getAuthenticatedUser,
  getAuthenticatedUserOrNull,
  getDuelParticipant,
  getDuelParticipantOrNull,
  getOtherRole,
  hasPlayerAnswered,
  isDuelActive,
} from "@/convex/helpers/auth";
import {
  createIdentityCtx,
  createIndexedQuery,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email">;

type DuelDoc = Pick<
  Doc<"duels">,
  "_id" | "_creationTime" | "challengerId" | "opponentId" | "status" | "challengerAnswered" | "opponentAnswered"
>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public duels: DuelDoc[] = [];

  query(table: "users") {
    return createIndexedQuery(table === "users" ? this.users : []);
  }

  async get(id: Id<"duels">): Promise<DuelDoc | null> {
    return this.duels.find((duel) => duel._id === id) ?? null;
  }
}

function createCtx(db: InMemoryDb, identity: { subject: string } | null) {
  return createIdentityCtx(db, identity);
}

function userDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: Date.now(),
    clerkId: "clerk_1",
    email: "test@example.com",
    ...overrides,
  };
}

function duelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: Date.now(),
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    status: "active",
    challengerAnswered: false,
    opponentAnswered: false,
    ...overrides,
  };
}

describe("auth helpers", () => {
  it("getAuthenticatedUser throws when identity is missing", async () => {
    const db = new InMemoryDb();
    await expect(getAuthenticatedUser(createCtx(db, null) as never)).rejects.toThrow("Unauthorized");
  });

  it("getAuthenticatedUser throws when user does not exist", async () => {
    const db = new InMemoryDb();
    await expect(
      getAuthenticatedUser(createCtx(db, { subject: "missing" }) as never)
    ).rejects.toThrow("User not found");
  });

  it("getAuthenticatedUser returns user and clerkId", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ clerkId: "clerk_123" }));

    const result = await getAuthenticatedUser(
      createCtx(db, { subject: "clerk_123" }) as never
    );

    expect(result.clerkId).toBe("clerk_123");
    expect(result.user._id).toBe("user_1");
  });

  it("getAuthenticatedUserOrNull returns null when unauthenticated or missing user", async () => {
    const db = new InMemoryDb();

    const unauth = await getAuthenticatedUserOrNull(createCtx(db, null) as never);
    expect(unauth).toBeNull();

    const missing = await getAuthenticatedUserOrNull(
      createCtx(db, { subject: "missing" }) as never
    );
    expect(missing).toBeNull();
  });

  it("getDuelParticipant throws for missing duel and non-participant", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));

    await expect(
      getDuelParticipant(
        createCtx(db, { subject: "clerk_1" }) as never,
        "duel_missing" as Id<"duels">
      )
    ).rejects.toThrow("Duel not found");

    db.duels.push(
      duelDoc({
        _id: "duel_2" as Id<"duels">,
        challengerId: "user_9" as Id<"users">,
        opponentId: "user_8" as Id<"users">,
      })
    );

    await expect(
      getDuelParticipant(
        createCtx(db, { subject: "clerk_1" }) as never,
        "duel_2" as Id<"duels">
      )
    ).rejects.toThrow("User not part of this duel");
  });

  it("getDuelParticipant returns challenger role flags", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.duels.push(
      duelDoc({
        _id: "duel_1" as Id<"duels">,
        challengerId: "user_1" as Id<"users">,
        opponentId: "user_2" as Id<"users">,
      })
    );

    const result = await getDuelParticipant(
      createCtx(db, { subject: "clerk_1" }) as never,
      "duel_1" as Id<"duels">
    );

    expect(result.playerRole).toBe("challenger");
    expect(result.isChallenger).toBe(true);
    expect(result.isOpponent).toBe(false);
  });

  it("getDuelParticipantOrNull returns null when auth/duel/participant checks fail", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.duels.push(
      duelDoc({
        _id: "duel_3" as Id<"duels">,
        challengerId: "user_9" as Id<"users">,
        opponentId: "user_8" as Id<"users">,
      })
    );

    const unauth = await getDuelParticipantOrNull(
      createCtx(db, null) as never,
      "duel_3" as Id<"duels">
    );
    expect(unauth).toBeNull();

    const missingDuel = await getDuelParticipantOrNull(
      createCtx(db, { subject: "clerk_1" }) as never,
      "duel_missing" as Id<"duels">
    );
    expect(missingDuel).toBeNull();

    const nonParticipant = await getDuelParticipantOrNull(
      createCtx(db, { subject: "clerk_1" }) as never,
      "duel_3" as Id<"duels">
    );
    expect(nonParticipant).toBeNull();
  });

  it("helper predicates return expected role/status results", () => {
    const duel = duelDoc({
      status: "active",
      challengerAnswered: true,
      opponentAnswered: false,
    });

    expect(getOtherRole("challenger")).toBe("opponent");
    expect(getOtherRole("opponent")).toBe("challenger");

    expect(isDuelActive(duel as Doc<"duels">)).toBe(true);
    expect(isDuelActive(duelDoc({ status: "completed" }) as Doc<"duels">)).toBe(false);

    expect(hasPlayerAnswered(duel as Doc<"duels">, "challenger")).toBe(true);
    expect(hasPlayerAnswered(duel as Doc<"duels">, "opponent")).toBe(false);
  });
});
