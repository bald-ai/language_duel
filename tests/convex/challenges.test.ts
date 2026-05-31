import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  acceptChallenge,
  cleanupExpiredChallengeInvites,
  createChallenge,
  createSelfDuel,
  declineChallenge,
} from "@/convex/challenges";
import { CHALLENGE_INVITE_TTL_MS } from "@/convex/constants";
import {
  createAuthCtx,
  createIndexedQuery,
  findRowById,
  insertRow,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email" | "name">;
type FriendDoc = Pick<Doc<"friends">, "_id" | "_creationTime" | "userId" | "friendId">;
type ThemeDoc = Pick<
  Doc<"themes">,
  "_id" | "_creationTime" | "name" | "description" | "contentType" | "createdAt" | "ownerId"
> & {
  words: Array<{ word: string; answer: string; wrongAnswers: string[] }>;
  sentenceRounds?: Array<{
    englishPrompt: string;
    spanishSentence: string;
    distractors: string[];
  }>;
};
type ChallengeDoc = Partial<Doc<"challenges">> &
  Pick<
    Doc<"challenges">,
    | "_id"
    | "_creationTime"
    | "challengerId"
    | "opponentId"
    | "themeIds"
    | "sourceType"
    | "status"
    | "createdAt"
  >;
type DuelDoc = Partial<Doc<"duels">> &
  Pick<
    Doc<"duels">,
    | "_id"
    | "_creationTime"
    | "challengerId"
    | "opponentId"
    | "themeIds"
    | "sessionWords"
    | "sourceType"
    | "status"
    | "currentWordIndex"
    | "challengerAnswered"
    | "opponentAnswered"
    | "challengerScore"
    | "opponentScore"
    | "createdAt"
    | "seed"
  >;
type NotificationDoc = Partial<Doc<"notifications">> &
  Pick<
    Doc<"notifications">,
    | "_id"
    | "_creationTime"
    | "type"
    | "fromUserId"
    | "toUserId"
    | "status"
    | "createdAt"
  >;
type SoloPracticeSessionDoc = Pick<Doc<"soloPracticeSessions">, "_id" | "_creationTime" | "userId" | "themeIds">;
type WeeklyGoalDoc = Pick<Doc<"weeklyGoals">, "_id" | "_creationTime" | "creatorId" | "partnerId" | "themes" | "status">;

type Row = UserDoc | FriendDoc | ThemeDoc | ChallengeDoc | DuelDoc | NotificationDoc | SoloPracticeSessionDoc | WeeklyGoalDoc;
type TableName =
  | "users"
  | "friends"
  | "themes"
  | "challenges"
  | "duels"
  | "notifications"
  | "soloPracticeSessions"
  | "weeklyGoals";

class InMemoryDb {
  public users: UserDoc[] = [];
  public friends: FriendDoc[] = [];
  public themes: ThemeDoc[] = [];
  public challenges: ChallengeDoc[] = [];
  public duels: DuelDoc[] = [];
  public notifications: NotificationDoc[] = [];
  public soloPracticeSessions: SoloPracticeSessionDoc[] = [];
  public weeklyGoals: WeeklyGoalDoc[] = [];

  private counters = {
    challenges: 10,
    duels: 20,
    notifications: 30,
  };

  query(table: TableName) {
    return createIndexedQuery([...this.getTable(table)] as Row[]);
  }

  async get(id: string): Promise<Row | null> {
    return findRowById<Row>(
      [
        this.users,
        this.friends,
        this.themes,
        this.challenges,
        this.duels,
        this.notifications,
        this.soloPracticeSessions,
        this.weeklyGoals,
      ],
      id
    );
  }

  async patch(id: string, value: Record<string, unknown>) {
    patchRow<Row>(this.getTable(this.findTableForId(id)) as Row[], id, value);
  }

  async insert(table: "challenges" | "duels" | "notifications", value: Record<string, unknown>) {
    if (table === "challenges") {
      const inserted = insertRow<ChallengeDoc>(this.challenges, "challenge", this.counters.challenges, value);
      this.counters.challenges = inserted.nextCounter;
      return inserted.id as Id<"challenges">;
    }
    if (table === "duels") {
      const inserted = insertRow<DuelDoc>(this.duels, "duel", this.counters.duels, value);
      this.counters.duels = inserted.nextCounter;
      return inserted.id as Id<"duels">;
    }
    const inserted = insertRow<NotificationDoc>(this.notifications, "notification", this.counters.notifications, value);
    this.counters.notifications = inserted.nextCounter;
    return inserted.id as Id<"notifications">;
  }

  private getTable(table: TableName) {
    switch (table) {
      case "users":
        return this.users;
      case "friends":
        return this.friends;
      case "themes":
        return this.themes;
      case "challenges":
        return this.challenges;
      case "duels":
        return this.duels;
      case "notifications":
        return this.notifications;
      case "soloPracticeSessions":
        return this.soloPracticeSessions;
      case "weeklyGoals":
        return this.weeklyGoals;
    }
  }

  private findTableForId(id: string): TableName {
    if (id.startsWith("user_")) return "users";
    if (id.startsWith("friend_")) return "friends";
    if (id.startsWith("theme_")) return "themes";
    if (id.startsWith("challenge_")) return "challenges";
    if (id.startsWith("duel_")) return "duels";
    if (id.startsWith("notification_")) return "notifications";
    if (id.startsWith("solo_")) return "soloPracticeSessions";
    if (id.startsWith("goal_")) return "weeklyGoals";
    throw new Error(`Unsupported id: ${id}`);
  }
}

function createCtx(db: InMemoryDb, identitySubject: string | null) {
  return createAuthCtx(db, identitySubject, {
    scheduler: { runAfter: async () => undefined },
  });
}

function userDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "user@example.com",
    name: "User",
    ...overrides,
  };
}

function friendDoc(overrides: Partial<FriendDoc> = {}): FriendDoc {
  return {
    _id: "friend_1" as Id<"friends">,
    _creationTime: 1,
    userId: "user_1" as Id<"users">,
    friendId: "user_2" as Id<"users">,
    ...overrides,
  };
}

function themeDoc(overrides: Partial<ThemeDoc> = {}): ThemeDoc {
  return {
    _id: "theme_1" as Id<"themes">,
    _creationTime: 1,
    name: "Animals",
    description: "Animals",
    contentType: "word",
    createdAt: 1,
    ownerId: "user_1" as Id<"users">,
    words: [
      { word: "cat", answer: "gato", wrongAnswers: ["perro", "pez", "ave"] },
      { word: "dog", answer: "perro", wrongAnswers: ["gato", "pez", "ave"] },
    ],
    ...overrides,
  };
}

function challengeDoc(overrides: Partial<ChallengeDoc> = {}): ChallengeDoc {
  return {
    _id: "challenge_1" as Id<"challenges">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sourceType: "normal",
    duelMode: "pvp",
    status: "pending",
    createdAt: 1_000,
    ...overrides,
  };
}

function notificationDoc(overrides: Partial<NotificationDoc> = {}): NotificationDoc {
  return {
    _id: "notification_1" as Id<"notifications">,
    _creationTime: 1,
    type: "challenge_invite",
    fromUserId: "user_1" as Id<"users">,
    toUserId: "user_2" as Id<"users">,
    status: "pending",
    createdAt: 1_000,
    payload: { challengeId: "challenge_1" as Id<"challenges">, duelMode: "pvp" },
    ...overrides,
  };
}

function seedUsersAndTheme(db: InMemoryDb) {
  db.users.push(
    userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
    userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
  );
  db.themes.push(themeDoc());
}

const createChallengeHandler = (createChallenge as unknown as {
  _handler: (
    ctx: unknown,
    args: {
      opponentId: Id<"users">;
      themeIds: Id<"themes">[];
      duelDifficultyPreset?: "easy" | "medium" | "hard";
      duelMode: "pvp" | "pve" | "relay";
    }
  ) => Promise<Id<"challenges">>;
})._handler;
const acceptChallengeHandler = (acceptChallenge as unknown as {
  _handler: (ctx: unknown, args: { challengeId: Id<"challenges"> }) => Promise<{ duelId: Id<"duels"> }>;
})._handler;
const declineChallengeHandler = (declineChallenge as unknown as {
  _handler: (ctx: unknown, args: { challengeId: Id<"challenges"> }) => Promise<void>;
})._handler;
const cleanupExpiredChallengeInvitesHandler = (cleanupExpiredChallengeInvites as unknown as {
  _handler: (ctx: unknown, args: Record<string, never>) => Promise<void>;
})._handler;
const createSelfDuelHandler = (createSelfDuel as unknown as {
  _handler: (
    ctx: unknown,
    args: {
      themeIds: Id<"themes">[];
      duelDifficultyPreset?: "easy" | "medium" | "hard";
    }
  ) => Promise<{ duelId: Id<"duels"> }>;
})._handler;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("challenge backend", () => {
  it("creates a challenge for friends and sends a pending invite notification", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    const db = new InMemoryDb();
    seedUsersAndTheme(db);
    db.friends.push(friendDoc());

    const challengeId = await createChallengeHandler(createCtx(db, "clerk_1"), {
      opponentId: "user_2" as Id<"users">,
      themeIds: ["theme_1" as Id<"themes">, "theme_1" as Id<"themes">],
      duelDifficultyPreset: "medium",
      duelMode: "pve",
    });

    expect(challengeId).toBe("challenge_10");
    expect(db.challenges[0]).toMatchObject({
      challengerId: "user_1",
      opponentId: "user_2",
      themeIds: ["theme_1"],
      status: "pending",
      duelDifficultyPreset: "medium",
      duelMode: "pve",
      createdAt: 10_000,
    });
    expect(db.notifications[0]).toMatchObject({
      type: "challenge_invite",
      fromUserId: "user_1",
      toUserId: "user_2",
      status: "pending",
      payload: expect.objectContaining({ duelMode: "pve" }),
    });
  });

  it("creates a relay challenge with sentence themes", async () => {
    // Relay now supports sentence decks, so a relay challenge over a sentence
    // theme is accepted like any other.
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    const db = new InMemoryDb();
    seedUsersAndTheme(db);
    db.friends.push(friendDoc());
    db.themes[0] = themeDoc({
      contentType: "sentence",
      words: [],
      sentenceRounds: [
        {
          englishPrompt: "I eat bread",
          spanishSentence: "Yo como pan",
          distractors: ["tú", "bebes"],
        },
      ],
    });

    const challengeId = await createChallengeHandler(createCtx(db, "clerk_1"), {
      opponentId: "user_2" as Id<"users">,
      themeIds: ["theme_1" as Id<"themes">],
      duelMode: "relay",
    });

    expect(challengeId).toBe("challenge_10");
    expect(db.challenges[0]).toMatchObject({
      status: "pending",
      duelMode: "relay",
      themeIds: ["theme_1"],
    });
  });

  it("rejects challenge creation when opponent is missing, not a friend, or self", async () => {
    const db = new InMemoryDb();
    seedUsersAndTheme(db);

    await expect(
      createChallengeHandler(createCtx(db, "clerk_1"), {
        opponentId: "user_missing" as Id<"users">,
        themeIds: ["theme_1" as Id<"themes">],
        duelMode: "pvp",
      })
    ).rejects.toThrow("Opponent not found");

    await expect(
      createChallengeHandler(createCtx(db, "clerk_1"), {
        opponentId: "user_2" as Id<"users">,
        themeIds: ["theme_1" as Id<"themes">],
        duelMode: "pvp",
      })
    ).rejects.toThrow("You can only challenge friends");

    await expect(
      createChallengeHandler(createCtx(db, "clerk_1"), {
        opponentId: "user_1" as Id<"users">,
        themeIds: ["theme_1" as Id<"themes">],
        duelMode: "pvp",
      })
    ).rejects.toThrow("Cannot challenge yourself");
  });

  it("accepts a pending challenge for the recipient and creates a duel", async () => {
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    const db = new InMemoryDb();
    seedUsersAndTheme(db);
    db.challenges.push(challengeDoc({ duelMode: "pve" }));
    db.notifications.push(notificationDoc({ payload: { challengeId: "challenge_1" as Id<"challenges">, duelMode: "pve" } }));

    const result = await acceptChallengeHandler(createCtx(db, "clerk_2"), {
      challengeId: "challenge_1" as Id<"challenges">,
    });

    expect(result).toEqual({ duelId: "duel_20" });
    expect(db.challenges[0]).toMatchObject({
      status: "accepted",
      acceptedAt: 20_000,
      resolvedAt: 20_000,
      duelId: "duel_20",
    });
    expect(db.duels[0]).toMatchObject({
      challengerId: "user_1",
      opponentId: "user_2",
      status: "active",
      sourceType: "normal",
      duelMode: "pve",
      hintPoolUsed: [],
      sentenceHintPoolUsed: [],
      currentQuestionHintFired: false,
    });
    expect(db.notifications[0].status).toBe("dismissed");
  });

  it("accepts a relay challenge whose themes build sentence rounds into a relay duel", async () => {
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    const db = new InMemoryDb();
    seedUsersAndTheme(db);
    db.themes[0] = themeDoc({
      contentType: "sentence",
      words: [],
      sentenceRounds: [
        {
          englishPrompt: "I eat bread",
          spanishSentence: "Yo como pan",
          distractors: ["tú", "bebes"],
        },
      ],
    });
    db.challenges.push(challengeDoc({ duelMode: "relay" }));
    db.notifications.push(notificationDoc({ payload: { challengeId: "challenge_1" as Id<"challenges">, duelMode: "relay" } }));

    const result = await acceptChallengeHandler(createCtx(db, "clerk_2"), {
      challengeId: "challenge_1" as Id<"challenges">,
    });

    expect(result).toEqual({ duelId: "duel_20" });
    expect(db.challenges[0]).toMatchObject({ status: "accepted", duelId: "duel_20" });
    expect(db.duels[0]).toMatchObject({ duelMode: "relay", status: "active" });
    expect(db.notifications[0].status).toBe("dismissed");
  });

  it("rejects expired and wrong-recipient accept attempts", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000 + CHALLENGE_INVITE_TTL_MS + 1);
    const db = new InMemoryDb();
    seedUsersAndTheme(db);
    db.users.push(userDoc({ _id: "user_3" as Id<"users">, clerkId: "clerk_3" }));
    db.challenges.push(challengeDoc());
    db.notifications.push(notificationDoc());

    await expect(
      acceptChallengeHandler(createCtx(db, "clerk_1"), {
        challengeId: "challenge_1" as Id<"challenges">,
      })
    ).rejects.toThrow("Only the invited opponent can respond to this challenge");

    await expect(
      acceptChallengeHandler(createCtx(db, "clerk_3"), {
        challengeId: "challenge_1" as Id<"challenges">,
      })
    ).rejects.toThrow("User not part of this challenge");

    await expect(
      acceptChallengeHandler(createCtx(db, "clerk_2"), {
        challengeId: "challenge_1" as Id<"challenges">,
      })
    ).rejects.toThrow("Challenge has expired");
    expect(db.challenges[0]).toMatchObject({ status: "pending" });
    expect(db.duels).toHaveLength(0);
    expect(db.notifications[0].status).toBe("pending");
  });

  it("declines a pending challenge for the recipient and rejects wrong-recipient decline", async () => {
    vi.spyOn(Date, "now").mockReturnValue(30_000);
    const db = new InMemoryDb();
    seedUsersAndTheme(db);
    db.users.push(userDoc({ _id: "user_3" as Id<"users">, clerkId: "clerk_3" }));
    db.challenges.push(challengeDoc());
    db.notifications.push(notificationDoc());

    await expect(
      declineChallengeHandler(createCtx(db, "clerk_1"), {
        challengeId: "challenge_1" as Id<"challenges">,
      })
    ).rejects.toThrow("Only the invited opponent can respond to this challenge");

    await expect(
      declineChallengeHandler(createCtx(db, "clerk_3"), {
        challengeId: "challenge_1" as Id<"challenges">,
      })
    ).rejects.toThrow("User not part of this challenge");

    await declineChallengeHandler(createCtx(db, "clerk_2"), {
      challengeId: "challenge_1" as Id<"challenges">,
    });

    expect(db.challenges[0]).toMatchObject({ status: "declined", resolvedAt: 30_000 });
    expect(db.notifications[0].status).toBe("dismissed");
  });

  it("auto-expires old pending challenges from challenge records", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000 + CHALLENGE_INVITE_TTL_MS + 1);
    const db = new InMemoryDb();
    seedUsersAndTheme(db);
    db.challenges.push(
      challengeDoc({ _id: "challenge_1" as Id<"challenges">, createdAt: 1_000 }),
      challengeDoc({ _id: "challenge_2" as Id<"challenges">, createdAt: 1_000 + CHALLENGE_INVITE_TTL_MS })
    );
    db.notifications.push(notificationDoc({ _id: "notification_1" as Id<"notifications"> }));

    await cleanupExpiredChallengeInvitesHandler(createCtx(db, "clerk_1"), {});

    expect(db.challenges[0]).toMatchObject({ status: "cancelled", resolvedAt: 1_000 + CHALLENGE_INVITE_TTL_MS + 1 });
    expect(db.challenges[1].status).toBe("pending");
    expect(db.notifications[0].status).toBe("dismissed");
  });
});

describe("createSelfDuel", () => {
  it("creates a self-duel as a normal pve duel without challenges or notifications", async () => {
    vi.spyOn(Date, "now").mockReturnValue(40_000);
    const db = new InMemoryDb();
    seedUsersAndTheme(db);

    const result = await createSelfDuelHandler(createCtx(db, "clerk_1"), {
      themeIds: ["theme_1" as Id<"themes">, "theme_1" as Id<"themes">],
      duelDifficultyPreset: "medium",
    });

    expect(result.duelId).toBe("duel_20");
    expect(db.challenges).toHaveLength(0);
    expect(db.notifications).toHaveLength(0);
    expect(db.duels[0]).toMatchObject({
      challengerId: "user_1",
      opponentId: "user_1",
      status: "active",
      sourceType: "normal",
      duelMode: "pve",
      duelDifficultyPreset: "medium",
      createdAt: 40_000,
    });
    // Self-duels force PvE, so they never carry relay turn state.
    expect(db.duels[0].relayPicker).toBeUndefined();
  });

  it("rejects empty themeIds with INVALID_INPUT", async () => {
    const db = new InMemoryDb();
    seedUsersAndTheme(db);

    await expect(
      createSelfDuelHandler(createCtx(db, "clerk_1"), { themeIds: [] })
    ).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
  });

  it("rejects inaccessible themes with NOT_FOUND", async () => {
    const db = new InMemoryDb();
    seedUsersAndTheme(db);

    await expect(
      createSelfDuelHandler(createCtx(db, "clerk_1"), {
        themeIds: ["theme_missing" as Id<"themes">],
      })
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  });
});
