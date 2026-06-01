import { afterEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { sendSabotage } from "@/convex/sabotage";
import { MAX_SABOTAGES } from "@/lib/sabotage/constants";
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
    | "duelMode"
    | "status"
    | "currentWordIndex"
    | "challengerAnswered"
    | "opponentAnswered"
    | "challengerScore"
    | "opponentScore"
    | "createdAt"
  >;

type Row = UserDoc | DuelDoc;
type TableRows = Row[];

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

function createCtx(db: InMemoryDb, identitySubject: string) {
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
    sessionWords: [],
    sourceType: "normal",
    duelMode: "pvp",
    status: "active",
    currentWordIndex: 0,
    challengerAnswered: false,
    opponentAnswered: false,
    challengerScore: 0,
    opponentScore: 0,
    createdAt: 1,
    questionStartTime: 1_000,
    hintPoolUsed: [],
    sentenceHintPoolUsed: [],
    currentQuestionHintFired: false,
    ...overrides,
  };
}

function seedDb(duelOverrides: Partial<DuelDoc> = {}) {
  const db = new InMemoryDb();
  db.users.push(
    userDoc(),
    userDoc({
      _id: "user_2" as Id<"users">,
      clerkId: "clerk_2",
      email: "opponent@example.com",
      name: "Opponent",
    })
  );
  db.duels.push(duelDoc(duelOverrides));
  return db;
}

const handler = (sendSabotage as unknown as {
  _handler: (
    ctx: unknown,
    args: { duelId: Id<"duels">; effect: "sticky" | "bounce" | "trampoline" | "reverse" }
  ) => Promise<void>;
})._handler;

describe("sendSabotage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("patches the opponent side when challenger sends sabotage", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const db = seedDb({ challengerSabotagesUsed: 1 });

    await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      effect: "sticky",
    });

    expect(db.duels[0].opponentSabotage).toEqual({ effect: "sticky", timestamp: 5_000 });
    expect(db.duels[0].challengerSabotagesUsed).toBe(2);
    expect(db.duels[0].challengerSabotage).toBeUndefined();
    expect(db.duels[0].opponentSabotagesUsed).toBeUndefined();
  });

  it("patches the challenger side and defaults usage count when opponent sends sabotage", async () => {
    vi.spyOn(Date, "now").mockReturnValue(6_000);
    const db = seedDb();

    await handler(createCtx(db, "clerk_2"), {
      duelId: "duel_1" as Id<"duels">,
      effect: "reverse",
    });

    expect(db.duels[0].challengerSabotage).toEqual({ effect: "reverse", timestamp: 6_000 });
    expect(db.duels[0].opponentSabotagesUsed).toBe(1);
    expect(db.duels[0].opponentSabotage).toBeUndefined();
    expect(db.duels[0].challengerSabotagesUsed).toBeUndefined();
  });

  it("blocks sabotage after the target has answered", async () => {
    const db = seedDb({ opponentAnswered: true });

    await expect(
      handler(createCtx(db, "clerk_1"), {
        duelId: "duel_1" as Id<"duels">,
        effect: "bounce",
      })
    ).rejects.toThrow("Opponent has already answered this question");

    expect(db.duels[0].opponentSabotage).toBeUndefined();
  });

  it("blocks sabotage after reaching the usage limit", async () => {
    const db = seedDb({ challengerSabotagesUsed: MAX_SABOTAGES });

    await expect(
      handler(createCtx(db, "clerk_1"), {
        duelId: "duel_1" as Id<"duels">,
        effect: "trampoline",
      })
    ).rejects.toThrow("No sabotages remaining");

    expect(db.duels[0].opponentSabotage).toBeUndefined();
  });

  it("blocks sabotage when no question is in progress", async () => {
    const db = seedDb({ questionStartTime: undefined });

    await expect(
      handler(createCtx(db, "clerk_1"), {
        duelId: "duel_1" as Id<"duels">,
        effect: "bounce",
      })
    ).rejects.toThrow("No active question to sabotage");

    expect(db.duels[0].opponentSabotage).toBeUndefined();
  });

  it("blocks a second sabotage on the same question even after the first expired", async () => {
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    // First sabotage was sent during the current question (timestamp >=
    // questionStartTime). Even though its 7s sticky window has elapsed, the
    // per-question gate must still reject a second send.
    const db = seedDb({
      questionStartTime: 1_000,
      opponentSabotage: { effect: "sticky", timestamp: 1_500 },
      challengerSabotagesUsed: 1,
    });

    await expect(
      handler(createCtx(db, "clerk_1"), {
        duelId: "duel_1" as Id<"duels">,
        effect: "bounce",
      })
    ).rejects.toThrow("You've already used a sabotage on this question");

    // No state changes from the rejected call.
    expect(db.duels[0].opponentSabotage).toEqual({ effect: "sticky", timestamp: 1_500 });
    expect(db.duels[0].challengerSabotagesUsed).toBe(1);
  });

  it("allows a sabotage on a new question even if one was sent on the previous", async () => {
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    // Previous sabotage's timestamp predates the current question's start.
    const db = seedDb({
      questionStartTime: 10_000,
      opponentSabotage: { effect: "sticky", timestamp: 1_500 },
      challengerSabotagesUsed: 1,
    });

    await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      effect: "bounce",
    });

    expect(db.duels[0].opponentSabotage).toEqual({ effect: "bounce", timestamp: 20_000 });
    expect(db.duels[0].challengerSabotagesUsed).toBe(2);
  });

  it("blocks sabotage in PvE duels", async () => {
    const db = seedDb({ duelMode: "pve" });

    await expect(
      handler(createCtx(db, "clerk_1"), {
        duelId: "duel_1" as Id<"duels">,
        effect: "sticky",
      })
    ).rejects.toThrow("sendSabotage is only available in PVP duels");
  });

  // Part C: sabotages now ship on the build-and-confirm sentence board. A PvP
  // sentence round accepts them (the old kind === "sentence" reject is gone),
  // while PvE/self-duel sentence rounds still reject (their tool is the hint
  // pool), and the shared cap + one-per-question rule still hold on sentences.
  const sentenceDuelOverrides: Partial<DuelDoc> = {
    sessionWords: [
      {
        kind: "sentence",
        englishPrompt: "I want coffee",
        spanishSentence: "Quiero cafe",
        distractors: ["leche"],
        themeId: "theme_1" as Id<"themes">,
        themeName: "Cafe",
      },
    ],
    duelQuestions: [
      {
        kind: "sentence",
        englishPrompt: "I want coffee",
        spanishSentence: "Quiero cafe",
        tilePool: ["Quiero", "cafe", "leche"],
      },
    ],
    wordOrder: [0],
  };

  it("accepts a sabotage on a PvP sentence round", async () => {
    vi.spyOn(Date, "now").mockReturnValue(5_000);
    const db = seedDb(sentenceDuelOverrides);

    await handler(createCtx(db, "clerk_1"), {
      duelId: "duel_1" as Id<"duels">,
      effect: "bounce",
    });

    expect(db.duels[0].opponentSabotage).toEqual({ effect: "bounce", timestamp: 5_000 });
    expect(db.duels[0].challengerSabotagesUsed).toBe(1);
  });

  it("still rejects a sabotage on a PvE sentence round", async () => {
    const db = seedDb({ ...sentenceDuelOverrides, duelMode: "pve" });

    await expect(
      handler(createCtx(db, "clerk_1"), {
        duelId: "duel_1" as Id<"duels">,
        effect: "reverse",
      })
    ).rejects.toThrow("sendSabotage is only available in PVP duels");
  });

  it("still caps sabotages at the shared budget on a sentence round", async () => {
    const db = seedDb({ ...sentenceDuelOverrides, challengerSabotagesUsed: MAX_SABOTAGES });

    await expect(
      handler(createCtx(db, "clerk_1"), {
        duelId: "duel_1" as Id<"duels">,
        effect: "sticky",
      })
    ).rejects.toThrow("No sabotages remaining");
  });

  it("still enforces one sabotage per question on a sentence round", async () => {
    vi.spyOn(Date, "now").mockReturnValue(20_000);
    const db = seedDb({
      ...sentenceDuelOverrides,
      questionStartTime: 1_000,
      opponentSabotage: { effect: "sticky", timestamp: 1_500 },
      challengerSabotagesUsed: 1,
    });

    await expect(
      handler(createCtx(db, "clerk_1"), {
        duelId: "duel_1" as Id<"duels">,
        effect: "trampoline",
      })
    ).rejects.toThrow("You've already used a sabotage on this question");
  });
});
