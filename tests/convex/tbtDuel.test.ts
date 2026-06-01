import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { tbtQuestionTimeout, tbtTap } from "@/convex/tbtDuel";
import { TBT_QUESTION_TIMEOUT_MS } from "@/lib/duelConstants";
import { createAuthCtx, createIndexedQuery, findRowById, patchRow } from "./testUtils/inMemoryDb";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email" | "name">;
type DuelDoc = Doc<"duels">;

class InMemoryDb {
  public users: UserDoc[] = [];
  public duels: DuelDoc[] = [];

  query(table: "users" | "duels") {
    return createIndexedQuery((table === "users" ? this.users : this.duels) as Array<{ _id: string }>);
  }

  async get(id: string) {
    return findRowById<{ _id: string }>([this.users as never, this.duels as never], id);
  }

  async patch(id: string, value: Record<string, unknown>) {
    patchRow((id.startsWith("user_") ? this.users : this.duels) as Array<{ _id: string }>, id, value);
  }
}

function createCtx(db: InMemoryDb, subject: string | null) {
  return createAuthCtx(db, subject);
}

function userDoc(overrides: Partial<UserDoc>): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "user@example.com",
    name: "User",
    ...overrides,
  };
}

function sentenceQuestion(): NonNullable<DuelDoc["duelQuestions"]>[number] {
  return {
    kind: "sentence",
    englishPrompt: "I eat bread",
    spanishSentence: "Yo como pan",
    tilePool: ["Yo", "como", "pan", "tú"],
  };
}

function tbtDuelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionWords: [
      {
        kind: "sentence",
        englishPrompt: "I eat bread",
        spanishSentence: "Yo como pan",
        distractors: ["tú"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Sentences",
      },
      {
        kind: "sentence",
        englishPrompt: "You drink water",
        spanishSentence: "Tú bebes agua",
        distractors: ["yo"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Sentences",
      },
    ],
    sourceType: "normal",
    status: "active",
    createdAt: 1,
    currentWordIndex: 0,
    wordOrder: [0, 1],
    duelQuestions: [sentenceQuestion(), sentenceQuestion()],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    duelDifficultyPreset: "easy",
    duelMode: "tbt",
    questionStartTime: 1,
    hintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 1,
    tbtTurn: "challenger",
    sentenceProgress: [
      {
        questionIndex: 0,
        role: "challenger",
        placedTileIndices: [0, 1],
        mistakes: 0,
        completed: false,
        finalized: false,
      },
    ],
    ...overrides,
  } as DuelDoc;
}

function seedDb(duel: DuelDoc): InMemoryDb {
  const db = new InMemoryDb();
  db.users.push(
    userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
    userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" })
  );
  db.duels.push(duel);
  return db;
}

const tapHandler = (tbtTap as unknown as {
  _handler: (ctx: unknown, args: { duelId: Id<"duels">; tileIndex: number }) => Promise<void>;
})._handler;

const timeoutHandler = (tbtQuestionTimeout as unknown as {
  _handler: (
    ctx: unknown,
    args: { duelId: Id<"duels">; questionIndex: number }
  ) => Promise<void>;
})._handler;

const duelId = "duel_1" as Id<"duels">;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tbtDuel mutations", () => {
  it("banks a shared point when a tap completes the sentence before timeout", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    const db = seedDb(tbtDuelDoc({ questionStartTime: 10_000 }));

    await tapHandler(createCtx(db, "clerk_1"), { duelId, tileIndex: 2 });

    expect(db.duels[0]).toMatchObject({
      currentWordIndex: 1,
      challengerScore: 1,
      opponentScore: 1,
      tbtTurn: "opponent",
      questionStartTime: 10_000,
    });
  });

  it("times out instead of scoring when a late tap arrives after the window", async () => {
    vi.spyOn(Date, "now").mockReturnValue(100_000);
    const db = seedDb(
      tbtDuelDoc({
        questionStartTime: 100_000 - TBT_QUESTION_TIMEOUT_MS - 1,
      })
    );

    await tapHandler(createCtx(db, "clerk_1"), { duelId, tileIndex: 2 });

    expect(db.duels[0]).toMatchObject({
      currentWordIndex: 1,
      challengerScore: 0,
      opponentScore: 0,
      tbtTurn: "opponent",
      questionStartTime: 100_000,
    });
    expect(db.duels[0].sentenceProgress?.[0].completed).toBe(false);
  });

  it("advances on timeout once the shared window has elapsed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(100_000);
    const db = seedDb(
      tbtDuelDoc({
        questionStartTime: 100_000 - TBT_QUESTION_TIMEOUT_MS,
      })
    );

    await timeoutHandler(createCtx(db, "clerk_2"), { duelId, questionIndex: 0 });

    expect(db.duels[0]).toMatchObject({
      currentWordIndex: 1,
      challengerScore: 0,
      opponentScore: 0,
      tbtTurn: "opponent",
      questionStartTime: 100_000,
    });
  });

  it("rejects active Tag Team duels that are missing the turn pointer", async () => {
    const db = seedDb(tbtDuelDoc({ tbtTurn: undefined }));

    await expect(
      tapHandler(createCtx(db, "clerk_1"), { duelId, tileIndex: 2 })
    ).rejects.toThrow("Tag Team duel is missing the current turn");
  });
});
