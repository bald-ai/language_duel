import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { getThemes, type ThemeWithOwner } from "@/convex/themes";
import { getThemeListForViewer } from "@/convex/themes/listQueries";
import { loadThemeForStoredTtsEditor } from "@/convex/themes/queries";
import { createAuthCtx, createIndexedQuery } from "./testUtils/inMemoryDb";
const me = "me" as Id<"users">;
const friend = "friend" as Id<"users">;
function theme(id: string, ownerId: Id<"users"> | undefined, overrides: Partial<Extract<Doc<"themes">, { contentType: "word" }>> = {}): Doc<"themes"> {
  return { _id: id as Id<"themes">, _creationTime: 1, createdAt: 1, ownerId, name: id, description: "", contentType: "word", words: [{ word: "cat", answer: "gato", wrongAnswers: ["perro"] }], visibility: "private", ...overrides };
}
function goal(id: string, themes: Doc<"themes">[], overrides: Partial<Doc<"weeklyGoals">> = {}): Doc<"weeklyGoals"> {
  return { _id: id as Id<"weeklyGoals">, _creationTime: 1, createdAt: 1, mode: "shared", creatorId: me, partnerId: friend, status: "draft", creatorLocked: false, partnerLocked: false, miniBossStatus: "unavailable", bigBossStatus: "unavailable", themes: themes.map(t => ({ themeId: t._id, themeName: t.name, creatorCompleted: false, partnerCompleted: false })), ...overrides };
}
function fixture() {
  const themes = [theme("mine", me), theme("shared", friend, { visibility: "shared", friendsCanEdit: true }), theme("private", friend), theme("stranger_shared", "stranger" as Id<"users">, { visibility: "shared", friendsCanEdit: true })];
  const users: Doc<"users">[] = [{ _id: me, _creationTime: 1, clerkId: "me", email: "me@example.test", nickname: "Mine", discriminator: 1234 }, { _id: friend, _creationTime: 1, clerkId: "friend", email: "friend@example.test", nickname: "Friend", discriminator: 5678 }];
  const friends: Doc<"friends">[] = [{ _id: "friendship" as Id<"friends">, _creationTime: 1, createdAt: 1, userId: me, friendId: friend }];
  const weeklyGoals: Doc<"weeklyGoals">[] = [];
  const ctx = { db: {
    query: (table: "themes" | "users" | "friends" | "weeklyGoals") => {
      switch (table) {
        case "themes": return createIndexedQuery(themes);
        case "users": return createIndexedQuery(users);
        case "friends": return createIndexedQuery(friends);
        case "weeklyGoals": return createIndexedQuery(weeklyGoals);
      }
    },
    get: async (id: string) => [...themes, ...users, ...weeklyGoals].find(row => row._id === id) ?? null,
  } };
  return { ctx, themes, users, friends, weeklyGoals, list: (args: Parameters<typeof getThemeListForViewer>[2] = {}, archived: Id<"themes">[] = []) => getThemeListForViewer(ctx as never, me, args, archived) };
}
describe("theme lists and editor access", () => {
  it("lists owned and friend-shared themes with actual owner and edit rights", async () => {
    const f = fixture();
    const list = await f.list();
    expect(list.map(t => t._id)).toEqual(["mine", "shared"]);
    expect(list[0]).toMatchObject({ isOwner: true, canEdit: true, ownerNickname: "Mine", ownerDiscriminator: 1234 });
    expect(list[1]).toMatchObject({ isOwner: false, canEdit: true, ownerNickname: "Friend", ownerDiscriminator: 5678 });
  });
  it("includes private themes referenced by either participant's draft, deduplicating repeats", async () => {
    const f = fixture();
    f.weeklyGoals.push(goal("creator_goal", [f.themes[0], f.themes[2]]), goal("partner_goal", [f.themes[2]], { creatorId: friend, partnerId: me }), goal("locked_goal", [f.themes[3]], { status: "locked" }));
    const list = await f.list();
    expect(list.map(t => t._id)).toEqual(["mine", "shared", "private"]);
    expect(list[2]).toMatchObject({ canEdit: false, isOwner: false });
  });
  it("skips deleted theme references and keeps missing-owner rows read-only", async () => {
    const f = fixture();
    const missingOwner = theme("orphan", undefined);
    f.themes.push(missingOwner);
    f.weeklyGoals.push(goal("draft", [missingOwner, theme("deleted", friend)]));
    const orphan = (await f.list()).find(t => t._id === "orphan");
    expect(orphan).toMatchObject({ ownerNickname: undefined, ownerDiscriminator: undefined, canEdit: false, isOwner: false });
    expect((await f.list()).some(t => t._id === "deleted")).toBe(false);
  });
  it("shows a missing owner's shared theme without fabricating identity", async () => {
    const f = fixture();
    f.users.splice(1, 1);
    expect((await f.list())[1]).toMatchObject({ ownerNickname: undefined, ownerDiscriminator: undefined, isOwner: false });
  });
  it("restricts my-themes view to ownership even when a friend filter is supplied", async () => {
    const f = fixture();
    f.weeklyGoals.push(goal("draft", [f.themes[2]]));
    expect((await f.list({ myThemesOnly: true, filterByFriendId: friend })).map(t => t._id)).toEqual(["mine"]);
  });
  it("friend filtering excludes private themes and refuses nonfriends", async () => {
    const f = fixture();
    expect((await f.list({ filterByFriendId: friend })).map(t => t._id)).toEqual(["shared"]);
    await expect(f.list({ filterByFriendId: "stranger" as Id<"users"> })).resolves.toEqual([]);
  });
  it("applies archive filtering after access filtering", async () => {
    const f = fixture();
    const archived = ["shared", "stranger_shared"] as Id<"themes">[];
    expect((await f.list({}, archived)).map(t => t._id)).toEqual(["mine"]);
    expect((await f.list({ archivedOnly: true }, archived)).map(t => t._id)).toEqual(["shared"]);
  });
  it("loads friend-shared themes across more than one batch", async () => {
    const f = fixture();
    for (let i = 0; i < 12; i++) {
      const id = `friend_${i}` as Id<"users">;
      f.friends.push({ _id: `link_${i}` as Id<"friends">, _creationTime: 1, createdAt: 1, userId: me, friendId: id });
      f.themes.push(theme(`shared_${i}`, id, { visibility: "shared" }));
    }
    expect((await f.list()).map(t => t._id)).toEqual(["mine", "shared", ...Array.from({ length: 12 }, (_, i) => `shared_${i}`)]);
  });
  it("stored audio editors require ownership or an editable shared friendship", async () => {
    const f = fixture();
    for (const id of ["mine", "shared"]) await expect(loadThemeForStoredTtsEditor(f.ctx as never, { viewerId: me, themeId: id as Id<"themes"> })).resolves.toMatchObject({ _id: id });
    for (const id of ["private", "stranger_shared", "missing"]) await expect(loadThemeForStoredTtsEditor(f.ctx as never, { viewerId: me, themeId: id as Id<"themes"> })).resolves.toBeNull();
    f.themes.push(theme("orphan", undefined));
    await expect(loadThemeForStoredTtsEditor(f.ctx as never, { viewerId: me, themeId: "orphan" as Id<"themes"> })).resolves.toBeNull();
  });
});


describe("public theme list query", () => {
  const run = (getThemes as unknown as { _handler: (ctx: unknown, args: { myThemesOnly?: boolean; archivedOnly?: boolean }) => Promise<ThemeWithOwner[]> })._handler;
  it.each([null, "unknown"])("returns no private list without a recognized viewer (%s)", async subject => {
    const f = fixture();
    await expect(run(createAuthCtx(f.ctx.db, subject), {})).resolves.toEqual([]);
  });
  it("passes ownership filtering through the authenticated boundary", async () => {
    const f = fixture();
    expect((await run(createAuthCtx(f.ctx.db, "me"), { myThemesOnly: true })).map(t => t._id)).toEqual(["mine"]);
  });
  it("uses the viewer's stored archive selection", async () => {
    const f = fixture(); f.users[0].archivedThemeIds = ["shared" as Id<"themes">];
    expect((await run(createAuthCtx(f.ctx.db, "me"), { archivedOnly: true })).map(t => t._id)).toEqual(["shared"]);
  });
});
