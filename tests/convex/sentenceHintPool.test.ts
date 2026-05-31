import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { fireSentenceHint } from "@/convex/hintPool";
import { createIndexedQuery, patchRow } from "./testUtils/inMemoryDb";

type UserDoc = Pick<Doc<"users">, "_id" | "_creationTime" | "clerkId" | "email">;
type DuelDoc = Doc<"duels">;

class InMemoryDb {
  constructor(
    public users: UserDoc[],
    public duels: DuelDoc[]
  ) {}

  query(table: "users") {
    if (table !== "users") throw new Error(`Unexpected table: ${table}`);
    return createIndexedQuery(this.users);
  }

  async get(id: Id<"users"> | Id<"duels">) {
    return (
      this.users.find((user) => user._id === id) ??
      this.duels.find((duel) => duel._id === id) ??
      null
    );
  }

  async patch(id: Id<"duels">, value: Partial<DuelDoc>) {
    patchRow(this.duels, id, value);
  }
}

function createCtx(db: InMemoryDb) {
  return {
    db,
    auth: { getUserIdentity: async () => ({ subject: "clerk_1" }) },
  };
}

function userDoc(overrides: Partial<UserDoc>): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "test@example.com",
    ...overrides,
  };
}

// "el gato el perro" with one decoy "raton" at pool index 4.
function duelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    _id: "duel_1" as Id<"duels">,
    _creationTime: 1,
    challengerId: "user_1" as Id<"users">,
    opponentId: "user_2" as Id<"users">,
    themeIds: ["theme_1" as Id<"themes">],
    sessionWords: [
      {
        kind: "sentence" as const,
        englishPrompt: "the cat the dog",
        spanishSentence: "el gato el perro",
        distractors: ["raton"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    sourceType: "normal",
    duelMode: "pve",
    status: "active",
    createdAt: 1,
    currentWordIndex: 0,
    wordOrder: [0],
    duelQuestions: [
      {
        kind: "sentence" as const,
        englishPrompt: "the cat the dog",
        spanishSentence: "el gato el perro",
        tilePool: ["el", "gato", "el", "perro", "raton"],
      },
    ],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    duelDifficultyPreset: "medium",
    questionStartTime: 1_000,
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 123,
    ...overrides,
  };
}

const fireSentenceHintHandler = (fireSentenceHint as unknown as {
  _handler: (
    ctx: unknown,
    args: {
      duelId: Id<"duels">;
      hintType: "freeze_time" | "remove_distractor" | "reveal_tiles";
    }
  ) => Promise<void>;
})._handler;

function seedDb(duelOverrides: Partial<DuelDoc> = {}) {
  return new InMemoryDb(
    [
      userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" }),
    ],
    [duelDoc(duelOverrides)]
  );
}

describe("hintPool.fireSentenceHint", () => {
  it("freeze_time adds +30s and pushes nothing else (no questionStartTime push)", async () => {
    const db = seedDb();
    await fireSentenceHintHandler(createCtx(db), {
      duelId: "duel_1" as Id<"duels">,
      hintType: "freeze_time",
    });
    expect(db.duels[0].sentenceHintPoolUsed).toEqual(["freeze_time"]);
    expect(db.duels[0].currentQuestionHintFired).toBe(true);
    expect(db.duels[0].currentQuestionTimerBonusSeconds).toBe(30);
    expect(db.duels[0].currentQuestionEliminatedTileIndices).toEqual([]);
    // The bonus field is the single source of truth — questionStartTime is untouched.
    expect(db.duels[0].questionStartTime).toBe(1_000);
  });

  it("remove_distractor greys every decoy and adds the universal +10s", async () => {
    const db = seedDb();
    await fireSentenceHintHandler(createCtx(db), {
      duelId: "duel_1" as Id<"duels">,
      hintType: "remove_distractor",
    });
    expect(db.duels[0].currentQuestionEliminatedTileIndices).toEqual([4]);
    expect(db.duels[0].currentQuestionTimerBonusSeconds).toBe(10);
  });

  it("reveal_tiles marks two slots and adds the universal +10s", async () => {
    const db = seedDb();
    await fireSentenceHintHandler(createCtx(db), {
      duelId: "duel_1" as Id<"duels">,
      hintType: "reveal_tiles",
    });
    expect(db.duels[0].currentQuestionRevealedTiles).toHaveLength(2);
    expect(db.duels[0].currentQuestionTimerBonusSeconds).toBe(10);
  });

  it("rejects a second hint on the same question", async () => {
    const db = seedDb({ currentQuestionHintFired: true });
    await expect(
      fireSentenceHintHandler(createCtx(db), {
        duelId: "duel_1" as Id<"duels">,
        hintType: "reveal_tiles",
      })
    ).rejects.toThrow("Only one hint can be used per question");
  });

  it("rejects the same hint type twice across questions", async () => {
    const db = seedDb({ sentenceHintPoolUsed: ["freeze_time"] });
    await expect(
      fireSentenceHintHandler(createCtx(db), {
        duelId: "duel_1" as Id<"duels">,
        hintType: "freeze_time",
      })
    ).rejects.toThrow("This hint has already been used");
  });

  it("rejects sentence hints in PvP duels", async () => {
    const db = seedDb({ duelMode: "pvp" });
    await expect(
      fireSentenceHintHandler(createCtx(db), {
        duelId: "duel_1" as Id<"duels">,
        hintType: "freeze_time",
      })
    ).rejects.toThrow("fireSentenceHint is only available in PVE duels");
  });

  it("rejects sentence hints on a word round", async () => {
    const db = seedDb({
      duelQuestions: [
        {
          kind: "word",
          options: ["cat", "dog"],
          correctOption: "cat",
          difficulty: "easy",
          points: 1,
        },
      ],
    });
    await expect(
      fireSentenceHintHandler(createCtx(db), {
        duelId: "duel_1" as Id<"duels">,
        hintType: "freeze_time",
      })
    ).rejects.toThrow("Sentence hints are only available on sentence rounds");
  });
});
