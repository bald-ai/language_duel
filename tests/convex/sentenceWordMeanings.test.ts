import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { applySentenceWordMeanings, getSentenceThemeForWordMeaningRefresh, refreshSentenceWordMeanings } from "@/convex/themes/sentenceWordMeanings";
const mocks = vi.hoisted(() => ({ create: vi.fn(), construct: vi.fn() }));
vi.mock("openai", () => ({ default: class MockOpenAI {
  responses = { create: mocks.create };
  constructor(options: unknown) { mocks.construct(options); }
} }));
type Target = { roundIndex: number; englishPrompt: string; spanishSentence: string };
type Generated = Target & { wordMeanings: string[] };
const themeId = "theme" as Id<"themes">;
const baseRound = { englishPrompt: "I want coffee", spanishSentence: "Quiero cafe", distractors: ["pan", "leche", "agua"], wordMeanings: ["placeholder", "placeholder"], freeWordPositions: [1] };
const target: Target = { roundIndex: 0, englishPrompt: baseRound.englishPrompt, spanishSentence: baseRound.spanishSentence };
const read = (getSentenceThemeForWordMeaningRefresh as unknown as { _handler: (ctx: unknown, args: { themeId: Id<"themes"> }) => Promise<Doc<"themes"> | null> })._handler;
const apply = (applySentenceWordMeanings as unknown as { _handler: (ctx: unknown, args: { themeId: Id<"themes">; generated: Generated[] }) => Promise<{ applied: number; skipped: number }> })._handler;
const refresh = (refreshSentenceWordMeanings as unknown as { _handler: (ctx: unknown, args: { themeId: Id<"themes">; rounds: Target[] }) => Promise<{ generated: number; applied: number; skipped: number }> })._handler;
function fixture(initial?: Doc<"themes"> | null) {
  let theme: Doc<"themes"> | null = initial === undefined ? { _id: themeId, _creationTime: 1, createdAt: 1, contentType: "sentence", name: "CAFE", description: "", sentenceRounds: [baseRound] } : initial;
  const patch = vi.fn(async (_id: Id<"themes">, updates: Partial<Extract<Doc<"themes">, { contentType: "sentence" }>>) => {
    theme = { ...theme, ...updates } as Doc<"themes">;
  });
  const mutationCtx = { db: { get: vi.fn(async () => theme), patch } };
  const runQuery = vi.fn(async (_ref: unknown, args: { themeId: Id<"themes"> }) => read(mutationCtx, args));
  const runMutation = vi.fn(async (_ref: unknown, args: { themeId: Id<"themes">; generated: Generated[] }) => apply(mutationCtx, args));
  return { ctx: { runQuery, runMutation }, mutationCtx, patch, runQuery, runMutation, theme: () => theme, setTheme: (next: Doc<"themes"> | null) => { theme = next; } };
}
beforeEach(() => { vi.resetAllMocks(); mocks.create.mockResolvedValue({ output_text: JSON.stringify({ wordMeanings: ["I want", "coffee"] }) }); });

describe("sentence meaning refresh", () => {
  it("requests positional meanings and writes them while preserving the authored round", async () => {
    const db = fixture();
    await expect(refresh(db.ctx, { themeId, rounds: [target] })).resolves.toEqual({ generated: 1, applied: 1, skipped: 0 });
    expect(mocks.construct).toHaveBeenCalledTimes(1);
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      input: [expect.objectContaining({ role: "system" }), expect.objectContaining({ role: "user", content: expect.stringContaining("Spanish sentence: Quiero cafe") })],
      text: { format: expect.objectContaining({ type: "json_schema", strict: true, schema: expect.objectContaining({ properties: { wordMeanings: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 } } }) }) },
    }));
    expect(db.theme()).toMatchObject({ sentenceRounds: [{ ...baseRound, wordMeanings: ["I want", "coffee"] }] });
  });

  it.each([null, { _id: themeId, _creationTime: 1, createdAt: 1, name: "WORDS", description: "", contentType: "word", words: [] } satisfies Doc<"themes">])("skips missing and word themes without generating (%#)", async theme => {
    const db = fixture(theme);
    await expect(refresh(db.ctx, { themeId, rounds: [target] })).resolves.toEqual({ generated: 0, applied: 0, skipped: 1 });
    expect(mocks.construct).not.toHaveBeenCalled();
    await expect(apply(db.mutationCtx, { themeId, generated: [{ ...target, wordMeanings: ["a", "b"] }] })).resolves.toEqual({ applied: 0, skipped: 1 });
    expect(db.patch).not.toHaveBeenCalled();
  });

  it("skips missing rounds and changed English or Spanish before requesting meanings", async () => {
    const db = fixture();
    const stale = [{ ...target, roundIndex: 9 }, { ...target, englishPrompt: "edited" }, { ...target, spanishSentence: "Otro texto" }];
    await expect(refresh(db.ctx, { themeId, rounds: stale })).resolves.toEqual({ generated: 0, applied: 0, skipped: 3 });
    expect(mocks.create).not.toHaveBeenCalled();
    await expect(apply(db.mutationCtx, { themeId, generated: stale.map(t => ({ ...t, wordMeanings: ["a", "b"] })) })).resolves.toEqual({ applied: 0, skipped: 3 });
    expect(db.patch).not.toHaveBeenCalled();
  });

  it("rechecks authored text after a pending provider result", async () => {
    const db = fixture();
    mocks.create.mockImplementation(async () => {
      const current = db.theme() as Extract<Doc<"themes">, { contentType: "sentence" }>;
      db.setTheme({ ...current, sentenceRounds: [{ ...baseRound, englishPrompt: "Edited while pending" }] });
      return { output_text: JSON.stringify({ wordMeanings: ["I want", "coffee"] }) };
    });
    await expect(refresh(db.ctx, { themeId, rounds: [target] })).resolves.toEqual({ generated: 1, applied: 0, skipped: 1 });
    expect(db.patch).not.toHaveBeenCalled();
    expect(db.theme()).toMatchObject({ sentenceRounds: [expect.objectContaining({ englishPrompt: "Edited while pending", wordMeanings: baseRound.wordMeanings })] });
  });

  it.each(["provider", "json"])("retains placeholders when all generations fail (%s)", async failure => {
    const db = fixture();
    if (failure === "provider") mocks.create.mockRejectedValue(new Error("Unavailable")); else mocks.create.mockResolvedValue({ output_text: "not JSON" });
    await expect(refresh(db.ctx, { themeId, rounds: [target] })).resolves.toEqual({ generated: 0, applied: 0, skipped: 1 });
    expect(db.runMutation).not.toHaveBeenCalled();
    expect(db.patch).not.toHaveBeenCalled();
  });

  it("applies successful siblings even when another generation fails", async () => {
    const db = fixture();
    const current = db.theme() as Extract<Doc<"themes">, { contentType: "sentence" }>;
    const second = { ...baseRound, englishPrompt: "I want bread", spanishSentence: "Quiero pan" };
    db.setTheme({ ...current, sentenceRounds: [baseRound, second] });
    mocks.create.mockRejectedValueOnce(new Error("Unavailable"));
    await expect(refresh(db.ctx, { themeId, rounds: [target, { roundIndex: 1, englishPrompt: second.englishPrompt, spanishSentence: second.spanishSentence }] })).resolves.toEqual({ generated: 1, applied: 1, skipped: 1 });
    expect(db.theme()).toMatchObject({ sentenceRounds: [baseRound, { ...second, wordMeanings: ["I want", "coffee"] }] });
  });

  it.each(["", "{}", '{"wordMeanings":"wrong shape"}', '{"wordMeanings":["  I want  ", 42, "excess"]}', '{"wordMeanings":["  I want  ", 42]}'])("normalizes provider payload %s to the sentence length", async output_text => {
    mocks.create.mockResolvedValue({ output_text });
    const db = fixture();
    await refresh(db.ctx, { themeId, rounds: [target] });
    expect(db.theme()).toMatchObject({ sentenceRounds: [{ ...baseRound, wordMeanings: output_text === '{"wordMeanings":["  I want  ", 42]}' ? ["I want", "placeholder"] : ["placeholder", "placeholder"] }] });
  });

  it("does not call the provider for an empty draft sentence", async () => {
    const db = fixture();
    const current = db.theme() as Extract<Doc<"themes">, { contentType: "sentence" }>;
    db.setTheme({ ...current, sentenceRounds: [{ ...baseRound, spanishSentence: "" }] });
    await expect(refresh(db.ctx, { themeId, rounds: [{ ...target, spanishSentence: "" }] })).resolves.toEqual({ generated: 1, applied: 1, skipped: 0 });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(db.theme()).toMatchObject({ sentenceRounds: [expect.objectContaining({ wordMeanings: [] })] });
  });
});
