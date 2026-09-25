import { describe, expect, it, vi } from "vitest";
import type { MutationCtx } from "@/convex/_generated/server";
import type { Id } from "@/convex/_generated/dataModel";
import { resolveAccessibleThemes } from "@/convex/helpers/resolveAccessibleThemes";
import { loadThemeWithViewerAccess } from "@/convex/helpers/themeAccess";
import { createIndexedQuery } from "./testUtils/inMemoryDb";

const userId = "user_1" as Id<"users">;
const ids = ["theme_1", "theme_2"] as Id<"themes">[];
type Row = { _id: string; [key: string]: unknown };
function setup(ownerId = "user_2", records: Record<string, Row[]> = {}) {
  const themes = ids.map(_id => ({ _id, ownerId, contentType: "word", name: _id, words: [], visibility: "shared" }));
  const query = vi.fn((table: string) => createIndexedQuery(records[table] ?? []));
  const ctx = { db: { get: vi.fn(async (id: string) => themes.find(theme => theme._id === id) ?? null), query } };
  return { ctx: ctx as unknown as MutationCtx, query, themes };
}

describe("theme access loading", () => {
  it("rejects empty input without reading the database", async () => {
    const { ctx, query } = setup();
    await expect(resolveAccessibleThemes(ctx, userId, [])).rejects.toMatchObject({ data: { code: "INVALID_INPUT" } });
    expect(query).not.toHaveBeenCalled();
  });

  it("deduplicates owned themes in selection order without relationship scans", async () => {
    const { ctx, query } = setup(userId);
    const result = await resolveAccessibleThemes(ctx, userId, [ids[1], ids[0], ids[1]]);
    expect(result.map(theme => theme._id)).toEqual([ids[1], ids[0]]);
    expect(ctx.db.get).toHaveBeenCalledTimes(2);
    expect(query).not.toHaveBeenCalled();
  });

  it("shares history and owner friendship reads across a batch", async () => {
    const { ctx, query } = setup("user_2", { friends: [{ _id: "friend", userId: "user_2", friendId: userId }] });
    const result = await resolveAccessibleThemes(ctx, userId, ids);
    expect(result.map(theme => theme._id)).toEqual(ids);
    expect(query.mock.calls.map(([table]) => table)).toEqual([
      "challenges", "challenges", "duels", "duels", "soloPracticeSessions", "weeklyGoals", "weeklyGoals", "friends", "friends",
    ]);
  });

  it.each(["challenges", "duels", "soloPracticeSessions", "weeklyGoals"])("preserves access through %s without querying friendships", async table => {
    const { ctx, query, themes } = setup("user_2", { [table]: [{
      _id: "access", challengerId: userId, opponentId: "user_2", userId, creatorId: userId,
      status: "draft", themeIds: ids, themes: ids.map(themeId => ({ themeId })),
    }] });
    themes.forEach(theme => { theme.visibility = "private"; });
    expect(await resolveAccessibleThemes(ctx, userId, ids)).toHaveLength(2);
    expect(query.mock.calls.some(([name]) => name === "friends")).toBe(false);
  });

  it("rejects private themes even when the owner is a friend", async () => {
    const { ctx, themes } = setup("user_2", { friends: [{ _id: "friend", userId, friendId: "user_2" }] });
    themes[1].visibility = "private";
    await expect(resolveAccessibleThemes(ctx, userId, ids)).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  });

  it("rejects missing and inaccessible themes", async () => {
    const { ctx } = setup();
    await expect(resolveAccessibleThemes(ctx, userId, ids)).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
    expect(await loadThemeWithViewerAccess(ctx, userId, "missing" as Id<"themes">)).toBeNull();
  });

  it("does not retain access decisions across requests", async () => {
    const friends: Row[] = [{ _id: "friend", userId, friendId: "user_2" }];
    const { ctx } = setup("user_2", { friends });
    expect(await loadThemeWithViewerAccess(ctx, userId, ids[0])).not.toBeNull();
    friends.length = 0;
    expect(await loadThemeWithViewerAccess(ctx, userId, ids[0])).toBeNull();
  });
});
