import { describe, expect, it, vi, afterEach } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import {
  consumeCredits,
  getCurrentMonthKey,
  normalizeCreditState,
} from "@/convex/credits";
import {
  LLM_MONTHLY_CREDITS,
  LLM_SMALL_ACTION_CREDITS,
  LLM_THEME_CREDITS,
  TTS_GENERATION_COST,
  TTS_MONTHLY_GENERATIONS,
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

class InMemoryDb {
  public users: UserDoc[] = [];

  query(_table: "users") {
    return createIndexedQuery(this.users);
  }

  async patch(id: Id<"users">, value: Partial<UserDoc>) {
    patchRow(this.users, id, value);
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
  }>;
})._handler;

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

  it("rejects out-of-range LLM costs", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc());

    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "llm", cost: LLM_SMALL_ACTION_CREDITS - 1 })
    ).rejects.toThrow("Invalid credit cost");
    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "llm", cost: LLM_THEME_CREDITS + 1 })
    ).rejects.toThrow("Invalid LLM credit cost");
  });
});

describe("consumeCredits behavior", () => {
  it("debits LLM and TTS balances independently", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ llmCreditsRemaining: 5, ttsGenerationsRemaining: 3 }));

    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "llm", cost: LLM_THEME_CREDITS })
    ).resolves.toMatchObject({ llmCreditsRemaining: 3, ttsGenerationsRemaining: 3 });
    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "tts", cost: TTS_GENERATION_COST })
    ).resolves.toMatchObject({ llmCreditsRemaining: 3, ttsGenerationsRemaining: 2 });

    expect(db.users[0]).toMatchObject({
      llmCreditsRemaining: 3,
      ttsGenerationsRemaining: 2,
    });
  });

  it("throws CREDITS_EXHAUSTED when either balance cannot cover the cost", async () => {
    const db = new InMemoryDb();
    db.users.push(userDoc({ llmCreditsRemaining: 0, ttsGenerationsRemaining: 0 }));

    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "llm", cost: LLM_SMALL_ACTION_CREDITS })
    ).rejects.toMatchObject({ data: { code: "CREDITS_EXHAUSTED" } });
    await expect(
      consumeCreditsHandler(createCtx(db), { creditType: "tts", cost: TTS_GENERATION_COST })
    ).rejects.toMatchObject({ data: { code: "CREDITS_EXHAUSTED" } });
  });

  it("resets stale monthly balance before debiting", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-06-01T00:00:00.000Z"));
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
      cost: LLM_THEME_CREDITS,
    });

    expect(result).toEqual({
      creditsMonth: "2026-06",
      llmCreditsRemaining: LLM_MONTHLY_CREDITS - LLM_THEME_CREDITS,
      ttsGenerationsRemaining: TTS_MONTHLY_GENERATIONS,
    });
    expect(db.users[0]).toMatchObject(result);
  });
});
