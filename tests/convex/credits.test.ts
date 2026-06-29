import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  consumeCredits,
  getCurrentMonthKey,
  normalizeCreditState,
  refundConsumedCredits,
} from "@/convex/credits";
import {
  LLM_FIELD_REGEN_CREDITS,
  LLM_GENERATE_MORE_SENTENCES_CREDITS,
  LLM_MONTHLY_CREDITS,
  LLM_SENTENCE_THEME_CREDITS,
  TTS_GENERATION_COST,
  TTS_MONTHLY_GENERATIONS,
  VALID_LLM_CREDIT_COSTS,
} from "@/lib/credits/constants";
import { createAuthCtx, createIndexedQuery, patchRow } from "./testUtils/inMemoryDb";

type UserDoc = Pick<
  Doc<"users">,
  | "_id"
  | "_creationTime"
  | "clerkId"
  | "email"
  | "nickname"
  | "llmCreditsRemaining"
  | "ttsGenerationsRemaining"
  | "creditsMonth"
>;
type CreditTransactionDoc = Pick<
  Doc<"creditTransactions">,
  | "_id"
  | "_creationTime"
  | "userId"
  | "creditType"
  | "cost"
  | "creditsMonth"
  | "status"
  | "createdAt"
  | "refundedAt"
>;

class InMemoryDb {
  public users: UserDoc[] = [];
  public creditTransactions: CreditTransactionDoc[] = [];
  private creditTransactionCounter = 1;

  query(table: "users" | "creditTransactions") {
    if (table === "creditTransactions") {
      return createIndexedQuery(this.creditTransactions);
    }
    return createIndexedQuery(this.users);
  }

  async get(id: string) {
    return this.creditTransactions.find((row) => row._id === id) ?? null;
  }

  async patch(id: Id<"users">, value: Partial<UserDoc>) {
    if (id.toString().startsWith("creditTransaction_")) {
      patchRow(this.creditTransactions, id, value);
      return;
    }
    patchRow(this.users, id, value);
  }

  async insert(
    _table: "creditTransactions",
    value: Omit<CreditTransactionDoc, "_id" | "_creationTime">
  ) {
    const id = `creditTransaction_${this.creditTransactionCounter}` as Id<"creditTransactions">;
    this.creditTransactionCounter += 1;
    this.creditTransactions.push({
      _id: id,
      _creationTime: Date.now(),
      ...value,
    });
    return id;
  }
}

function userDoc(overrides: Partial<UserDoc> = {}): UserDoc {
  return {
    _id: "user_1" as Id<"users">,
    _creationTime: 1,
    clerkId: "clerk_1",
    email: "user@example.com",
    nickname: "User",
    creditsMonth: "2026-05",
    llmCreditsRemaining: 20,
    ttsGenerationsRemaining: 10,
    ...overrides,
  };
}

function createCtx(db: InMemoryDb, identitySubject = "clerk_1") {
  return createAuthCtx(db, identitySubject);
}

const consumeCreditsHandler = (consumeCredits as unknown as {
  _handler: (
    ctx: unknown,
    args: { creditType: "llm" | "tts"; cost: number }
  ) => Promise<{
    llmCreditsRemaining: number;
    ttsGenerationsRemaining: number;
    creditsMonth: string;
    creditTransactionId: Id<"creditTransactions">;
  }>;
})._handler;

const refundConsumedCreditsHandler = (refundConsumedCredits as unknown as {
  _handler: (
    ctx: unknown,
    args: { creditTransactionId: Id<"creditTransactions"> }
  ) => Promise<{
    llmCreditsRemaining: number;
    ttsGenerationsRemaining: number;
    creditsMonth: string;
  }>;
})._handler;

function setCurrentTime(isoDate: string) {
  vi.spyOn(Date, "now").mockReturnValue(Date.parse(isoDate));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("credits helpers", () => {
  it("uses UTC month keys across timezone-sensitive boundaries", () => {
    expect(getCurrentMonthKey(Date.parse("2025-12-31T23:30:00.000Z"))).toBe("2025-12");
    expect(getCurrentMonthKey(Date.parse("2026-01-01T00:30:00.000Z"))).toBe("2026-01");
    expect(getCurrentMonthKey(Date.parse("2026-03-01T00:30:00+14:00"))).toBe("2026-02");
  });

  it("keeps existing balances when the stored month and credit fields are current", () => {
    const result = normalizeCreditState(
      userDoc({ creditsMonth: "2026-05", llmCreditsRemaining: 7, ttsGenerationsRemaining: 8 }),
      Date.parse("2026-05-18T12:00:00.000Z")
    );

    expect(result).toEqual({
      creditsMonth: "2026-05",
      llmCreditsRemaining: 7,
      ttsGenerationsRemaining: 8,
      shouldReset: false,
    });
  });

  it("resets balances when the month changes", () => {
    expect(
      normalizeCreditState(userDoc({ creditsMonth: "2026-04" }), Date.parse("2026-05-01T00:00:00.000Z"))
    ).toMatchObject({
      creditsMonth: "2026-05",
      llmCreditsRemaining: LLM_MONTHLY_CREDITS,
      ttsGenerationsRemaining: TTS_MONTHLY_GENERATIONS,
      shouldReset: true,
    });
  });

  it("resets balances when either credit field is missing", () => {
    expect(
      normalizeCreditState(
        userDoc({ llmCreditsRemaining: undefined }),
        Date.parse("2026-05-18T12:00:00.000Z")
      ).shouldReset
    ).toBe(true);
    expect(
      normalizeCreditState(
        userDoc({ ttsGenerationsRemaining: undefined }),
        Date.parse("2026-05-18T12:00:00.000Z")
      ).shouldReset
    ).toBe(true);
  });
});

describe("consumeCredits validation", () => {
  it.each([0, -1, Number.POSITIVE_INFINITY, Number.NaN, 1.5])(
    "rejects invalid credit costs: %s",
    async (cost) => {
      const db = new InMemoryDb();
      db.users.push(userDoc());

      await expect(
        consumeCreditsHandler(createCtx(db), { creditType: "llm", cost })
      ).rejects.toThrow("Invalid credit cost");
    }
  );

  it("rejects the wrong TTS cost", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());

    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "tts", cost: TTS_GENERATION_COST + 1 })
    ).rejects.toThrow("Invalid TTS credit cost");
  });

  it.each(Array.from(new Set(VALID_LLM_CREDIT_COSTS)))(
    "allows known LLM action cost %s",
    async (cost) => {
      const db = new InMemoryDb();
      db.users.push(userDoc({ creditsMonth: getCurrentMonthKey(), llmCreditsRemaining: 100 }));

      await expect(
        consumeCreditsHandler(createCtx(db), { creditType: "llm", cost })
      ).resolves.toMatchObject({ llmCreditsRemaining: 100 - cost });
    }
  );

  it("rejects unknown positive LLM costs", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());

    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "llm", cost: 2 })
    ).rejects.toThrow("Invalid LLM credit cost");
  });
});

describe("consumeCredits behavior", () => {
  beforeEach(() => {
    setCurrentTime("2026-05-18T12:00:00.000Z");
  });

  it("debits LLM and TTS balances independently", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ llmCreditsRemaining: 25, ttsGenerationsRemaining: 3 }));

    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "llm", cost: LLM_SENTENCE_THEME_CREDITS })
    ).resolves.toMatchObject({ llmCreditsRemaining: 5, ttsGenerationsRemaining: 3 });
    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "tts", cost: TTS_GENERATION_COST })
    ).resolves.toMatchObject({ llmCreditsRemaining: 5, ttsGenerationsRemaining: 2 });

    expect(db.users[0]).toMatchObject({
      llmCreditsRemaining: 5,
      ttsGenerationsRemaining: 2,
    });
    expect(db.creditTransactions).toHaveLength(2);
    expect(db.creditTransactions.map((transaction) => transaction.status)).toEqual([
      "consumed",
      "consumed",
    ]);
  });

  it("throws CREDITS_EXHAUSTED when either balance cannot cover the cost", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ llmCreditsRemaining: 0, ttsGenerationsRemaining: 0 }));

    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "llm", cost: LLM_FIELD_REGEN_CREDITS })
    ).rejects.toMatchObject({ data: { code: "CREDITS_EXHAUSTED" } });
    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "tts", cost: TTS_GENERATION_COST })
    ).rejects.toMatchObject({ data: { code: "CREDITS_EXHAUSTED" } });
  });

  it("resets stale monthly balance before debiting", async () => {
    setCurrentTime("2026-06-01T00:00:00.000Z");
    const db = new InMemoryDb();
    db.users.push(
      userDoc({
        creditsMonth: "2026-05",
        llmCreditsRemaining: 0,
        ttsGenerationsRemaining: 0,
      })
    );

    const result = await consumeCreditsHandler(createCtx(db), {
      creditType: "llm",
      cost: LLM_GENERATE_MORE_SENTENCES_CREDITS,
    });

    expect(result).toMatchObject({
      creditsMonth: "2026-06",
      llmCreditsRemaining: LLM_MONTHLY_CREDITS - LLM_GENERATE_MORE_SENTENCES_CREDITS,
      ttsGenerationsRemaining: TTS_MONTHLY_GENERATIONS,
    });
    expect(db.users[0]).toMatchObject({
      creditsMonth: "2026-06",
      llmCreditsRemaining: LLM_MONTHLY_CREDITS - LLM_GENERATE_MORE_SENTENCES_CREDITS,
      ttsGenerationsRemaining: TTS_MONTHLY_GENERATIONS,
    });
  });

  it("refunds a consumed credit transaction exactly once", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ llmCreditsRemaining: 25, ttsGenerationsRemaining: 3 }));

    const consumed = await consumeCreditsHandler(createCtx(db), {
      creditType: "llm",
      cost: LLM_SENTENCE_THEME_CREDITS,
    });

    expect(db.users[0]?.llmCreditsRemaining).toBe(5);

    await expect(
      refundConsumedCreditsHandler(createCtx(db), {
        creditTransactionId: consumed.creditTransactionId,
      })
    ).resolves.toMatchObject({
      llmCreditsRemaining: 25,
      ttsGenerationsRemaining: 3,
    });

    expect(db.creditTransactions[0]).toMatchObject({ status: "refunded" });
    await expect(
      refundConsumedCreditsHandler(createCtx(db), {
        creditTransactionId: consumed.creditTransactionId,
      })
    ).rejects.toThrow("Credit transaction already refunded");
  });

  it("does not refund another user's credit transaction", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ _id: "user_1" as Id<"users">, clerkId: "clerk_1" }));
    db.users.push(userDoc({ _id: "user_2" as Id<"users">, clerkId: "clerk_2" }));

    const consumed = await consumeCreditsHandler(createCtx(db, "clerk_1"), {
      creditType: "tts",
      cost: TTS_GENERATION_COST,
    });

    await expect(
      refundConsumedCreditsHandler(createCtx(db, "clerk_2"), {
        creditTransactionId: consumed.creditTransactionId,
      })
    ).rejects.toThrow("Credit transaction not found");
  });
});
