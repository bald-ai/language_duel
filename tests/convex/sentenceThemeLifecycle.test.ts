import { describe, expect, it, vi } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { deleteTheme, duplicateTheme } from "@/convex/themes";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";
const themeId = "theme" as Id<"themes">;
const ownerId = "owner" as Id<"users">;
const duplicate = (duplicateTheme as unknown as { _handler: (ctx: unknown, args: { themeId: Id<"themes"> }) => Promise<Id<"themes">> })._handler;
const remove = (deleteTheme as unknown as { _handler: (ctx: unknown, args: { themeId: Id<"themes"> }) => Promise<void> })._handler;
function fixture() {
  const original: Extract<Doc<"themes">, { contentType: "sentence" }> = { _id: themeId, _creationTime: 1, name: "ANIMALS", description: "Sentence practice", contentType: "sentence", sentenceRounds: [{ englishPrompt: "The cat sleeps", spanishSentence: "El gato duerme", wordMeanings: ["the", "cat", "sleeps"], freeWordPositions: [1], distractors: ["perro", "come", "pez"], ttsStorageId: "audio" as Id<"_storage"> }], createdAt: 1, ownerId, visibility: "shared", friendsCanEdit: true };
  const themes: Doc<"themes">[] = [original];
  const users: Doc<"users">[] = [{ _id: ownerId, _creationTime: 1, clerkId: "owner", email: "owner@example.test" }];
  const snapshots: Doc<"weeklyGoalThemeSnapshots">[] = [];
  const insert = vi.fn(async (table: string, fields: object) => { if (table !== "themes") throw new Error("Unexpected insert"); const id = "duplicate" as Id<"themes">; themes.push({ _id: id, _creationTime: 2, ...fields } as Doc<"themes">); return id; });
  const storageDelete = vi.fn(async (_id: string) => {});
  const db = { get: async (id: string) => [...users, ...themes].find(row => row._id === id) ?? null,
    query: (table: string) => {
      if (table === "users") return createIndexedQuery(users);
      if (table === "themes") return createIndexedQuery(themes);
      if (table === "weeklyGoalThemeSnapshots") return createIndexedQuery(snapshots);
      if (table === "weeklyGoals") return createIndexedQuery<Doc<"weeklyGoals">>([]);
      if (["challenges", "duels", "soloPracticeSessions", "friends"].includes(table)) return createIndexedQuery<{ _id: string }>([]);
      throw new Error(`Unexpected query ${table}`);
    }, insert, delete: vi.fn(async (id: string) => { const index = themes.findIndex(row => row._id === id); if (index < 0) throw new Error("Missing theme"); themes.splice(index, 1); }),
  };
  return { original, themes, snapshots, db, storageDelete, ctx: createAuthCtx(db, "owner", { storage: { delete: storageDelete } }) };
}
describe("sentence theme duplication and deletion", () => {
  it("copies authored content into a private theme without sharing source audio or array references", async () => {
    const f = fixture(); const id = await duplicate(f.ctx, { themeId });
    const copy = f.themes.find(theme => theme._id === id);
    expect(copy).toMatchObject({ name: "ANIMALS(DUPLICATE)", description: "Sentence practice", contentType: "sentence", visibility: "private", ownerId });
    if (copy?.contentType !== "sentence") throw new Error("Expected sentence duplicate");
    const { ttsStorageId: _audio, ...content } = f.original.sentenceRounds[0];
    expect(copy.sentenceRounds).toEqual([content]); expect(copy.friendsCanEdit).toBeUndefined();
    f.original.sentenceRounds[0].wordMeanings[0] = "changed"; f.original.sentenceRounds[0].freeWordPositions.push(2); f.original.sentenceRounds[0].distractors[0] = "changed";
    expect(copy.sentenceRounds[0]).toMatchObject({ wordMeanings: ["the", "cat", "sleeps"], freeWordPositions: [1], distractors: ["perro", "come", "pez"] });
    expect(f.storageDelete).not.toHaveBeenCalled();
  });
  it("removes an owned sentence theme and its unreferenced audio", async () => {
    const f = fixture(); await remove(f.ctx, { themeId });
    expect(f.themes).toEqual([]); expect(f.db.delete).toHaveBeenCalledExactlyOnceWith(themeId); expect(f.storageDelete).toHaveBeenCalledExactlyOnceWith("audio");
  });
  it("preserves sentence audio retained by a locked goal snapshot", async () => {
    const f = fixture(); f.snapshots.push({ _id: "snapshot" as Id<"weeklyGoalThemeSnapshots">, _creationTime: 1, weeklyGoalId: "goal" as Id<"weeklyGoals">, originalThemeId: themeId, order: 0, name: f.original.name, description: f.original.description, contentType: "sentence", sentenceRounds: structuredClone(f.original.sentenceRounds), lockedAt: 1, createdAt: 1 });
    await remove(f.ctx, { themeId }); expect(f.themes).toEqual([]); expect(f.storageDelete).not.toHaveBeenCalled(); expect(f.snapshots[0]).toMatchObject({ sentenceRounds: [{ ttsStorageId: "audio" }] });
  });
});
