import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { answerDuel, timeoutAnswer } from "@/convex/gameplay";
import { eliminateOption } from "@/convex/hints";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import {
  createAuthCtx,
  createIndexedQuery,
  findRowById,
  patchRow,
} from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "name" | "imageUrl"
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
    | "duelQuestions"
    | "seed"
  >;

type Row = UserDoc | DuelDoc;
type TableRows = Array<Row>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public duels: DuelDoc[] = [];

  query(table: "users" | "duels") {
    return createIndexedQuery((table === "users" ? this.users : this.duels) as TableRows);
  }

  async get(id: string): Promise<Row | null> {
    return findRowById<Row>([this.users, this.duels], id);
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    patchRow<Row>((id.startsWith("user_") ? this.users : this.duels) as TableRows, id, value);
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

function duelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionWords: [
      {
        word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "mesa", "casa", "libro", "silla", "tren"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    duelQuestions: [
      {
        options: ["perro", "mesa", "casa", "libro", NONE_OF_ABOVE],
        correctOption: "gato",
        difficulty: "hard",
        points: 2,
      },
    ],
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

describe("duel gameplay", () => {
  it("scores None of the above using the stored server question snapshot", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.duels.push(
      duelDoc({
        duelQuestions: [
          {
            options: ["perro", "mesa", "casa", "libro", NONE_OF_ABOVE],
            correctOption: NONE_OF_ABOVE,
            difficulty: "hard",
            points: 2,
          },
        ],
      })
    );

    const handler = (answerDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { duelId: Id<"duels">; selectedAnswer: string; questionIndex: number }
      ) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      selectedAnswer: NONE_OF_ABOVE,
      questionIndex: 0,
    });

    expect(db.duels[0].challengerScore).toBe(2);
    expect(db.duels[0].challengerAnswered).toBe(true);
  });

  it("awards the hint-provider bonus after both players have answered", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.duels.push(
      duelDoc({
        challengerScore: 0,
        opponentScore: 1,
        opponentAnswered: true,
        opponentLastAnswer: "perro",
        hintRequestedBy: "challenger",
        hintAccepted: true,
        eliminatedOptions: ["mesa"],
        duelQuestions: [
          {
            options: ["gato", "perro", "mesa", "casa"],
            correctOption: "gato",
            difficulty: "easy",
            points: 1,
          },
        ],
      })
    );

    const handler = (answerDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { duelId: Id<"duels">; selectedAnswer: string; questionIndex: number }
      ) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      selectedAnswer: "gato",
      questionIndex: 0,
    });

    expect(db.duels[0].challengerScore).toBe(1);
    expect(db.duels[0].opponentScore).toBe(1.5);
    expect(db.duels[0].status).toBe("completed");
    expect(db.duels[0].hintRequestedBy).toBeUndefined();
  });

  it("blocks eliminating the stored correct option when None of the above is right", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.duels.push(
      duelDoc({
        challengerAnswered: false,
        opponentAnswered: true,
        hintRequestedBy: "challenger",
        hintAccepted: true,
        duelQuestions: [
          {
            options: ["perro", "mesa", "casa", "libro", NONE_OF_ABOVE],
            correctOption: NONE_OF_ABOVE,
            difficulty: "hard",
            points: 2,
          },
        ],
      })
    );

    const handler = (eliminateOption as unknown as {
      _handler: (
        ctx: unknown,
        args: { duelId: Id<"duels">; option: string }
      ) => Promise<void>;
    })._handler;

    await expect(
      handler(createCtx(db, "clerk_2"), {
        duelId: "duel_1" as Id<"duels">,
        option: NONE_OF_ABOVE,
      })
    ).rejects.toThrow("Cannot eliminate the correct answer");
  });

  it("removes shared boss lives when players miss", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.duels.push(
      duelDoc({
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        sourceType: "boss",
        bossType: "big",
        bossLivesTotal: 3,
        bossLivesRemaining: 3,
        challengerPerfectRun: true,
        opponentPerfectRun: true,
        duelQuestions: [
          {
            options: ["gato", "perro", "mesa", "casa"],
            correctOption: "gato",
            difficulty: "easy",
            points: 1,
          },
        ],
      })
    );

    const handler = (answerDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { duelId: Id<"duels">; selectedAnswer: string; questionIndex: number }
      ) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      selectedAnswer: "perro",
      questionIndex: 0,
    });

    expect(db.duels[0].bossLivesRemaining).toBe(2);
    expect(db.duels[0].status).toBe("active");
    expect(db.duels[0].challengerPerfectRun).toBe(false);

    await handler(createCtx(db, "clerk_2"), {
      duelId: "duel_1" as Id<"duels">,
      selectedAnswer: "mesa",
      questionIndex: 0,
    });

    expect(db.duels[0].bossLivesRemaining).toBe(1);
    expect(db.duels[0].status).toBe("completed");
    expect(db.duels[0].opponentPerfectRun).toBe(false);
  });

  it("ends a boss attempt on the result state when a timeout removes the last life", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.duels.push(
      duelDoc({
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        sourceType: "boss",
        bossType: "mini",
        bossLivesTotal: 1,
        bossLivesRemaining: 1,
        challengerPerfectRun: true,
        opponentPerfectRun: true,
      })
    );

    const handler = (timeoutAnswer as unknown as {
      _handler: (
        ctx: unknown,
        args: { duelId: Id<"duels">; questionIndex: number }
      ) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      questionIndex: 0,
    });

    expect(db.duels[0].bossLivesRemaining).toBe(0);
    expect(db.duels[0].status).toBe("completed");
    expect(db.duels[0].challengerLastAnswer).toBe("__TIMEOUT__");
  });

  it("rejects stale timeout submissions without marking the active question timed out", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.duels.push(
      duelDoc({
        currentWordIndex: 1,
        sessionWords: [
          {
            word: "cat",
            answer: "gato",
            wrongAnswers: ["perro", "mesa", "casa"],
            themeId: "theme_1" as Id<"themes">,
            themeName: "Animals",
          },
          {
            word: "dog",
            answer: "perro",
            wrongAnswers: ["gato", "mesa", "casa"],
            themeId: "theme_1" as Id<"themes">,
            themeName: "Animals",
          },
        ],
        duelQuestions: [
          {
            options: ["gato", "perro", "mesa", "casa"],
            correctOption: "gato",
            difficulty: "easy",
            points: 1,
          },
          {
            options: ["perro", "gato", "mesa", "casa"],
            correctOption: "perro",
            difficulty: "medium",
            points: 1.5,
          },
        ],
      })
    );

    const handler = (timeoutAnswer as unknown as {
      _handler: (
        ctx: unknown,
        args: { duelId: Id<"duels">; questionIndex: number }
      ) => Promise<void>;
    })._handler;

    const staleTimeoutError = await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      questionIndex: 0,
    }).catch((error: unknown) => error);

    expect(staleTimeoutError).toMatchObject({
      data: { code: "STALE_TIMEOUT" },
    });

    expect(db.duels[0].challengerAnswered).toBe(false);
    expect(db.duels[0].challengerLastAnswer).toBeUndefined();
    expect(db.duels[0].currentWordIndex).toBe(1);
  });

  it("returns DUEL_NOT_ACTIVE for answer submissions after duel completion", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.duels.push(duelDoc({ status: "completed" }));

    const handler = (answerDuel as unknown as {
      _handler: (
        ctx: unknown,
        args: { duelId: Id<"duels">; selectedAnswer: string; questionIndex: number }
      ) => Promise<void>;
    })._handler;

    const duelNotActiveError = await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      selectedAnswer: "gato",
      questionIndex: 0,
    }).catch((error: unknown) => error);

    expect(duelNotActiveError).toMatchObject({
      data: { code: "DUEL_NOT_ACTIVE" },
    });
  });
});
