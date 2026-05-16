import type { Id } from "./types";

export type ThemeAccessData = {
    themeId: Id<"themes">;
    ownerId: Id<"users"> | undefined;
    visibility: "private" | "shared" | undefined;
    friendsCanEdit?: boolean;
};

export type ChallengeAccessData = {
    challengerId: Id<"users">;
    opponentId: Id<"users">;
    themeIds: Id<"themes">[];
};

export type DuelAccessData = {
    challengerId: Id<"users">;
    opponentId: Id<"users">;
    themeIds: Id<"themes">[];
};

export type SoloPracticeAccessData = {
    userId: Id<"users">;
    themeIds: Id<"themes">[];
};

export type WeeklyGoalAccessData = {
    creatorId: Id<"users">;
    partnerId: Id<"users">;
    status: "draft" | "locked" | "grace_period" | "completed";
    themeIds: Id<"themes">[];
};

export type FriendshipData = {
    userId: Id<"users">;
    friendId: Id<"users">;
};

export type ThemeAccessParams = {
    userId: Id<"users">;
    theme: ThemeAccessData;
    challenges: ChallengeAccessData[];
    duels: DuelAccessData[];
    soloPracticeSessions: SoloPracticeAccessData[];
    weeklyGoals: WeeklyGoalAccessData[];
    friendships: FriendshipData[];
};

const WEEKLY_GOAL_ACCESS_STATUSES = ["draft"] as const;

export function hasFriendshipWithOwner(
    userId: Id<"users">,
    ownerId: Id<"users"> | undefined,
    friendships: FriendshipData[]
): boolean {
    if (!ownerId) {
        return false;
    }

    return friendships.some(
        (f) =>
            (f.userId === userId && f.friendId === ownerId) ||
            (f.userId === ownerId && f.friendId === userId)
    );
}

export function hasThemeAccess(params: ThemeAccessParams): boolean {
    const { userId, theme, challenges, duels, soloPracticeSessions, weeklyGoals, friendships } = params;

    if (isOwner(userId, theme)) {
        return true;
    }

    if (hasAccessViaChallenge(userId, theme.themeId, challenges)) {
        return true;
    }

    if (hasAccessViaDuel(userId, theme.themeId, duels)) {
        return true;
    }

    if (hasAccessViaSoloPractice(userId, theme.themeId, soloPracticeSessions)) {
        return true;
    }

    if (hasAccessViaWeeklyGoal(userId, theme.themeId, weeklyGoals)) {
        return true;
    }

    if (hasAccessViaSharedTheme(userId, theme, friendships)) {
        return true;
    }

    return false;
}

function hasAccessViaDuel(
    userId: Id<"users">,
    themeId: Id<"themes">,
    duels: DuelAccessData[]
): boolean {
    return duels.some(
        (duel) =>
            duel.themeIds.includes(themeId) &&
            (duel.challengerId === userId || duel.opponentId === userId)
    );
}

function hasAccessViaSoloPractice(
    userId: Id<"users">,
    themeId: Id<"themes">,
    soloPracticeSessions: SoloPracticeAccessData[]
): boolean {
    return soloPracticeSessions.some(
        (session) => session.userId === userId && session.themeIds.includes(themeId)
    );
}

function isOwner(userId: Id<"users">, theme: ThemeAccessData): boolean {
    return theme.ownerId === userId;
}

export function canGenerateStoredThemeTts(
    userId: Id<"users">,
    theme: ThemeAccessData,
    friendships: FriendshipData[] = []
): boolean {
    if (isOwner(userId, theme)) {
        return true;
    }

    return (
        theme.visibility === "shared" &&
        theme.friendsCanEdit === true &&
        hasFriendshipWithOwner(userId, theme.ownerId, friendships)
    );
}

function hasAccessViaChallenge(
    userId: Id<"users">,
    themeId: Id<"themes">,
    challenges: ChallengeAccessData[]
): boolean {
    return challenges.some(
        (c) =>
            c.themeIds.includes(themeId) &&
            (c.challengerId === userId || c.opponentId === userId)
    );
}

function hasAccessViaWeeklyGoal(
    userId: Id<"users">,
    themeId: Id<"themes">,
    weeklyGoals: WeeklyGoalAccessData[]
): boolean {
    return weeklyGoals.some(
        (goal) =>
            WEEKLY_GOAL_ACCESS_STATUSES.includes(goal.status as typeof WEEKLY_GOAL_ACCESS_STATUSES[number]) &&
            (goal.creatorId === userId || goal.partnerId === userId) &&
            goal.themeIds.includes(themeId)
    );
}

function hasAccessViaSharedTheme(
    userId: Id<"users">,
    theme: ThemeAccessData,
    friendships: FriendshipData[]
): boolean {
    if (theme.visibility !== "shared" || !theme.ownerId) {
        return false;
    }

    return hasFriendshipWithOwner(userId, theme.ownerId, friendships);
}
