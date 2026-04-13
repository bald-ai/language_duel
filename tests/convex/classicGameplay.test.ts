import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { answerDuel } from "@/convex/gameplay";
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
    | "mode"
    | "currentWordIndex"
    | "challengerAnswered"
    | "opponentAnswered"
    | "challengerScore"
    | "opponentScore"
    | "createdAt"
    | "classicQuestions"
  >;

type Row = UserDoc | ChallengeDoc;
type TableRows = Array<Row>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public challenges: ChallengeDoc[] = [];

  query(table: "users" | "challenges") {
    return createIndexedQuery((table === "users" ? this.users : this.challenges) as TableRows);
  }

  async get(id: string): Promise<Row | null> {
    return findRowById<Row>([this.users, this.challenges], id);
  }

  async patch(id: string, value: Record<string, unknown>): Promise<void> {
    patchRow<Row>((id.startsWith("user_") ? this.users : this.challenges) as TableRows, id, value);
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
        answer: "gato",
        wrongAnswers: ["perro", "mesa", "casa", "libro", "silla", "tren"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    classicQuestions: [
      {
        options: ["perro", "mesa", "casa", "libro", NONE_OF_ABOVE],
        correctOption: "gato",
        difficulty: "hard",
        points: 2,
      },
    ],
    status: "accepted",
    mode: "classic",
    currentWordIndex: 0,
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    createdAt: 1,
    ...overrides,
  };
}

describe("classic gameplay", () => {
  it("scores None of the above using the stored server question snapshot", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.challenges.push(
      challengeDoc({
        classicQuestions: [
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
        args: { duelId: Id<"challenges">; selectedAnswer: string; questionIndex: number }
      ) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_1"), {
      duelId: "challenge_1" as Id<"challenges">,
      selectedAnswer: NONE_OF_ABOVE,
      questionIndex: 0,
    });

    expect(db.challenges[0].challengerScore).toBe(2);
    expect(db.challenges[0].challengerAnswered).toBe(true);
  });

  it("awards the hint-provider bonus after both players have answered", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.challenges.push(
      challengeDoc({
        challengerScore: 0,
        opponentScore: 1,
        opponentAnswered: true,
        opponentLastAnswer: "perro",
        hintRequestedBy: "challenger",
        hintAccepted: true,
        eliminatedOptions: ["mesa"],
        classicQuestions: [
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
        args: { duelId: Id<"challenges">; selectedAnswer: string; questionIndex: number }
      ) => Promise<void>;
    })._handler;

    await handler(createCtx(db, "clerk_1"), {
      duelId: "challenge_1" as Id<"challenges">,
      selectedAnswer: "gato",
      questionIndex: 0,
    });

    expect(db.challenges[0].challengerScore).toBe(1);
    expect(db.challenges[0].opponentScore).toBe(1.5);
    expect(db.challenges[0].status).toBe("completed");
    expect(db.challenges[0].hintRequestedBy).toBeUndefined();
  });

  it("blocks eliminating the stored correct option when None of the above is right", async () => {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.challenges.push(
      challengeDoc({
        challengerAnswered: false,
        opponentAnswered: true,
        hintRequestedBy: "challenger",
        hintAccepted: true,
        classicQuestions: [
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
        args: { duelId: Id<"challenges">; option: string }
      ) => Promise<void>;
    })._handler;

    await expect(
      handler(createCtx(db, "clerk_2"), {
        duelId: "challenge_1" as Id<"challenges">,
        option: NONE_OF_ABOVE,
      })
    ).rejects.toThrow("Cannot eliminate the correct answer");
  });
});
