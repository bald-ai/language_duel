import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getDuel } from "@/convex/duels";
import { NONE_OF_ABOVE } from "@/lib/answerShuffle";
import { createIndexedQuery } from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  "_id" | "_creationTime" | "clerkId" | "email" | "name" | "nickname" | "discriminator" | "imageUrl"
>;
type WordThemeDoc = Extract<Doc<"themes">, { contentType: "word" }>;
type ThemeDoc = Pick<WordThemeDoc, "_id" | "_creationTime" | "name" | "words">;
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
    sessionItems: [
      {
        kind: "word" as const, word: "cat",
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
    itemOrder: [0],
    duelQuestions: [
      {
        kind: "word" as const, options: ["gato", "perro", "pez", "ave"],
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
    sentenceHintPoolUsed: [],
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

    const firstItem = result?.duel.sessionItems[0];
    expect(firstItem && firstItem.kind === "word" ? firstItem.answer : undefined).toBe("");
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

    const firstItemRevealed = result?.duel.sessionItems[0];
    expect(firstItemRevealed && firstItemRevealed.kind === "word" ? firstItemRevealed.answer : undefined).toBe("gato");
    const firstQuestion = result?.duel.duelQuestions?.[0];
    expect(firstQuestion && firstQuestion.kind === "word" ? firstQuestion.correctOption : undefined).toBe("gato");
    expect((firstQuestion as ViewerSafeQuestion | undefined)?.answerRevealedToViewer).toBe(true);
  });
});

type RelaySafeResult = {
  duel: Record<string, unknown> & {
    sessionItems: Array<{ answer: string; ttsStorageId?: unknown }>;
    relayServedQuestion: (ViewerSafeQuestion & { correctOption?: string }) | null;
    relayRemainingPositions: number[];
    duelQuestions?: unknown;
    relayHardQuestions?: unknown;
  };
};

function relayDuelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return duelDoc({
    duelMode: "relay",
    duelQuestions: [
      { kind: "word" as const, options: ["gato", "perro", "pez", "ave", "casa", "mesa"], correctOption: "gato", difficulty: "medium", points: 1 },
    ],
    relayHardQuestions: [
      { kind: "word" as const, options: ["gato", "perro", "pez", "ave", "casa", NONE_OF_ABOVE], correctOption: NONE_OF_ABOVE, difficulty: "hard", points: 1 },
    ],
    relayPicker: "challenger",
    relayPhase: "answer",
    relayAssignedIndex: 0,
    relayResolvedIndices: [],
    relayHardUpgradeIndices: [],
    relayHardBudget: { challenger: 1, opponent: 1 },
    relayAnswerStartedAt: 1000,
    ...overrides,
  });
}

async function getRelayDuel(duel: DuelDoc): Promise<RelaySafeResult | null> {
  const db = new InMemoryDb(
    [
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_challenger" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_opponent" }),
    ],
    [themeDoc()],
    [duel]
  );
  return (await getDuelHandler(createCtx(db), { duelId: "duel_1" as Id<"duels"> })) as RelaySafeResult | null;
}

describe("duels.getDuel relay viewer-safe DTO", () => {
  it("never ships the relay answer keys", async () => {
    const result = await getRelayDuel(relayDuelDoc());
    expect(result?.duel.duelQuestions).toBeUndefined();
    expect(result?.duel.relayHardQuestions).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("secret-answer-from-theme");
  });

  it("masks the served question during the answer phase and blanks session answers", async () => {
    const result = await getRelayDuel(relayDuelDoc({ relayPhase: "answer" }));
    expect(result?.duel.relayServedQuestion).not.toBeNull();
    expect(result?.duel.relayServedQuestion).not.toHaveProperty("correctOption");
    expect(result?.duel.relayServedQuestion?.answerRevealedToViewer).toBe(false);
    expect(result?.duel.sessionItems[0].answer).toBe("");
    expect(result?.duel.sessionItems[0].ttsStorageId).toBeUndefined();
  });

  it("returns no served question during the pick phase, only the remaining pool", async () => {
    const result = await getRelayDuel(
      relayDuelDoc({ relayPhase: "pick", relayAssignedIndex: undefined })
    );
    expect(result?.duel.relayServedQuestion).toBeNull();
    expect(result?.duel.relayRemainingPositions).toEqual([0]);
  });

  it("reveals the served question during feedback", async () => {
    const result = await getRelayDuel(relayDuelDoc({ relayPhase: "feedback" }));
    expect(result?.duel.relayServedQuestion?.answerRevealedToViewer).toBe(true);
    expect(result?.duel.relayServedQuestion?.correctOption).toBe("gato");
  });

  it("serves the hard variant for an upgraded position", async () => {
    const result = await getRelayDuel(
      relayDuelDoc({ relayPhase: "feedback", relayHardUpgradeIndices: [0] })
    );
    expect(result?.duel.relayServedQuestion?.correctOption).toBe(NONE_OF_ABOVE);
  });

  it("restores real session answers once the duel is over", async () => {
    const result = await getRelayDuel(
      relayDuelDoc({ status: "completed", relayPhase: "pick", relayAssignedIndex: undefined })
    );
    expect(result?.duel.sessionItems[0].answer).toBe("gato");
  });
});

describe("duels.getDuel sentence masking (Task 21)", () => {
  function sentenceDuelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
    return duelDoc({
      sessionItems: [
        {
          kind: "sentence",
          englishPrompt: "I want coffee",
          spanishSentence: "secret-spanish-sentence",
          wordMeanings: ["secret", "spanish", "sentence"],
          freeWordPositions: [],
          distractors: ["leak1", "leak2", "leak3"],
          themeId: "theme_1" as Id<"themes">,
          themeName: "Cafe",
        },
      ],
      itemOrder: [0],
      currentWordIndex: 0,
      duelQuestions: [
        {
          kind: "sentence",
          englishPrompt: "I want coffee",
          spanishSentence: "secret-spanish-sentence",
          tilePool: ["Quiero", "cafe", "leak1", "leak2", "leak3"],
          tileMeanings: [null, "coffee", null, null, null],
        },
      ],
      ...overrides,
    });
  }

  it("strips spanishSentence and distractors from session items during active play", async () => {
    const db = new InMemoryDb(
      [
        userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_challenger" }),
        userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_opponent" }),
      ],
      [themeDoc()],
      [sentenceDuelDoc()]
    );
    const result = await getDuelHandler(createCtx(db), { duelId: "duel_1" as Id<"duels"> });
    const item = result?.duel.sessionItems[0];
    expect(item?.kind).toBe("sentence");
    if (item?.kind === "sentence") {
      expect(item.spanishSentence).toBe("");
      expect(item.wordMeanings).toEqual([]);
      expect(item.freeWordPositions).toEqual([]);
      expect(item.distractors).toEqual([]);
    }
    // The tile pool still ships — players need it to render. The answer key
    // itself (the canonical sentence) must not appear anywhere in the payload
    // while the duel is active.
    expect(JSON.stringify(result)).not.toContain("secret-spanish-sentence");
  });

  it("strips spanishSentence from the question snapshot until the round reveals", async () => {
    const db = new InMemoryDb(
      [
        userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_challenger" }),
        userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_opponent" }),
      ],
      [themeDoc()],
      [sentenceDuelDoc()]
    );
    const result = await getDuelHandler(createCtx(db), { duelId: "duel_1" as Id<"duels"> });
    const q = result?.duel.duelQuestions?.[0];
    expect(q?.kind).toBe("sentence");
    expect(q).not.toHaveProperty("spanishSentence");
    expect(q?.kind === "sentence" ? q.tileMeanings : undefined).toEqual([
      null,
      "coffee",
      null,
      null,
      null,
    ]);
  });

  it("restores the spanish sentence once the viewer has answered", async () => {
    const db = new InMemoryDb(
      [
        userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_challenger" }),
        userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_opponent" }),
      ],
      [themeDoc()],
      [sentenceDuelDoc({ challengerAnswered: true })]
    );
    const result = await getDuelHandler(createCtx(db), { duelId: "duel_1" as Id<"duels"> });
    const q = result?.duel.duelQuestions?.[0];
    expect(q?.kind === "sentence" ? q.spanishSentence : undefined).toBe(
      "secret-spanish-sentence"
    );
  });
});
