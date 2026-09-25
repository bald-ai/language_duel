import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  answerDuel,
  answerSentenceRound,
  completeSpacedRepetitionDuelInternal,
  completeWeeklyGoalMilestoneDuelInternal,
  confirmUnpauseCountdown,
  skipCountdown,
  timeoutAnswer,
} from "@/convex/gameplay";
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
    | "sessionItems"
    | "sourceType"
    | "duelMode"
    | "status"
    | "currentItemIndex"
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

function createCtx(
  db: InMemoryDb,
  identitySubject: string | null,
  schedulerRunAfter: ReturnType<typeof vi.fn> = vi.fn()
) {
  return createAuthCtx(db, identitySubject, {
    scheduler: {
      runAfter: schedulerRunAfter,
    },
  });
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
    sessionItems: [
      {
        kind: "word" as const, word: "cat",
        answer: "gato",
        wrongAnswers: ["perro", "mesa", "casa", "libro", "silla", "tren"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Animals",
      },
    ],
    duelQuestions: [
      {
        kind: "word" as const, options: ["perro", "mesa", "casa", "libro", NONE_OF_ABOVE],
        correctOption: "gato",
        difficulty: "hard",
        points: 2,
      },
    ],
    sourceType: "normal",
    duelMode: "pvp",
    status: "active",
    currentItemIndex: 0,
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    createdAt: 1,
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
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
            kind: "word" as const, options: ["perro", "mesa", "casa", "libro", NONE_OF_ABOVE],
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
      ) => Promise<{ completed: boolean; completeWeeklyGoalMilestone: boolean; completeSpacedRepetition: boolean }>;
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
            kind: "word" as const, options: ["gato", "perro", "mesa", "casa"],
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
            kind: "word" as const, options: ["perro", "mesa", "casa", "libro", NONE_OF_ABOVE],
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

  it("removes shared limited lives when players miss", async () => {
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
        livesTotal: 3,
        livesRemaining: 3,
        challengerPerfectRun: true,
        opponentPerfectRun: true,
        duelQuestions: [
          {
            kind: "word" as const, options: ["gato", "perro", "mesa", "casa"],
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

    expect(db.duels[0].livesRemaining).toBe(2);
    expect(db.duels[0].status).toBe("active");
    expect(db.duels[0].challengerPerfectRun).toBe(false);

    const schedulerRunAfter = vi.fn();
    const result = await handler(createCtx(db, "clerk_2", schedulerRunAfter), {
      duelId: "duel_1" as Id<"duels">,
      selectedAnswer: "mesa",
      questionIndex: 0,
    });

    expect(result).toEqual({
      completed: true,
      completeWeeklyGoalMilestone: true,
      completeSpacedRepetition: false,
    });
    expect(db.duels[0].livesRemaining).toBe(1);
    expect(db.duels[0].status).toBe("completed");
    expect(db.duels[0].opponentPerfectRun).toBe(false);
    // Boss completion must be scheduled server-side so it does not depend on the
    // answering client staying connected.
    expect(schedulerRunAfter).toHaveBeenCalledTimes(1);
    expect(schedulerRunAfter.mock.calls[0][2]).toEqual({
      duelId: "duel_1",
    });
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
        livesTotal: 1,
        livesRemaining: 1,
        challengerPerfectRun: true,
        opponentPerfectRun: true,
      })
    );

    const handler = (timeoutAnswer as unknown as {
      _handler: (
        ctx: unknown,
        args: { duelId: Id<"duels">; questionIndex: number }
      ) => Promise<{ completed: boolean; completeWeeklyGoalMilestone: boolean; completeSpacedRepetition: boolean }>;
    })._handler;

    const result = await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      questionIndex: 0,
    });

    expect(result).toEqual({
      completed: true,
      completeWeeklyGoalMilestone: false,
      completeSpacedRepetition: false,
    });
    expect(db.duels[0].livesRemaining).toBe(0);
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
        currentItemIndex: 1,
        sessionItems: [
          {
            kind: "word" as const, word: "cat",
            answer: "gato",
            wrongAnswers: ["perro", "mesa", "casa"],
            themeId: "theme_1" as Id<"themes">,
            themeName: "Animals",
          },
          {
            kind: "word" as const, word: "dog",
            answer: "perro",
            wrongAnswers: ["gato", "mesa", "casa"],
            themeId: "theme_1" as Id<"themes">,
            themeName: "Animals",
          },
        ],
        duelQuestions: [
          {
            kind: "word" as const, options: ["gato", "perro", "mesa", "casa"],
            correctOption: "gato",
            difficulty: "easy",
            points: 1,
          },
          {
            kind: "word" as const, options: ["perro", "gato", "mesa", "casa"],
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
    expect(db.duels[0].currentItemIndex).toBe(1);
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

describe("duel lifecycle completion commands", () => {
  function setupCtx(duel: DuelDoc) {
    const db = new InMemoryDb();
    db.users.push(
      userDoc(),
      userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2", email: "p@example.com" })
    );
    db.duels.push(duel);
    return db;
  }

  const internalBossHandler = (completeWeeklyGoalMilestoneDuelInternal as unknown as {
    _handler: (
      ctx: unknown,
      args: { duelId: Id<"duels"> }
    ) => Promise<{ completed: boolean }>;
  })._handler;

  const internalSrHandler = (completeSpacedRepetitionDuelInternal as unknown as {
    _handler: (
      ctx: unknown,
      args: { duelId: Id<"duels"> }
    ) => Promise<{ completed: boolean }>;
  })._handler;

  it("completeWeeklyGoalMilestoneDuelInternal returns completed:false when the duel is missing", async () => {
    const db = setupCtx(duelDoc());
    const result = await internalBossHandler(createCtx(db, null), {
      duelId: "duel_missing" as Id<"duels">,
    });
    expect(result).toEqual({ completed: false });
  });

  it("completeWeeklyGoalMilestoneDuelInternal refuses an active (not completed) duel", async () => {
    const db = setupCtx(
      duelDoc({
        status: "active",
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        sourceType: "boss",
        bossType: "mini",
        livesTotal: 1,
        livesRemaining: 1,
      })
    );
    const result = await internalBossHandler(createCtx(db, null), {
      duelId: "duel_1" as Id<"duels">,
    });
    expect(result).toEqual({ completed: false });
  });

  it("completeWeeklyGoalMilestoneDuelInternal refuses a non-boss completed duel", async () => {
    const db = setupCtx(duelDoc({ status: "completed" }));
    const result = await internalBossHandler(createCtx(db, null), {
      duelId: "duel_1" as Id<"duels">,
    });
    expect(result).toEqual({ completed: false });
  });

  it("completeWeeklyGoalMilestoneDuelInternal refuses a boss attempt with no remaining lives", async () => {
    const db = setupCtx(
      duelDoc({
        status: "completed",
        weeklyGoalId: "goal_1" as Id<"weeklyGoals">,
        sourceType: "boss",
        bossType: "big",
        livesTotal: 3,
        livesRemaining: 0,
      })
    );
    const result = await internalBossHandler(createCtx(db, null), {
      duelId: "duel_1" as Id<"duels">,
    });
    // Idempotency-style guard: defeated boss without remaining lives is a loss,
    // not a defeat — calling the lifecycle command must not advance anything.
    expect(result).toEqual({ completed: false });
  });

  it("completeSpacedRepetitionDuelInternal returns completed:false for non-SR duels", async () => {
    const db = setupCtx(duelDoc({ status: "completed", sourceType: "normal" }));
    const result = await internalSrHandler(createCtx(db, null), {
      duelId: "duel_1" as Id<"duels">,
    });
    expect(result).toEqual({ completed: false });
  });

  it("completeSpacedRepetitionDuelInternal returns completed:false when the duel is missing", async () => {
    const db = setupCtx(duelDoc());
    const result = await internalSrHandler(createCtx(db, null), {
      duelId: "duel_missing" as Id<"duels">,
    });
    expect(result).toEqual({ completed: false });
  });
});

describe("self-duel gameplay", () => {
  function selfDuelDoc(overrides: Partial<DuelDoc> = {}): DuelDoc {
    return duelDoc({
      opponentId: "user_1" as Id<"users">,
      duelMode: "pve",
      ...overrides,
    });
  }

  const answerHandler = (answerDuel as unknown as {
    _handler: (
      ctx: unknown,
      args: { duelId: Id<"duels">; selectedAnswer: string; questionIndex: number }
    ) => Promise<{ completed: boolean; completeWeeklyGoalMilestone: boolean; completeSpacedRepetition: boolean }>;
  })._handler;

  const timeoutHandler = (timeoutAnswer as unknown as {
    _handler: (
      ctx: unknown,
      args: { duelId: Id<"duels">; questionIndex: number }
    ) => Promise<{ completed: boolean; completeWeeklyGoalMilestone: boolean; completeSpacedRepetition: boolean }>;
  })._handler;

  const confirmUnpauseHandler = (confirmUnpauseCountdown as unknown as {
    _handler: (ctx: unknown, args: { duelId: Id<"duels"> }) => Promise<void>;
  })._handler;

  const skipCountdownHandler = (skipCountdown as unknown as {
    _handler: (
      ctx: unknown,
      args: { duelId: Id<"duels"> }
    ) => Promise<{ bothSkipped: boolean }>;
  })._handler;

  it("mirrors a correct answer onto the opponent half and completes the round on one input", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.duels.push(
      selfDuelDoc({
        sessionItems: [
          {
            kind: "word" as const, word: "cat",
            answer: "gato",
            wrongAnswers: ["perro", "mesa", "casa"],
            themeId: "theme_1" as Id<"themes">,
            themeName: "Animals",
          },
        ],
        duelQuestions: [
          {
            kind: "word" as const, options: ["gato", "perro", "mesa", "casa"],
            correctOption: "gato",
            difficulty: "easy",
            points: 1,
          },
        ],
      })
    );

    const result = await answerHandler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      selectedAnswer: "gato",
      questionIndex: 0,
    });

    expect(result).toMatchObject({ completed: true });
    expect(db.duels[0].challengerAnswered).toBe(false);
    expect(db.duels[0].opponentAnswered).toBe(false);
    expect(db.duels[0].challengerScore).toBe(1);
    expect(db.duels[0].opponentScore).toBe(1);
    expect(db.duels[0].status).toBe("completed");
  });

  it("mirrors a timeout onto the opponent half without touching scores", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.duels.push(selfDuelDoc());

    const result = await timeoutHandler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      questionIndex: 0,
    });

    expect(result.completed).toBe(true);
    expect(db.duels[0].challengerScore).toBe(0);
    expect(db.duels[0].opponentScore).toBe(0);
    expect(db.duels[0].challengerLastAnswer).toBe("__TIMEOUT__");
    expect(db.duels[0].opponentLastAnswer).toBe("__TIMEOUT__");
    expect(db.duels[0].status).toBe("completed");
  });

  it("confirmUnpauseCountdown clears pause fields immediately on self-duel with no prior request", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000);
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.duels.push(
      selfDuelDoc({
        countdownPausedBy: "challenger",
        countdownPausedAt: 1_500,
        questionStartTime: 1_000,
      })
    );

    await confirmUnpauseHandler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
    });

    expect(db.duels[0]).toMatchObject({
      countdownPausedBy: undefined,
      countdownPausedAt: undefined,
      countdownUnpauseRequestedBy: undefined,
      questionStartTime: 1_000 + 500,
    });
  });

  it("confirmUnpauseCountdown succeeds after the same user's own request on self-duel", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000);
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.duels.push(
      selfDuelDoc({
        countdownPausedBy: "challenger",
        countdownUnpauseRequestedBy: "challenger",
        countdownPausedAt: 1_500,
        questionStartTime: 1_000,
      })
    );

    await expect(
      confirmUnpauseHandler(createCtx(db, "clerk_1"), {
        duelId: "duel_1" as Id<"duels">,
      })
    ).resolves.toBeUndefined();

    expect(db.duels[0].countdownPausedBy).toBeUndefined();
  });

  it("skipCountdown returns bothSkipped:true and writes both roles for self-duel", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.duels.push(selfDuelDoc());

    const result = await skipCountdownHandler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
    });

    expect(result).toEqual({ bothSkipped: true });
    expect(db.duels[0].countdownSkipRequestedBy).toEqual(["challenger", "opponent"]);
  });

  it("skipCountdown collapses the unspent transition offset onto questionStartTime when both skip", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.duels.push(
      selfDuelDoc({
        // 1s into a 5s transition before the second (offset-bearing) question.
        currentItemIndex: 1,
        questionStartTime: 9_000,
      })
    );

    await skipCountdownHandler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
    });

    // Effective start (questionStartTime + 5s) was 14_000, i.e. 4s ahead of the
    // 10_000 skip moment. Collapsing that 4s makes the effective start equal to
    // now, so the next question's timer starts ticking immediately.
    expect(db.duels[0].questionStartTime).toBe(5_000);
  });

  it("skipCountdown never shortens an already-active question timer", async () => {
    vi.spyOn(Date, "now").mockReturnValue(10_000);
    const db = new InMemoryDb();
    db.users.push(userDoc());
    db.duels.push(
      selfDuelDoc({
        // Transition offset already elapsed (effective start 4_000 < now).
        currentItemIndex: 1,
        questionStartTime: -1_000,
      })
    );

    await skipCountdownHandler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
    });

    expect(db.duels[0].questionStartTime).toBe(-1_000);
  });
});


describe("two-player countdown handshake", () => {
  afterEach(() => vi.restoreAllMocks());
  const confirm = (confirmUnpauseCountdown as unknown as { _handler: (ctx: unknown, args: { duelId: Id<"duels"> }) => Promise<void> })._handler;
  function fixture(overrides: Partial<DuelDoc> = {}) {
    const db = new InMemoryDb();
    db.users.push(userDoc(), userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" }));
    db.duels.push(duelDoc(overrides));
    const patch = vi.spyOn(db, "patch");
    return { db, patch, run: (clerk = "clerk_2") => confirm(createCtx(db, clerk), { duelId: "duel_1" as Id<"duels"> }) };
  }
  it.each([{}, { countdownPausedBy: "challenger" }] as const)("does nothing without a paused, requested handshake %j", state => {
    const f = fixture(state);
    return expect(f.run().then(() => f.patch.mock.calls)).resolves.toEqual([]);
  });
  it("rejects confirmation from the requester", async () => {
    const f = fixture({ countdownPausedBy: "challenger", countdownUnpauseRequestedBy: "challenger", countdownPausedAt: 1500, questionStartTime: 1000 });
    await expect(f.run("clerk_1")).rejects.toThrow("Cannot confirm your own unpause request");
    expect(f.patch).not.toHaveBeenCalled();
  });
  it.each([
    { countdownPausedAt: 1500, questionStartTime: 1000, expected: 1500 },
    { countdownPausedAt: undefined, questionStartTime: 1000, expected: 1000 },
    { countdownPausedAt: 1500, questionStartTime: undefined, expected: undefined },
  ])("clears the handshake and shifts the question anchor by elapsed pause %j", async ({ expected, ...timestamps }) => {
    vi.spyOn(Date, "now").mockReturnValue(2000);
    const f = fixture({ countdownPausedBy: "challenger", countdownUnpauseRequestedBy: "challenger", ...timestamps });
    await expect(f.run()).resolves.toBeUndefined();
    expect(f.patch).toHaveBeenCalledExactlyOnceWith("duel_1", { countdownPausedBy: undefined, countdownUnpauseRequestedBy: undefined, countdownPausedAt: undefined, questionStartTime: expected });
  });
});

describe("sentence answer mutation", () => {
  const submit = (answerSentenceRound as unknown as { _handler: (ctx: unknown, args: { duelId: Id<"duels">; questionIndex: number; timedOut: boolean }) => Promise<unknown> })._handler;
  function setup() {
    const duel = duelDoc({ sessionItems: [{ kind: "sentence", englishPrompt: "I want coffee", spanishSentence: "Quiero cafe", wordMeanings: ["I want", "coffee"], freeWordPositions: [], distractors: ["leche", "agua", "pan"], themeId: "theme_1" as Id<"themes">, themeName: "Cafe" }],
      duelQuestions: [{ kind: "sentence", englishPrompt: "I want coffee", spanishSentence: "Quiero cafe", tilePool: ["Quiero", "cafe", "leche"], tileMeanings: ["I want", "coffee", "milk"] }],
      sentenceProgress: [{ questionIndex: 0, role: "challenger", placedTileIndices: [0, 1], mistakes: 0, completed: true, finalized: false, failedConfirms: 0 }],
    });
    const db = new InMemoryDb(); db.duels.push(duel); db.users.push(userDoc(), userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" }));
    const patch = vi.spyOn(db, "patch"); const scheduler = vi.fn();
    return { get duel() { return db.duels[0]; }, db, patch, scheduler, run: (clerk = "clerk_1", questionIndex = 0, timedOut = false) => submit(createCtx(db, clerk, scheduler), { duelId: duel._id, questionIndex, timedOut }) };
  }
  it("scores stored confirmation state once and waits for the opponent", async () => {
    const f = setup();
    await expect(f.run()).resolves.toMatchObject({ completed: false });
    expect(f.duel).toMatchObject({ status: "active", challengerAnswered: true, challengerScore: 1, opponentAnswered: false });
    expect(f.duel.sentenceProgress?.[0].finalized).toBe(true);
    await f.run(); expect(f.patch).toHaveBeenCalledOnce(); expect(f.duel.challengerScore).toBe(1); expect(f.scheduler).not.toHaveBeenCalled();
  });
  it("finalizes a timed-out opponent submission with no points and retains the last valid question index", async () => {
    const f = setup(); await f.run();
    await expect(f.run("clerk_2", 0, true)).resolves.toMatchObject({ completed: true });
    expect(f.duel).toMatchObject({ status: "completed", challengerScore: 1, opponentScore: 0, opponentAnswered: false, currentItemIndex: 0 });
    expect(f.duel.sentenceProgress?.find(progress => progress.role === "opponent")).toMatchObject({ finalized: true, completed: false });
  });
  it("rejects a word question before recording sentence progress", async () => {
    const f = setup(); f.duel.duelQuestions = duelDoc().duelQuestions;
    await expect(f.run()).rejects.toThrow("Use answerDuel instead"); expect(f.patch).not.toHaveBeenCalled();
  });
  it("rejects stale question submissions before applying points", async () => {
    const f = setup(); await expect(f.run("clerk_1", 1)).rejects.toThrow("question has changed");
    expect(f.patch).not.toHaveBeenCalled(); expect(f.duel.challengerScore).toBe(0);
  });
});
