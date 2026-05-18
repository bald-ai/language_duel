import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getDuel } from "@/convex/duels";
import { createIndexedQuery } from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "name" | "nickname" | "discriminator" | "imageUrl"
>;
type ThemeDoc = Pick<Doc<"themes">, "_id" | "_creationTime" | "name" | "words">;
type DuelDoc = Doc<"duels">;
type ViewerSafeQuestion = NonNullable<DuelDoc["duelQuestions"]>[number] & {
  answerRevealedToViewer?: boolean;
};

class InMemoryDb {
  constructor(
    public users: UserDoc[],
    public themes: ThemeDoc[],
    public duels: DuelDoc[]
  ) {}

  query(_table: "users") {
    return createIndexedQuery(this.users);
  }

  async get(id: Id<"users"> | Id<"themes"> | Id<"duels">) {
    return (
      this.users.find((user) => user._id === id) ??
      this.themes.find((theme) => theme._id === id) ??
      this.duels.find((duel) => duel._id === id) ??
      null
    );
  }
}

function createCtx(db: InMemoryDb, subject = "clerk_challenger") {
  return {
    db,
    auth: {
      getUserIdentity: async () => ({ subject }),
    },
  };
}

function userDoc(overrides: Partial<UserDoc>): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_challenger",
    email: "challenger@example.com",
    name: "Challenger",
    nickname: "Challenger",
    discriminator: 1234,
    imageUrl: undefined,
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
        wrongAnswers: ["perro", "pez", "ave"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    sourceType: "normal",
    duelMode: "pvp",
    status: "active",
    createdAt: 1,
    currentWordIndex: 0,
    wordOrder: [0],
    duelQuestions: [
      {
        options: ["gato", "perro", "pez", "ave"],
        correctOption: "gato",
        difficulty: "easy",
        points: 1,
      },
    ],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    duelDifficultyPreset: "easy",
    questionStartTime: 1,
    hintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 1,
    ...overrides,
  } as DuelDoc;
}

function themeDoc(): ThemeDoc {
  return {
    _id: "theme_1" as Id<"themes">,
    _creationTime: 1,
    name: "Animals",
    words: [
      {
        word: "hidden source word",
        answer: "secret-answer-from-theme",
        wrongAnswers: ["wrong one", "wrong two", "wrong three"],
      },
    ],
  };
}

const getDuelHandler = (getDuel as unknown as {
  _handler: (
    ctx: unknown,
    args: { duelId: Id<"duels"> }
  ) => Promise<{ duel: DuelDoc; themes: Array<{ _id: Id<"themes">; name: string }> } | null>;
})._handler;

describe("duels.getDuel viewer-safe DTO", () => {
  it("hides answer keys before the viewer has answered", async () => {
    const db = new InMemoryDb(
      [
        userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_challenger" }),
        userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_opponent" }),
      ],
      [themeDoc()],
      [duelDoc()]
    );

    const result = await getDuelHandler(createCtx(db), { duelId: "duel_1" as Id<"duels"> });

    expect(result?.duel.sessionWords[0].answer).toBe("");
    expect(result?.duel.duelQuestions?.[0]).not.toHaveProperty("correctOption");
    expect((result?.duel.duelQuestions?.[0] as ViewerSafeQuestion | undefined)?.answerRevealedToViewer).toBe(false);
    expect(result).not.toHaveProperty("theme");
    expect(result?.themes).toEqual([{ _id: "theme_1", name: "Animals" }]);
    expect(JSON.stringify(result)).not.toContain("secret-answer-from-theme");
  });

  it("reveals answer keys after the viewer has answered", async () => {
    const db = new InMemoryDb(
      [
        userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_challenger" }),
        userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_opponent" }),
      ],
      [themeDoc()],
      [duelDoc({ challengerAnswered: true })]
    );

    const result = await getDuelHandler(createCtx(db), { duelId: "duel_1" as Id<"duels"> });

    expect(result?.duel.sessionWords[0].answer).toBe("gato");
    expect(result?.duel.duelQuestions?.[0].correctOption).toBe("gato");
    expect((result?.duel.duelQuestions?.[0] as ViewerSafeQuestion | undefined)?.answerRevealedToViewer).toBe(true);
  });
});
