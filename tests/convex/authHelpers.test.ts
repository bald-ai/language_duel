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
  isDuelChallenging,
  isDuelLearning,
} from "@/convex/helpers/auth";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email">;

type ChallengeDoc = Pick<
  Doc<"challenges">,
  "_id" | "_creationTime" | "challengerId" | "opponentId" | "status" | "challengerAnswered" | "opponentAnswered"
>;

type IndexFilters = Record<string, unknown>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public challenges: ChallengeDoc[] = [];

  query(table: "users") {
    return {
      withIndex: (
        indexName: string,
        builder: (q: { eq: (field: string, value: unknown) => unknown }) => unknown
      ) => {
        const filters: IndexFilters = {};
        const queryBuilder = {
          eq: (field: string, value: unknown) => {
            filters[field] = value;
            return queryBuilder;
          },
        };
        builder(queryBuilder);

        return {
          first: async () => this.firstByIndex(table, indexName, filters),
        };
      },
    };
  }

  async get(id: Id<"challenges">): Promise<ChallengeDoc | null> {
    return this.challenges.find((challenge) => challenge._id === id) ?? null;
  }

  private async firstByIndex(table: "users", indexName: string, filters: IndexFilters) {
    if (table === "users" && indexName === "by_clerk_id") {
      const clerkId = filters.clerkId as string;
      return this.users.find((user) => user.clerkId === clerkId) ?? null;
    }

    throw new Error(`Unsupported index lookup: ${table}.${indexName}`);
  }
}

function createCtx(db: InMemoryDb, identity: { subject: string } | null) {
  return {
    db,
    auth: {
      getUserIdentity: async () => identity,
    },
  };
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

function challengeDoc(overrides: Partial<ChallengeDoc> = {}): ChallengeDoc {
  return {
    _id: "challenge_1" as Id<"challenges">,
    _creationTime: Date.now(),
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    status: "challenging",
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

  it("getDuelParticipant throws for missing challenge and non-participant", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));

    await expect(
      getDuelParticipant(
        createCtx(db, { subject: "clerk_1" }) as never,
        "challenge_missing" as Id<"challenges">
      )
    ).rejects.toThrow("Challenge not found");

    db.challenges.push(
      challengeDoc({
        _id: "challenge_2" as Id<"challenges">,
        challengerId: "user_9" as Id<"users">,
        opponentId: "user_8" as Id<"users">,
      })
    );

    await expect(
      getDuelParticipant(
        createCtx(db, { subject: "clerk_1" }) as never,
        "challenge_2" as Id<"challenges">
      )
    ).rejects.toThrow("User not part of this challenge");
  });

  it("getDuelParticipant returns challenger role flags", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.challenges.push(
      challengeDoc({
        _id: "challenge_1" as Id<"challenges">,
        challengerId: "user_1" as Id<"users">,
        opponentId: "user_2" as Id<"users">,
      })
    );

    const result = await getDuelParticipant(
      createCtx(db, { subject: "clerk_1" }) as never,
      "challenge_1" as Id<"challenges">
    );

    expect(result.playerRole).toBe("challenger");
    expect(result.isChallenger).toBe(true);
    expect(result.isOpponent).toBe(false);
  });

  it("getDuelParticipantOrNull returns null when auth/duel/participant checks fail", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.challenges.push(
      challengeDoc({
        _id: "challenge_3" as Id<"challenges">,
        challengerId: "user_9" as Id<"users">,
        opponentId: "user_8" as Id<"users">,
      })
    );

    const unauth = await getDuelParticipantOrNull(
      createCtx(db, null) as never,
      "challenge_3" as Id<"challenges">
    );
    expect(unauth).toBeNull();

    const missingDuel = await getDuelParticipantOrNull(
      createCtx(db, { subject: "clerk_1" }) as never,
      "challenge_missing" as Id<"challenges">
    );
    expect(missingDuel).toBeNull();

    const nonParticipant = await getDuelParticipantOrNull(
      createCtx(db, { subject: "clerk_1" }) as never,
      "challenge_3" as Id<"challenges">
    );
    expect(nonParticipant).toBeNull();
  });

  it("helper predicates return expected role/status results", () => {
    const duel = challengeDoc({
      status: "accepted",
      challengerAnswered: true,
      opponentAnswered: false,
    });

    expect(getOtherRole("challenger")).toBe("opponent");
    expect(getOtherRole("opponent")).toBe("challenger");

    expect(isDuelActive(duel as Doc<"challenges">)).toBe(true);
    expect(
      isDuelActive(challengeDoc({ status: "pending" }) as Doc<"challenges">)
    ).toBe(false);

    expect(
      isDuelLearning(challengeDoc({ status: "learning" }) as Doc<"challenges">)
    ).toBe(true);
    expect(
      isDuelChallenging(challengeDoc({ status: "challenging" }) as Doc<"challenges">)
    ).toBe(true);

    expect(hasPlayerAnswered(duel as Doc<"challenges">, "challenger")).toBe(true);
    expect(hasPlayerAnswered(duel as Doc<"challenges">, "opponent")).toBe(false);
  });
});
