import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { SEED_XOR_MASK } from "@/convex/constants";
import { initializeDuelChallenge } from "@/convex/gameplay";
import { acceptDuel, acceptDuelChallenge } from "@/convex/lobby";
import { startScheduledDuel } from "@/convex/scheduledDuels";

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
    | "sessionWords"
    | "status"
    | "currentWordIndex"
    | "challengerAnswered"
    | "opponentAnswered"
    | "challengerScore"
    | "opponentScore"
    | "createdAt"
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

type ScheduledDuelDoc = Partial<Doc<"scheduledDuels">> &
  Pick<
    Doc<"scheduledDuels">,
    | "_id"
    | "_creationTime"
    | "proposerId"
    | "recipientId"
    | "themeIds"
    | "scheduledTime"
    | "status"
    | "createdAt"
    | "updatedAt"
  >;

type TableName = "users" | "themes" | "challenges" | "notifications" | "scheduledDuels";
type Row = UserDoc | ThemeDoc | ChallengeDoc | NotificationDoc | ScheduledDuelDoc;
type IndexFilters = Record<string, unknown>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public themes: ThemeDoc[] = [];
  public challenges: ChallengeDoc[] = [];
  public notifications: NotificationDoc[] = [];
  public scheduledDuels: ScheduledDuelDoc[] = [];

  private counters = {
    challenges: 10,
    notifications: 10,
  };

  query(table: TableName) {
    const rows = () => [...this.getTable(table)];

    const createResult = (resultRows: Row[]) => ({
      collect: async () => resultRows,
      first: async () => resultRows[0] ?? null,
      unique: async () => resultRows[0] ?? null,
    });

    return {
      ...createResult(rows()),
      withIndex: (
        _indexName: string,
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

        const filtered = rows().filter((row) =>
          Object.entries(filters).every(([field, value]) =>
            (row as Record<string, unknown>)[field] === value
          )
        );

        return createResult(filtered);
      },
    };
  }

  async get(id: string): Promise<Row | null> {
    for (const table of [
      this.users,
      this.themes,
      this.challenges,
      this.notifications,
      this.scheduledDuels,
    ]) {
      const match = table.find((row) => row._id === id);
      if (match) return match;
    }

    return null;
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    const table = this.findTableForId(id);
    const rows = this.getTable(table);
    const index = rows.findIndex((row) => row._id === id);
    if (index < 0) throw new Error(`Row not found: ${id}`);
    rows[index] = {
      ...rows[index],
      ...value,
    } as Row;
  }

  async insert(
    table: "challenges" | "notifications",
    value: Record<string, unknown>
  ): Promise<Id<"challenges"> | Id<"notifications">> {
    const id = `${table === "challenges" ? "challenge" : "notification"}_${this.counters[table]++}` as
      | Id<"challenges">
      | Id<"notifications">;

    const row = {
      _id: id,
      _creationTime: Date.now(),
      ...value,
    };

    if (table === "challenges") {
      this.challenges.push(row as ChallengeDoc);
    } else {
      this.notifications.push(row as NotificationDoc);
    }

    return id;
  }

  private getTable(table: TableName) {
    switch (table) {
      case "users":
        return this.users;
      case "themes":
        return this.themes;
      case "challenges":
        return this.challenges;
      case "notifications":
        return this.notifications;
      case "scheduledDuels":
        return this.scheduledDuels;
    }
  }

  private findTableForId(id: string): TableName {
    if (id.startsWith("user_")) return "users";
    if (id.startsWith("theme_")) return "themes";
    if (id.startsWith("challenge_")) return "challenges";
    if (id.startsWith("notification_")) return "notifications";
    if (id.startsWith("scheduled_")) return "scheduledDuels";
    throw new Error(`Unsupported id: ${id}`);
  }
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
    sessionWords: [
      {
        word: "cat",
        answer: "kocka",
        wrongAnswers: ["strom", "most", "more"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
      {
        word: "dog",
        answer: "pes",
        wrongAnswers: ["dom", "vlak", "mesto"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
      {
        word: "bird",
        answer: "vtak",
        wrongAnswers: ["auto", "pole", "rieka"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    status: "pending",
    currentWordIndex: 0,
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    createdAt: 1,
    ...overrides,
  };
}

function notificationDoc(overrides: Partial<NotificationDoc> = {}): NotificationDoc {
  return {
    _id: "notification_1" as Id<"notifications">,
    _creationTime: 1,
    type: "duel_challenge",
    fromUserId: "user_1" as Id<"users">,
    toUserId: "user_2" as Id<"users">,
    status: "pending",
    createdAt: 1,
    payload: {
      challengeId: "challenge_1" as Id<"challenges">,
    },
    ...overrides,
  };
}

function scheduledDuelDoc(overrides: Partial<ScheduledDuelDoc> = {}): ScheduledDuelDoc {
  return {
    _id: "scheduled_1" as Id<"scheduledDuels">,
    _creationTime: 1,
    proposerId: "user_1" as Id<"users">,
    recipientId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    scheduledTime: 10_000,
    status: "accepted",
    createdAt: 1,
    updatedAt: 1,
    proposerReady: true,
    recipientReady: true,
    ...overrides,
  };
}

describe("duel lifecycle handlers", () => {
  it("acceptDuel activates a classic duel for the opponent", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc());
    db.challenges.push(
      challengeDoc({
        mode: "classic",
        classicDifficultyPreset: "hard",
      })
    );

    const handler = (acceptDuel as unknown as {
      _handler: (ctx: unknown, args: { duelId: Id<"challenges"> }) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_2"), {
      duelId: "challenge_1" as Id<"challenges">,
    });

    const duel = db.challenges[0];
    expect(duel.status).toBe("accepted");
    expect(duel.questionStartTime).toBe(5_000);
    expect(duel.seed).toBe(5_000 ^ SEED_XOR_MASK);
  });

  it("acceptDuel defaults legacy mode-less duels to solo initialization", async () => {
    vi.spyOn(Date, "now").mockReturnValue(6_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc());
    db.challenges.push(challengeDoc({ mode: undefined }));

    const handler = (acceptDuel as unknown as {
      _handler: (ctx: unknown, args: { duelId: Id<"challenges"> }) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_2"), {
      duelId: "challenge_1" as Id<"challenges">,
    });

    const duel = db.challenges[0];
    expect(duel.status).toBe("challenging");
    expect(duel.questionStartTime).toBe(6_000);
    expect(duel.seed).toBeTypeOf("number");
    expect(duel.challengerWordStates).toHaveLength(3);
    expect(duel.opponentWordStates).toHaveLength(3);
    expect(duel.challengerWordStates).not.toBe(duel.opponentWordStates);
  });

  it("acceptDuelChallenge initializes the duel and dismisses the notification", async () => {
    vi.spyOn(Date, "now").mockReturnValue(7_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc());
    db.challenges.push(challengeDoc({ mode: "solo" }));
    db.notifications.push(notificationDoc());

    const handler = (acceptDuelChallenge as unknown as {
      _handler: (
        ctx: unknown,
        args: { notificationId: Id<"notifications"> }
      ) => Promise<{ success: boolean; challengeId: Id<"challenges"> }>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_2"), {
      notificationId: "notification_1" as Id<"notifications">,
    });

    expect(result).toEqual({
      success: true,
      challengeId: "challenge_1",
    });
    expect(db.notifications[0].status).toBe("dismissed");
    expect(db.challenges[0].status).toBe("challenging");
    expect(db.challenges[0].questionStartTime).toBe(7_000);
    expect(db.challenges[0].challengerStats).toEqual({
      questionsAnswered: 0,
      correctAnswers: 0,
    });
  });

  it("startScheduledDuel creates a challenge and updates related notifications", async () => {
    vi.spyOn(Date, "now").mockReturnValue(8_000);

    const db = new InMemoryDb();
    db.themes.push(themeDoc());
    db.scheduledDuels.push(
      scheduledDuelDoc({
        mode: undefined,
      })
    );
    db.notifications.push({
      ...notificationDoc({
        _id: "notification_5" as Id<"notifications">,
        type: "scheduled_duel",
        payload: {
          scheduledDuelId: "scheduled_1" as Id<"scheduledDuels">,
          themeId: "theme_1" as Id<"themes">,
        },
      }),
    });

    const handler = (startScheduledDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { scheduledDuelId: Id<"scheduledDuels"> }
      ) => Promise<{ success: boolean; challengeId: Id<"challenges"> }>;
    })._handler;

    const result = await handler(createCtx(db, null), {
      scheduledDuelId: "scheduled_1" as Id<"scheduledDuels">,
    });

    expect(result.success).toBe(true);
    expect(result.challengeId).toBeDefined();

    const createdChallenge = db.challenges[0];
    expect(createdChallenge.mode).toBe("solo");
    expect(createdChallenge.status).toBe("challenging");
    expect(createdChallenge.questionStartTime).toBe(8_000);
    expect(createdChallenge.themeIds).toEqual(["theme_1"]);
    expect(createdChallenge.sessionWords).toHaveLength(3);

    expect(db.scheduledDuels[0].startedDuelId).toBe(createdChallenge._id);
    expect(db.notifications[0].payload).toMatchObject({
      scheduledDuelId: "scheduled_1",
      startedDuelId: createdChallenge._id,
      mode: "solo",
    });
  });

  it("initializeDuelChallenge synthesizes a seed for legacy learning duels", async () => {
    vi.spyOn(Date, "now").mockReturnValue(9_000);

    const db = new InMemoryDb();
    db.users.push(
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
    );
    db.themes.push(themeDoc());
    db.challenges.push(
      challengeDoc({
        status: "learning",
        mode: "solo",
        seed: undefined,
      })
    );

    const handler = (initializeDuelChallenge as unknown as {
      _handler: (ctx: unknown, args: { duelId: Id<"challenges"> }) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_1"), {
      duelId: "challenge_1" as Id<"challenges">,
    });

    const duel = db.challenges[0];
    expect(duel.status).toBe("challenging");
    expect(duel.seed).toBeTypeOf("number");
    expect(duel.seed).not.toBe(0);
    expect(duel.challengerCurrentWordIndex).toBeTypeOf("number");
    expect(duel.opponentCurrentWordIndex).toBeTypeOf("number");
  });
});
