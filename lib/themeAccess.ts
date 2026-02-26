import type { Id } from "../convex/_generated/dataModel";

export type ThemeAccessData = {
    themeId: Id<"themes">;
    ownerId: Id<"users"> | undefined;
    visibility: "private" | "shared" | undefined;
};

export type ChallengeAccessData = {
    challengerId: Id<"users">;
    opponentId: Id<"users">;
    themeId: Id<"themes">;
};

export type ScheduledDuelAccessData = {
    proposerId: Id<"users">;
    recipientId: Id<"users">;
    themeId: Id<"themes">;
    status: "pending" | "accepted" | "counter_proposed" | "declined";
};

export type WeeklyGoalAccessData = {
    creatorId: Id<"users">;
    partnerId: Id<"users">;
    status: "editing" | "active" | "completed";
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
    scheduledDuels: ScheduledDuelAccessData[];
    weeklyGoals: WeeklyGoalAccessData[];
    friendships: FriendshipData[];
};

const ACTIVE_SCHEDULED_DUEL_STATUSES = ["pending", "accepted", "counter_proposed"] as const;
const ACTIVE_GOAL_STATUSES = ["editing", "active"] as const;

export function hasThemeAccess(params: ThemeAccessParams): boolean {
    const { userId, theme, challenges, scheduledDuels, weeklyGoals, friendships } = params;

    if (isOwner(userId, theme)) {
        return true;
    }

    if (hasAccessViaChallenge(userId, theme.themeId, challenges)) {
        return true;
    }

    if (hasAccessViaScheduledDuel(userId, theme.themeId, scheduledDuels)) {
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

function isOwner(userId: Id<"users">, theme: ThemeAccessData): boolean {
    return theme.ownerId === userId;
}

function hasAccessViaChallenge(
    userId: Id<"users">,
    themeId: Id<"themes">,
    challenges: ChallengeAccessData[]
): boolean {
    return challenges.some(
        (c) =>
            c.themeId === themeId &&
            (c.challengerId === userId || c.opponentId === userId)
    );
}

function hasAccessViaScheduledDuel(
    userId: Id<"users">,
    themeId: Id<"themes">,
    scheduledDuels: ScheduledDuelAccessData[]
): boolean {
    return scheduledDuels.some(
        (sd) =>
            sd.themeId === themeId &&
            ACTIVE_SCHEDULED_DUEL_STATUSES.includes(sd.status as typeof ACTIVE_SCHEDULED_DUEL_STATUSES[number]) &&
            (sd.proposerId === userId || sd.recipientId === userId)
    );
}

function hasAccessViaWeeklyGoal(
    userId: Id<"users">,
    themeId: Id<"themes">,
    weeklyGoals: WeeklyGoalAccessData[]
): boolean {
    return weeklyGoals.some(
        (goal) =>
            ACTIVE_GOAL_STATUSES.includes(goal.status as typeof ACTIVE_GOAL_STATUSES[number]) &&
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

    return friendships.some(
        (f) =>
            (f.userId === userId && f.friendId === theme.ownerId) ||
            (f.userId === theme.ownerId && f.friendId === userId)
    );
}
