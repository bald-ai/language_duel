import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * ADMIN: Fully delete a user and all associated data.
 *
 * This mutation is designed to be run from the Convex dashboard.
 * It will cascade delete all data associated with the user.
 *
 * Usage in Convex Dashboard:
 * 1. Go to Functions tab
 * 2. Find admin:deleteUserFully
 * 3. Enter the userId (e.g., "jd7abc123...")
 * 4. Run the mutation
 */
export const deleteUserFully = mutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        const { userId } = args;

        // Verify user exists
        const user = await ctx.db.get(userId);
        if (!user) {
            throw new Error(`User ${userId} not found`);
        }

        const deletionReport = {
            user: 0,
            themes: 0,
            friendRequests: 0,
            friends: 0,
            challenges: 0,
            weeklyGoals: 0,
            notifications: 0,
            scheduledDuels: 0,
        };

        // 1. Delete themes owned by this user
        const themes = await ctx.db
            .query("themes")
            .withIndex("by_owner", (q) => q.eq("ownerId", userId))
            .collect();
        for (const theme of themes) {
            await ctx.db.delete(theme._id);
            deletionReport.themes++;
        }

        // 2. Delete friend requests (sent or received)
        const sentRequests = await ctx.db
            .query("friendRequests")
            .withIndex("by_sender", (q) => q.eq("senderId", userId))
            .collect();
        for (const req of sentRequests) {
            await ctx.db.delete(req._id);
            deletionReport.friendRequests++;
        }

        const receivedRequests = await ctx.db
            .query("friendRequests")
            .filter((q) => q.eq(q.field("receiverId"), userId))
            .collect();
        for (const req of receivedRequests) {
            await ctx.db.delete(req._id);
            deletionReport.friendRequests++;
        }

        // 3. Delete friendships (bidirectional)
        const friendshipsAsUser = await ctx.db
            .query("friends")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .collect();
        for (const f of friendshipsAsUser) {
            await ctx.db.delete(f._id);
            deletionReport.friends++;
        }

        const friendshipsAsFriend = await ctx.db
            .query("friends")
            .withIndex("by_friend", (q) => q.eq("friendId", userId))
            .collect();
        for (const f of friendshipsAsFriend) {
            await ctx.db.delete(f._id);
            deletionReport.friends++;
        }

        // 4. Delete challenges (as challenger or opponent)
        const challengesAsChallenger = await ctx.db
            .query("challenges")
            .withIndex("by_challenger", (q) => q.eq("challengerId", userId))
            .collect();
        for (const c of challengesAsChallenger) {
            await ctx.db.delete(c._id);
            deletionReport.challenges++;
        }

        const challengesAsOpponent = await ctx.db
            .query("challenges")
            .withIndex("by_opponent", (q) => q.eq("opponentId", userId))
            .collect();
        for (const c of challengesAsOpponent) {
            await ctx.db.delete(c._id);
            deletionReport.challenges++;
        }

        // 5. Delete weekly goals (as creator or partner)
        const goalsAsCreator = await ctx.db
            .query("weeklyGoals")
            .withIndex("by_creator", (q) => q.eq("creatorId", userId))
            .collect();
        for (const g of goalsAsCreator) {
            await ctx.db.delete(g._id);
            deletionReport.weeklyGoals++;
        }

        const goalsAsPartner = await ctx.db
            .query("weeklyGoals")
            .withIndex("by_partner", (q) => q.eq("partnerId", userId))
            .collect();
        for (const g of goalsAsPartner) {
            await ctx.db.delete(g._id);
            deletionReport.weeklyGoals++;
        }

        // 6. Delete notifications (sent or received)
        const notificationsReceived = await ctx.db
            .query("notifications")
            .filter((q) => q.eq(q.field("toUserId"), userId))
            .collect();
        for (const n of notificationsReceived) {
            await ctx.db.delete(n._id);
            deletionReport.notifications++;
        }

        const notificationsSent = await ctx.db
            .query("notifications")
            .filter((q) => q.eq(q.field("fromUserId"), userId))
            .collect();
        for (const n of notificationsSent) {
            await ctx.db.delete(n._id);
            deletionReport.notifications++;
        }

        // 7. Delete scheduled duels (as proposer or recipient)
        const scheduledAsProposer = await ctx.db
            .query("scheduledDuels")
            .withIndex("by_proposer", (q) => q.eq("proposerId", userId))
            .collect();
        for (const sd of scheduledAsProposer) {
            await ctx.db.delete(sd._id);
            deletionReport.scheduledDuels++;
        }

        const scheduledAsRecipient = await ctx.db
            .query("scheduledDuels")
            .filter((q) => q.eq(q.field("recipientId"), userId))
            .collect();
        for (const sd of scheduledAsRecipient) {
            await ctx.db.delete(sd._id);
            deletionReport.scheduledDuels++;
        }

        // 8. Finally, delete the user
        await ctx.db.delete(userId);
        deletionReport.user = 1;

        return {
            success: true,
            deletedUser: user.email,
            deletionReport,
            message: `Successfully deleted user ${user.email} and all associated data.`,
        };
    },
});
