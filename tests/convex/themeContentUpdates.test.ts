import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { handleCreateTheme, handleUpdateTheme, handleApplyGeneratedThemeTts, type CreateThemeArgs } from "@/convex/themes/mutations";
import { getCurrentMonthKey } from "@/convex/credits";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";
const userId = "user" as Id<"users">;
const themeId = "theme" as Id<"themes">;
const round = { englishPrompt: "I eat bread", spanishSentence: "Yo como pan", distractors: ["Tu", "bebes", "agua"], wordMeanings: ["I", "eat", "bread"], freeWordPositions: [1] };
type SentenceTheme = Extract<Doc<"themes">, { contentType: "sentence" }>;
function fixture() {
  const user: Doc<"users"> = { _id: userId, _creationTime: 1, clerkId: "clerk", email: "user@example.test", creditsMonth: getCurrentMonthKey(), llmCreditsRemaining: 20, ttsGenerationsRemaining: 10 };
  const theme: SentenceTheme = { _id: themeId, _creationTime: 1, createdAt: 1, ownerId: userId, name: "SENTENCES", description: "", contentType: "sentence", sentenceRounds: [structuredClone(round)] };
  const patch = vi.fn(async (id: string, updates: Record<string, unknown>) => { Object.assign(id === userId ? user : theme, updates); });
  const insert = vi.fn(async (_table: string, _fields: Record<string, unknown>) => themeId);
  const runAfter = vi.fn();
  const db = { query: (table: string) => table === "users" ? createIndexedQuery([user]) : createIndexedQuery<{ _id: string }>([]), get: async (id: string) => id === themeId ? theme : id === userId ? user : null, patch, insert };
  const ctx = createAuthCtx(db, "clerk", { scheduler: { runAfter }, storage: { delete: vi.fn() } });
  return { user, theme, patch, insert, runAfter, ctx };
}
describe("theme content persistence boundaries", () => {
  it.each([
    [{ contentType: "word", sentenceRounds: [round] }, "Word themes cannot include sentenceRounds"],
    [{ contentType: "word" }, "Word themes require a words array"],
    [{ contentType: "sentence", words: [{ word: "cat", answer: "gato", wrongAnswers: ["perro"] }], sentenceRounds: [round] }, "Sentence themes cannot include a words array"],
    [{ contentType: "sentence" }, "Sentence themes require a sentenceRounds array"],
  ] as const)("rejects mismatched or absent content %j before writes", async (content, message) => {
    const f = fixture();
    await expect(handleCreateTheme(f.ctx as never, { name: "Valid name", description: "Valid description", ...content } as CreateThemeArgs)).rejects.toThrow(message);
    expect(f.insert).not.toHaveBeenCalled();
    expect(f.patch).not.toHaveBeenCalled();
    expect(f.runAfter).not.toHaveBeenCalled();
  });

  it("keeps saved meanings when only distractors and free-word selections change", async () => {
    const f = fixture();
    await handleUpdateTheme(f.ctx as never, { themeId, sentenceRounds: [{ ...round, distractors: ["ella", "bebe", "cafe"], wordMeanings: ["incorrect", "client", "hints"], freeWordPositions: [2] }] });
    expect(f.theme.sentenceRounds[0]).toMatchObject({ wordMeanings: ["I", "eat", "bread"], freeWordPositions: [2], distractors: ["ella", "bebe", "cafe"] });
    expect(f.runAfter).not.toHaveBeenCalled();
    expect(f.user.llmCreditsRemaining).toBe(20);
  });

  it("keeps meaning alignment when existing rounds are reordered", async () => {
    const f = fixture();
    const second = { ...round, englishPrompt: "You drink water", spanishSentence: "Tu bebes agua", wordMeanings: ["You", "drink", "water"], distractors: ["Yo", "como", "pan"] };
    f.theme.sentenceRounds.push(second);
    await handleUpdateTheme(f.ctx as never, { themeId, sentenceRounds: [second, round] });
    expect(f.theme.sentenceRounds.map(r => r.wordMeanings)).toEqual([["You", "drink", "water"], ["I", "eat", "bread"]]);
    expect(f.runAfter).not.toHaveBeenCalled();
  });

  it("clears curated free words and refreshes meanings after Spanish tokens change", async () => {
    const f = fixture();
    await handleUpdateTheme(f.ctx as never, { themeId, sentenceRounds: [{ ...round, spanishSentence: "Yo quiero pan" }] });
    expect(f.theme.sentenceRounds[0]).toMatchObject({ wordMeanings: ["placeholder", "placeholder", "placeholder"], freeWordPositions: [] });
    expect(f.runAfter).toHaveBeenCalledOnce();
    expect(f.runAfter.mock.calls[0][2]).toEqual({ themeId, rounds: [{ roundIndex: 0, englishPrompt: round.englishPrompt, spanishSentence: "Yo quiero pan" }] });
    expect(f.user.llmCreditsRemaining).toBeLessThan(20);
  });

  it.each([true, false])("new rounds schedule meaning refresh only when hints are incomplete (%s)", complete => {
    const f = fixture();
    const added = { englishPrompt: "We drink coffee", spanishSentence: "Nosotros bebemos cafe", distractors: ["tu", "pan", "leche"], wordMeanings: complete ? ["We", "drink", "coffee"] : ["placeholder", "placeholder", "placeholder"], freeWordPositions: [] };
    return handleUpdateTheme(f.ctx as never, { themeId, sentenceRounds: [round, added] }).then(() => {
      expect(f.runAfter.mock.calls.length).toBe(complete ? 0 : 1);
      expect(f.theme.sentenceRounds[1].wordMeanings).toEqual(complete ? ["We", "drink", "coffee"] : ["placeholder", "placeholder", "placeholder"]);
    });
  });

  it("preserves curated free words when a capitalization-only edit keeps the same tokens", async () => {
    const f = fixture();
    await handleUpdateTheme(f.ctx as never, { themeId, sentenceRounds: [{ ...round, spanishSentence: "yo como pan" }] });
    expect(f.theme.sentenceRounds[0]).toMatchObject({ wordMeanings: round.wordMeanings, freeWordPositions: [1] });
    expect(f.runAfter).not.toHaveBeenCalled();
  });

  it.each([false, true])("applies sentence audio only when its source signature still matches (%s)", stale => {
    const f = fixture();
    const generated = [{ index: 0, sourceSignature: JSON.stringify([stale ? "Changed" : round.englishPrompt, round.spanishSentence]), storageId: "new_audio" as Id<"_storage"> }];
    return handleApplyGeneratedThemeTts(f.ctx as never, { themeId, generated }).then(result => {
      expect(result).toEqual(stale ? { applied: 0, skipped: 1, rejectedStorageIds: ["new_audio"] } : { applied: 1, skipped: 0, rejectedStorageIds: [] });
      expect(f.theme.sentenceRounds[0].ttsStorageId).toBe(stale ? undefined : "new_audio");
      expect(f.patch.mock.calls.length).toBe(stale ? 0 : 1);
    });
  });
});
