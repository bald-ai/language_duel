import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { handleUpdateTheme } from "@/convex/themes/mutations";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";
const themeId = "theme" as Id<"themes">;
const userId = "user" as Id<"users">;
const base = { _id: themeId, _creationTime: 1, createdAt: 1, ownerId: userId, name: "ORIGINAL", description: "Original description" };
const themes: Doc<"themes">[] = [
  { ...base, contentType: "word", words: [{ word: "cat", answer: "gato", wrongAnswers: ["perro"], ttsStorageId: "audio" as Id<"_storage"> }] },
  { ...base, contentType: "sentence", sentenceRounds: [{ englishPrompt: "I want coffee", spanishSentence: "Quiero cafe", distractors: ["pan", "leche", "agua"], wordMeanings: ["I want", "coffee"], freeWordPositions: [1], ttsStorageId: "audio" as Id<"_storage"> }] },
];
function fixture(initial: Doc<"themes">) {
  let stored = initial;
  const patch = vi.fn(async (_id: string, updates: Record<string, unknown>) => { stored = { ...stored, ...updates } as Doc<"themes">; });
  const schedule = vi.fn();
  const deleteStorage = vi.fn();
  const ctx = createAuthCtx({ query: () => createIndexedQuery([{ _id: userId, clerkId: "clerk" }]), get: async () => stored, patch }, "clerk", {
    scheduler: { runAfter: schedule }, storage: { delete: deleteStorage },
  });
  return { ctx, patch, schedule, deleteStorage, stored: () => stored };
}
describe("metadata-only theme updates", () => {
  it.each(themes)("preserves all $contentType content and audio", async theme => {
    const db = fixture(theme);
    await expect(handleUpdateTheme(db.ctx as never, { themeId, name: "  renamed  ", description: "  description  " })).resolves.toEqual({ ...theme, name: "RENAMED", description: "description" });
    expect(db.patch).toHaveBeenCalledExactlyOnceWith(themeId, { name: "RENAMED", description: "description" });
    expect(db.schedule).not.toHaveBeenCalled();
    expect(db.deleteStorage).not.toHaveBeenCalled();
  });
  it.each(themes)("rejects $contentType updates containing the other content type", async theme => {
    const db = fixture(theme);
    const updates = theme.contentType === "word" ? { sentenceRounds: [] } : { words: [] };
    await expect(handleUpdateTheme(db.ctx as never, { themeId, ...updates })).rejects.toThrow("don't accept");
    expect(db.patch).not.toHaveBeenCalled();
    expect(db.stored()).toEqual(theme);
  });
});
