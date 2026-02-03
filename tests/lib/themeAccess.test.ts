import { describe, it, expect } from "vitest";
import { hasThemeAccess, type ThemeAccessParams } from "../../lib/themeAccess";
import type { Id } from "../../convex/_generated/dataModel";

const userId = (id: string) => id as Id<"users">;
const themeId = (id: string) => id as Id<"themes">;

const makeParams = (
    overrides: Partial<ThemeAccessParams> = {}
): ThemeAccessParams => ({
    userId: userId("user1"),
    theme: {
        themeId: themeId("theme1"),
        ownerId: userId("owner1"),
        visibility: "private",
    },
    challenges: [],
    scheduledDuels: [],
    weeklyGoals: [],
    friendships: [],
    ...overrides,
});

describe("hasThemeAccess", () => {
    describe("owner access", () => {
        it("grants access when user is the owner", () => {
            const params = makeParams({
                userId: userId("owner1"),
                theme: {
                    themeId: themeId("theme1"),
                    ownerId: userId("owner1"),
                    visibility: "private",
                },
            });
            expect(hasThemeAccess(params)).toBe(true);
        });

        it("grants access for legacy themes without owner", () => {
            const params = makeParams({
                theme: {
                    themeId: themeId("theme1"),
                    ownerId: undefined,
                    visibility: "private",
                },
            });
            expect(hasThemeAccess(params)).toBe(true);
        });
    });

    describe("challenge access", () => {
        it("grants access when user is challenger in a duel with this theme", () => {
            const params = makeParams({
                challenges: [
                    {
                        challengerId: userId("user1"),
                        opponentId: userId("other"),
                        themeId: themeId("theme1"),
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(true);
        });

        it("grants access when user is opponent in a duel with this theme", () => {
            const params = makeParams({
                challenges: [
                    {
                        challengerId: userId("other"),
                        opponentId: userId("user1"),
                        themeId: themeId("theme1"),
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(true);
        });

        it("denies access when duel uses different theme", () => {
            const params = makeParams({
                challenges: [
                    {
                        challengerId: userId("user1"),
                        opponentId: userId("other"),
                        themeId: themeId("differentTheme"),
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(false);
        });
    });

    describe("scheduled duel access", () => {
        it("grants access when user is proposer in pending scheduled duel", () => {
            const params = makeParams({
                scheduledDuels: [
                    {
                        proposerId: userId("user1"),
                        recipientId: userId("other"),
                        themeId: themeId("theme1"),
                        status: "pending",
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(true);
        });

        it("grants access when user is recipient in accepted scheduled duel", () => {
            const params = makeParams({
                scheduledDuels: [
                    {
                        proposerId: userId("other"),
                        recipientId: userId("user1"),
                        themeId: themeId("theme1"),
                        status: "accepted",
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(true);
        });

        it("grants access for counter_proposed status", () => {
            const params = makeParams({
                scheduledDuels: [
                    {
                        proposerId: userId("user1"),
                        recipientId: userId("other"),
                        themeId: themeId("theme1"),
                        status: "counter_proposed",
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(true);
        });

        it("denies access when scheduled duel is declined", () => {
            const params = makeParams({
                scheduledDuels: [
                    {
                        proposerId: userId("user1"),
                        recipientId: userId("other"),
                        themeId: themeId("theme1"),
                        status: "declined",
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(false);
        });
    });

    describe("weekly goal access", () => {
        it("grants access when user is creator in active goal with this theme", () => {
            const params = makeParams({
                weeklyGoals: [
                    {
                        creatorId: userId("user1"),
                        partnerId: userId("other"),
                        status: "active",
                        themeIds: [themeId("theme1")],
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(true);
        });

        it("grants access when user is partner in editing goal with this theme", () => {
            const params = makeParams({
                weeklyGoals: [
                    {
                        creatorId: userId("other"),
                        partnerId: userId("user1"),
                        status: "editing",
                        themeIds: [themeId("theme1")],
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(true);
        });

        it("denies access when goal is completed", () => {
            const params = makeParams({
                weeklyGoals: [
                    {
                        creatorId: userId("user1"),
                        partnerId: userId("other"),
                        status: "completed",
                        themeIds: [themeId("theme1")],
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(false);
        });

        it("denies access when theme not in goal", () => {
            const params = makeParams({
                weeklyGoals: [
                    {
                        creatorId: userId("user1"),
                        partnerId: userId("other"),
                        status: "active",
                        themeIds: [themeId("differentTheme")],
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(false);
        });
    });

    describe("shared theme access", () => {
        it("grants access when theme is shared and user is friend of owner", () => {
            const params = makeParams({
                theme: {
                    themeId: themeId("theme1"),
                    ownerId: userId("owner1"),
                    visibility: "shared",
                },
                friendships: [
                    {
                        userId: userId("user1"),
                        friendId: userId("owner1"),
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(true);
        });

        it("grants access when friendship is in reverse direction", () => {
            const params = makeParams({
                theme: {
                    themeId: themeId("theme1"),
                    ownerId: userId("owner1"),
                    visibility: "shared",
                },
                friendships: [
                    {
                        userId: userId("owner1"),
                        friendId: userId("user1"),
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(true);
        });

        it("denies access when theme is private even with friendship", () => {
            const params = makeParams({
                theme: {
                    themeId: themeId("theme1"),
                    ownerId: userId("owner1"),
                    visibility: "private",
                },
                friendships: [
                    {
                        userId: userId("user1"),
                        friendId: userId("owner1"),
                    },
                ],
            });
            expect(hasThemeAccess(params)).toBe(false);
        });

        it("denies access when theme is shared but no friendship", () => {
            const params = makeParams({
                theme: {
                    themeId: themeId("theme1"),
                    ownerId: userId("owner1"),
                    visibility: "shared",
                },
                friendships: [],
            });
            expect(hasThemeAccess(params)).toBe(false);
        });
    });

    describe("no access", () => {
        it("denies access when no access conditions are met", () => {
            const params = makeParams();
            expect(hasThemeAccess(params)).toBe(false);
        });
    });
});
