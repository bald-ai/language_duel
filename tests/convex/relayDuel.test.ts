import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  relayAdvance,
  relayAnswer,
  relayPick,
  relaySentenceConfirm,
  relaySentenceReset,
  relaySentenceTap,
  relayTimeout,
  relayTimeoutInternal,
} from "@/convex/relayDuel";
import { RELAY_ANSWER_TIMEOUT_MS } from "@/lib/duelConstants";
import { SENTENCE_RELAY_TIMEOUT_MS } from "@/lib/themes/sentenceConstants";
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

function createCtx(
  db: InMemoryDb,
  subject: string | null,
  scheduler: { runAfter: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }
) {
  return createAuthCtx(db, subject, { scheduler });
}

function makeScheduler(scheduledId = "sched_1") {
  return {
    runAfter: vi.fn().mockResolvedValue(scheduledId as Id<"_scheduled_functions">),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
}

function question(correctOption: string): NonNullable<DuelDoc["duelQuestions"]>[number] {
  return {
    kind: "word" as const,
    options: ["a", "b", "c", "d", "e", correctOption],
    correctOption,
    difficulty: "medium",
    points: 1,
  };
}

function relayDuelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return {
    _id: "duel_1" as DuelDoc["_id"],
    _creationTime: 1,
    challengerId: "user_1" as DuelDoc["challengerId"],
    opponentId: "user_2" as DuelDoc["opponentId"],
    themeIds: [],
    sessionWords: [
      { kind: "word" as const, word: "w0", answer: "base0", wrongAnswers: [], themeId: "t" as never, themeName: "T" },
      { kind: "word" as const, word: "w1", answer: "base1", wrongAnswers: [], themeId: "t" as never, themeName: "T" },
    ],
    sourceType: "normal",
    status: "active",
    createdAt: 1,
    currentWordIndex: 0,
    wordOrder: [0, 1],
    duelQuestions: [question("base0"), question("base1")],
    relayHardQuestions: [question("hard0"), question("hard1")],
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    duelDifficultyPreset: "medium",
    duelMode: "relay",
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    seed: 1,
    relayPicker: "challenger",
    relayPhase: "pick",
    relayResolvedIndices: [],
    relayHardUpgradeIndices: [],
    relayHardBudget: { challenger: 1, opponent: 1 },
    ...overrides,
  } as DuelDoc;
}

function seedDb(duel: DuelDoc): InMemoryDb {
  const db = new InMemoryDb();
  db.users.push(
    { _id: "user_1" as UserDoc["_id"], _creationTime: 1, clerkId: "clerk_1", email: "c@e.com", name: "C" },
    { _id: "user_2" as UserDoc["_id"], _creationTime: 1, clerkId: "clerk_2", email: "o@e.com", name: "O" }
  );
  db.duels.push(duel);
  return db;
}

// A relay duel whose only position is a sentence. The opponent is the answerer
// (picker is the challenger). `duelQuestions[0]` is the served sentence the pure
// validation functions read.
function relaySentenceDuelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
  return relayDuelDoc({
    sessionWords: [
      {
        kind: "sentence",
        englishPrompt: "I eat bread",
        spanishSentence: "Yo como pan",
        distractors: ["tú"],
        themeId: "t" as never,
        themeName: "Sentences",
      },
    ],
    wordOrder: [0],
    duelQuestions: [
      {
        kind: "sentence",
        englishPrompt: "I eat bread",
        spanishSentence: "Yo como pan",
        tilePool: ["Yo", "como", "pan", "tú"],
      },
    ],
    relayHardQuestions: [
      {
        kind: "sentence",
        englishPrompt: "I eat bread",
        spanishSentence: "Yo como pan",
        tilePool: ["Yo", "como", "pan", "tú"],
      },
    ],
    ...overrides,
  });
}

const pickHandler = (relayPick as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
const sentenceTapHandler = (relaySentenceTap as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
const sentenceResetHandler = (relaySentenceReset as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
const sentenceConfirmHandler = (relaySentenceConfirm as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
const answerHandler = (relayAnswer as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
const advanceHandler = (relayAdvance as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
const timeoutHandler = (relayTimeout as unknown as { _handler: (ctx: unknown, args: unknown) => Promise<unknown> })._handler;
const timeoutInternalHandler = (relayTimeoutInternal as unknown as {
  _handler: (ctx: unknown, args: unknown) => Promise<unknown>;
})._handler;

const duelId = "duel_1" as Id<"duels">;

describe("relayDuel mutations", () => {
  describe("relayPick", () => {
    it("hands a word over, schedules the timeout backstop, and stores its id", async () => {
      const db = seedDb(relayDuelDoc());
      const scheduler = makeScheduler("sched_42");

      await pickHandler(createCtx(db, "clerk_1", scheduler), { duelId, wordIndex: 0, hardUpgrade: false });

      expect(db.duels[0].relayAssignedIndex).toBe(0);
      expect(db.duels[0].relayPhase).toBe("answer");
      expect(db.duels[0].relayTimeoutScheduledFunctionId).toBe("sched_42");
      expect(scheduler.runAfter).toHaveBeenCalledWith(
        RELAY_ANSWER_TIMEOUT_MS,
        expect.anything(),
        { duelId, expectedAssignedIndex: 0 }
      );
    });

    it("rejects a pick from the non-picker", async () => {
      const db = seedDb(relayDuelDoc({ relayPicker: "challenger" }));
      await expect(
        pickHandler(createCtx(db, "clerk_2", makeScheduler()), { duelId, wordIndex: 0, hardUpgrade: false })
      ).rejects.toThrow(/picker/i);
    });

    it("consumes a hard token and refuses when the budget is zero", async () => {
      const db = seedDb(relayDuelDoc({ relayHardBudget: { challenger: 1, opponent: 1 } }));
      await pickHandler(createCtx(db, "clerk_1", makeScheduler()), { duelId, wordIndex: 0, hardUpgrade: true });
      expect(db.duels[0].relayHardUpgradeIndices).toEqual([0]);
      expect(db.duels[0].relayHardBudget).toEqual({ challenger: 0, opponent: 1 });

      const empty = seedDb(relayDuelDoc({ relayHardBudget: { challenger: 0, opponent: 1 } }));
      await expect(
        pickHandler(createCtx(empty, "clerk_1", makeScheduler()), { duelId, wordIndex: 0, hardUpgrade: true })
      ).rejects.toThrow(/budget/i);
    });
  });

  describe("relayAnswer", () => {
    it("scores a correct answer and cancels the scheduled timeout", async () => {
      const db = seedDb(
        relayDuelDoc({
          relayPhase: "answer",
          relayPicker: "challenger",
          relayAssignedIndex: 0,
          relayAnswerStartedAt: Date.now(),
          relayTimeoutScheduledFunctionId: "sched_1" as DuelDoc["relayTimeoutScheduledFunctionId"],
        })
      );
      const scheduler = makeScheduler();

      // The opponent is the answerer.
      await answerHandler(createCtx(db, "clerk_2", scheduler), { duelId, value: "base0" });

      expect(db.duels[0].opponentScore).toBe(1);
      expect(db.duels[0].relayPhase).toBe("feedback");
      expect(scheduler.cancel).toHaveBeenCalledWith("sched_1");
    });

    it("rejects an answer from the picker (non-answerer)", async () => {
      const db = seedDb(
        relayDuelDoc({ relayPhase: "answer", relayPicker: "challenger", relayAssignedIndex: 0 })
      );
      await expect(
        answerHandler(createCtx(db, "clerk_1", makeScheduler()), { duelId, value: "base0" })
      ).rejects.toThrow(/answerer/i);
    });

    it("rejects answering a sentence position via the word-only relayAnswer path", async () => {
      const db = seedDb(
        relayDuelDoc({
          relayPhase: "answer",
          relayPicker: "challenger",
          relayAssignedIndex: 0,
          sessionWords: [
            {
              kind: "sentence",
              englishPrompt: "I eat bread",
              spanishSentence: "Yo como pan",
              distractors: ["tú", "bebes"],
              themeId: "t" as never,
              themeName: "Sentences",
            },
          ],
          duelQuestions: [
            {
              kind: "sentence",
              englishPrompt: "I eat bread",
              spanishSentence: "Yo como pan",
              tilePool: ["Yo", "como", "pan"],
            },
          ],
          wordOrder: [0],
        })
      );

      await expect(
        answerHandler(createCtx(db, "clerk_2", makeScheduler()), { duelId, value: "Yo como pan" })
      ).rejects.toThrow("Sentence relay positions are answered via relaySentenceConfirm");
    });
  });

  describe("relayAdvance", () => {
    it("completes the duel inline when the final word resolves", async () => {
      const db = seedDb(
        relayDuelDoc({
          relayPhase: "feedback",
          relayPicker: "challenger",
          relayAssignedIndex: 1,
          relayResolvedIndices: [0],
        })
      );
      // The opponent answered, so the opponent advances.
      await advanceHandler(createCtx(db, "clerk_2", makeScheduler()), { duelId });

      expect(db.duels[0].relayResolvedIndices).toEqual([0, 1]);
      expect(db.duels[0].relayAssignedIndex).toBeUndefined();
      expect(db.duels[0].status).toBe("completed");
    });

    it("rejects advance from the non-answerer", async () => {
      const db = seedDb(
        relayDuelDoc({ relayPhase: "feedback", relayPicker: "challenger", relayAssignedIndex: 0 })
      );
      await expect(
        advanceHandler(createCtx(db, "clerk_1", makeScheduler()), { duelId })
      ).rejects.toThrow(/answerer/i);
    });
  });

  describe("timeout", () => {
    it("client relayTimeout resolves once the window has elapsed", async () => {
      const db = seedDb(
        relayDuelDoc({
          relayPhase: "answer",
          relayPicker: "challenger",
          relayAssignedIndex: 0,
          relayAnswerStartedAt: Date.now() - RELAY_ANSWER_TIMEOUT_MS - 1000,
          relayTimeoutScheduledFunctionId: "sched_1" as DuelDoc["relayTimeoutScheduledFunctionId"],
        })
      );
      const scheduler = makeScheduler();

      await timeoutHandler(createCtx(db, "clerk_1", scheduler), { duelId });

      expect(db.duels[0].relayPhase).toBe("pick");
      expect(db.duels[0].relayResolvedIndices).toEqual([0]);
      expect(db.duels[0].challengerScore).toBe(0);
      expect(scheduler.cancel).toHaveBeenCalledWith("sched_1");
    });

    it("client relayTimeout is a no-op before the window elapses", async () => {
      const db = seedDb(
        relayDuelDoc({
          relayPhase: "answer",
          relayPicker: "challenger",
          relayAssignedIndex: 0,
          relayAnswerStartedAt: Date.now(),
        })
      );
      await timeoutHandler(createCtx(db, "clerk_2", makeScheduler()), { duelId });
      expect(db.duels[0].relayPhase).toBe("answer");
      expect(db.duels[0].relayResolvedIndices).toEqual([]);
    });

    it("scheduler backstop resolves a stale answer phase with no client action", async () => {
      const db = seedDb(
        relayDuelDoc({
          relayPhase: "answer",
          relayPicker: "challenger",
          relayAssignedIndex: 0,
          relayAnswerStartedAt: Date.now(),
        })
      );
      await timeoutInternalHandler(createCtx(db, null, makeScheduler()), {
        duelId,
        expectedAssignedIndex: 0,
      });
      expect(db.duels[0].relayPhase).toBe("pick");
      expect(db.duels[0].relayResolvedIndices).toEqual([0]);
    });

    it("scheduler backstop is a no-op when the assigned word already changed", async () => {
      const db = seedDb(
        relayDuelDoc({
          relayPhase: "answer",
          relayPicker: "opponent",
          relayAssignedIndex: 1,
          relayResolvedIndices: [0],
        })
      );
      // Stale fire for word 0 while word 1 is now in flight.
      await timeoutInternalHandler(createCtx(db, null, makeScheduler()), {
        duelId,
        expectedAssignedIndex: 0,
      });
      expect(db.duels[0].relayPhase).toBe("answer");
      expect(db.duels[0].relayAssignedIndex).toBe(1);
    });
  });

  describe("relay sentences", () => {
    it("picks a sentence with the 60s window and rejects a 🔥 upgrade on it", async () => {
      const db = seedDb(relaySentenceDuelDoc());
      const scheduler = makeScheduler("sched_s");

      await pickHandler(createCtx(db, "clerk_1", scheduler), {
        duelId,
        wordIndex: 0,
        hardUpgrade: false,
      });

      expect(db.duels[0].relayPhase).toBe("answer");
      expect(scheduler.runAfter).toHaveBeenCalledWith(
        SENTENCE_RELAY_TIMEOUT_MS,
        expect.anything(),
        { duelId, expectedAssignedIndex: 0 }
      );

      const hardAttempt = seedDb(relaySentenceDuelDoc());
      await expect(
        pickHandler(createCtx(hardAttempt, "clerk_1", makeScheduler()), {
          duelId,
          wordIndex: 0,
          hardUpgrade: true,
        })
      ).rejects.toThrow(/hard-upgraded/i);
    });

    it("lets the answerer place a tile but rejects the picker", async () => {
      const db = seedDb(
        relaySentenceDuelDoc({
          relayPhase: "answer",
          relayPicker: "challenger",
          relayAssignedIndex: 0,
          relayAnswerStartedAt: Date.now(),
        })
      );

      // The opponent is the answerer.
      await sentenceTapHandler(createCtx(db, "clerk_2", makeScheduler()), { duelId, tileIndex: 0 });
      expect(db.duels[0].sentenceProgress).toEqual([
        expect.objectContaining({ questionIndex: 0, role: "opponent", placedTileIndices: [0] }),
      ]);

      // The picker (challenger) cannot drive the board.
      await expect(
        sentenceTapHandler(createCtx(db, "clerk_1", makeScheduler()), { duelId, tileIndex: 1 })
      ).rejects.toThrow(/answerer/i);
    });

    it("scores a correct Confirm, cancels the backstop, and advances to feedback", async () => {
      const db = seedDb(
        relaySentenceDuelDoc({
          relayPhase: "answer",
          relayPicker: "challenger",
          relayAssignedIndex: 0,
          relayAnswerStartedAt: Date.now(),
          relayTimeoutScheduledFunctionId: "sched_1" as DuelDoc["relayTimeoutScheduledFunctionId"],
          // "Yo como pan" already built on the board.
          sentenceProgress: [
            {
              questionIndex: 0,
              role: "opponent",
              placedTileIndices: [0, 1, 2],
              mistakes: 0,
              completed: false,
              finalized: false,
              failedConfirms: 0,
            },
          ],
        })
      );
      const scheduler = makeScheduler();

      const result = await sentenceConfirmHandler(createCtx(db, "clerk_2", scheduler), { duelId });

      expect(result).toEqual({ completed: true, correctnessMask: [true, true, true] });
      expect(db.duels[0].opponentScore).toBe(1);
      expect(db.duels[0].relayPhase).toBe("feedback");
      expect(db.duels[0].relayLastResult).toEqual({
        wordIndex: 0,
        chosen: "",
        correct: true,
        scorer: "opponent",
      });
      expect(scheduler.cancel).toHaveBeenCalledWith("sched_1");
    });

    it("keeps a wrong Confirm in the answer phase with no point but returns the per-tile mask", async () => {
      const db = seedDb(
        relaySentenceDuelDoc({
          relayPhase: "answer",
          relayPicker: "challenger",
          relayAssignedIndex: 0,
          relayAnswerStartedAt: Date.now(),
          // "Yo como tú" — wrong last tile.
          sentenceProgress: [
            {
              questionIndex: 0,
              role: "opponent",
              placedTileIndices: [0, 1, 3],
              mistakes: 0,
              completed: false,
              finalized: false,
              failedConfirms: 0,
            },
          ],
        })
      );

      const result = await sentenceConfirmHandler(createCtx(db, "clerk_2", makeScheduler()), { duelId });

      // Same per-tile feedback as PvP: "Yo" + "como" correct, "tú" (vs "pan") wrong.
      expect(result).toEqual({ completed: false, correctnessMask: [true, true, false] });
      expect(db.duels[0].relayPhase).toBe("answer");
      expect(db.duels[0].opponentScore).toBe(0);
      expect(db.duels[0].sentenceProgress?.[0].failedConfirms).toBe(1);
    });

    it("rejects sentence build mutations outside the answer phase", async () => {
      const db = seedDb(
        relaySentenceDuelDoc({
          relayPhase: "pick",
          relayPicker: "challenger",
          relayAssignedIndex: undefined,
        })
      );
      await expect(
        sentenceResetHandler(createCtx(db, "clerk_2", makeScheduler()), { duelId })
      ).rejects.toThrow(/answer phase/i);
    });
  });
});
