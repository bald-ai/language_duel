import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  acceptChallenge,
  acceptChallengeFromNotification,
  declineChallenge,
  stopDuel,
} from "@/convex/lobby";
import {
  createAuthCtx,
  createIndexedQuery,
  findRowById,
  insertRow,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "name" | "imageUrl"
>;

type ThemeWord = {
  word: string;
  answer: string;
  wrongAnswers: string[];
};

type ThemeDoc = Pick<
  Doc<"themes">,
  "_id" | "_creationTime" | "name" | "description" | "createdAt" | "ownerId"
> & {
  words: ThemeWord[];
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

type Row = UserDoc | ThemeDoc | ChallengeDoc | DuelDoc | NotificationDoc;
type TableRows = Array<Row>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];
  public challenges: ChallengeDoc[] = [];
  public duels: DuelDoc[] = [];
  public notifications: NotificationDoc[] = [];

  private counters = {
    duels: 10,
    notifications: 10,
  };

  query(table: "users" | "themes" | "challenges" | "duels" | "notifications") {
    return createIndexedQuery([...this.getTable(table)] as TableRows);
  }

  async get(id: string): Promise<Row | null> {
    return findRowById<Row>(
      [this.users, this.themes, this.challenges, this.duels, this.notifications],
      id
    );
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    const table = this.findTableForId(id);
    patchRow<Row>(this.getTable(table) as TableRows, id, value);
  }

  async insert(
    table: "duels" | "notifications",
    value: Record<string, unknown>
  ): Promise<Id<"duels"> | Id<"notifications">> {
    if (table === "duels") {
      const inserted = insertRow<DuelDoc>(this.duels, "duel", this.counters.duels, value);
      this.counters.duels = inserted.nextCounter;
      return inserted.id as Id<"duels">;
    }

    const inserted = insertRow<NotificationDoc>(
      this.notifications,
      "notification",
      this.counters.notifications,
      value
    );
    this.counters.notifications = inserted.nextCounter;
    return inserted.id as Id<"notifications">;
  }

  private getTable(table: "users" | "themes" | "challenges" | "duels" | "notifications") {
    switch (table) {
      case "users":
        return this.users;
      case "themes":
        return this.themes;
      case "challenges":
        return this.challenges;
      case "duels":
        return this.duels;
      case "notifications":
        return this.notifications;
    }
  }

  private findTableForId(id: string): "users" | "themes" | "challenges" | "duels" | "notifications" {
    if (id.startsWith("user_")) return "users";
    if (id.startsWith("theme_")) return "themes";
    if (id.startsWith("challenge_")) return "challenges";
    if (id.startsWith("duel_")) return "duels";
    if (id.startsWith("notification_")) return "notifications";
    throw new Error(`Unsupported id: ${id}`);
  }
}

function createCtx(db: InMemoryDb, identitySubject: string | null) {
  return createAuthCtx(db, identitySubject);
}

function userDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "user@example.com",
    name: "User",
    imageUrl: "https://example.com/user.png",
    ...overrides,
  };
}

function themeDoc(overrides: Partial<ThemeDoc> = {}): ThemeDoc {
  return {
    _id: "theme_1" as Id<"themes">,
    _creationTime: 1,
    name: "Animals",
    description: "Words about animals",
    createdAt: 1,
    ownerId: "user_1" as Id<"users">,
    words: [
      { word: "cat", answer: "kocka", wrongAnswers: ["strom", "most", "more"] },
      { word: "dog", answer: "pes", wrongAnswers: ["dom", "vlak", "mesto"] },
      { word: "bird", answer: "vtak", wrongAnswers: ["auto", "pole", "rieka"] },
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
    status: "pending",
    duelDifficultyPreset: "hard",
    createdAt: 1,
    ...overrides,
  };
}

function duelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionWords: [],
    sourceType: "normal",
    status: "active",
    currentWordIndex: 0,
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    createdAt: 1,
    seed: 123,
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
    createdAt: 1,
    payload: {
      challengeId: "challenge_1" as Id<"challenges">,
      themeName: "Animals",
      duelDifficultyPreset: "hard",
    },
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("duel lifecycle handlers", () => {
  it("acceptChallenge creates a duel and resolves the challenge invite", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc());
    db.challenges.push(challengeDoc());

    const handler = (acceptChallenge as unknown as {
      _handler: (ctx: unknown, args: { challengeId: Id<"challenges"> }) => Promise<{ duelId: Id<"duels"> }>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_2"), {
      challengeId: "challenge_1" as Id<"challenges">,
    });

    expect(result.duelId).toBe("duel_10");
    expect(db.challenges[0]).toMatchObject({
      status: "accepted",
      acceptedAt: 5_000,
      resolvedAt: 5_000,
      duelId: "duel_10",
    });
    expect(db.duels[0]).toMatchObject({
      _id: "duel_10",
      challengeId: "challenge_1",
      challengerId: "user_1",
      opponentId: "user_2",
      sourceType: "normal",
      status: "active",
      currentWordIndex: 0,
      challengerScore: 0,
      opponentScore: 0,
      questionStartTime: 5_000,
    });
    expect(db.duels[0].sessionWords).toHaveLength(3);
    expect(db.duels[0].duelQuestions).toHaveLength(3);
  });

  it("acceptChallenge rejects non-pending challenges", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc());
    db.challenges.push(challengeDoc({ status: "accepted" }));

    const handler = (acceptChallenge as unknown as {
      _handler: (ctx: unknown, args: { challengeId: Id<"challenges"> }) => Promise<{ duelId: Id<"duels"> }>;
    })._handler;

    await expect(handler(createCtx(db, "clerk_2"), {
      challengeId: "challenge_1" as Id<"challenges">,
    })).rejects.toThrow("Challenge is not pending");
    expect(db.duels).toHaveLength(0);
  });

  it("acceptChallengeFromNotification creates a duel and dismisses the notification", async () => {
    vi.spyOn(Date, "now").mockReturnValue(7_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc());
    db.challenges.push(challengeDoc());
    db.notifications.push(notificationDoc());

    const handler = (acceptChallengeFromNotification as unknown as {
      _handler: (
        ctx: unknown,
        args: { notificationId: Id<"notifications"> }
      ) => Promise<{ success: boolean; duelId: Id<"duels"> }>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_2"), {
      notificationId: "notification_1" as Id<"notifications">,
    });

    expect(result).toEqual({ success: true, duelId: "duel_10" });
    expect(db.notifications[0].status).toBe("dismissed");
    expect(db.challenges[0].status).toBe("accepted");
    expect(db.challenges[0].duelId).toBe("duel_10");
    expect(db.duels[0].status).toBe("active");
  });

  it("declineChallenge resolves a pending invite without creating a duel", async () => {
    vi.spyOn(Date, "now").mockReturnValue(8_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.challenges.push(challengeDoc());

    const handler = (declineChallenge as unknown as {
      _handler: (ctx: unknown, args: { challengeId: Id<"challenges"> }) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_2"), {
      challengeId: "challenge_1" as Id<"challenges">,
    });

    expect(db.challenges[0]).toMatchObject({
      status: "declined",
      resolvedAt: 8_000,
    });
    expect(db.duels).toHaveLength(0);
  });

  it("stopDuel only patches active duels", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.duels.push(duelDoc({ status: "stopped" }));

    const handler = (stopDuel as unknown as {
      _handler: (ctx: unknown, args: { duelId: Id<"duels"> }) => Promise<void>;
    })._handler;
    const patchSpy = vi.spyOn(db, "patch");

    await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
    });

    expect(patchSpy).not.toHaveBeenCalled();

    db.duels[0].status = "active";

    await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
    });

    expect(patchSpy).toHaveBeenCalledTimes(1);
    expect(db.duels[0].status).toBe("stopped");
  });
});
