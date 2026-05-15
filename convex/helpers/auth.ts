/**
 * Authentication and participant helper functions.
 * Reduces boilerplate in mutations by centralizing auth checks.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { ConvexError } from "convex/values";

export type PlayerRole = "challenger" | "opponent";

export interface AuthenticatedUser {
  user: Doc<"users">;
  clerkId: string;
}

export interface DuelParticipant {
  user: Doc<"users">;
  duel: Doc<"duels">;
  playerRole: PlayerRole;
  isChallenger: boolean;
  isOpponent: boolean;
}

export interface ChallengeParticipant {
  user: Doc<"users">;
  challenge: Doc<"challenges">;
  playerRole: PlayerRole;
  isChallenger: boolean;
  isOpponent: boolean;
}

/**
 * Get the authenticated user from the context.
 * Throws if not authenticated or user not found.
 */
export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUser> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ code: "AUTH_FAILED", message: "Unauthorized" });
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user) {
    throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
  }

  return { user, clerkId: identity.subject };
}

/**
 * Get the authenticated user, returning null instead of throwing if not found.
 * Useful for queries that should return empty results for unauthenticated users.
 */
export async function getAuthenticatedUserOrNull(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user) {
    return null;
  }

  return { user, clerkId: identity.subject };
}

/**
 * Get authenticated user and verify they are a participant in the specified duel.
 * Returns the user, duel, and their role.
 */
export async function getDuelParticipant(
  ctx: QueryCtx | MutationCtx,
  duelId: Id<"duels">
): Promise<DuelParticipant> {
  const { user } = await getAuthenticatedUser(ctx);

  const duel = await ctx.db.get(duelId);
  if (!duel) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Duel not found" });
  }

  const isChallenger = duel.challengerId === user._id;
  const isOpponent = duel.opponentId === user._id;

  if (!isChallenger && !isOpponent) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "User not part of this duel" });
  }

  const playerRole: PlayerRole = isChallenger ? "challenger" : "opponent";

  return { user, duel, playerRole, isChallenger, isOpponent };
}

export async function getChallengeParticipant(
  ctx: QueryCtx | MutationCtx,
  challengeId: Id<"challenges">
): Promise<ChallengeParticipant> {
  const { user } = await getAuthenticatedUser(ctx);

  const challenge = await ctx.db.get(challengeId);
  if (!challenge) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Challenge not found" });
  }

  const isChallenger = challenge.challengerId === user._id;
  const isOpponent = challenge.opponentId === user._id;

  if (!isChallenger && !isOpponent) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "User not part of this challenge" });
  }

  const playerRole: PlayerRole = isChallenger ? "challenger" : "opponent";

  return { user, challenge, playerRole, isChallenger, isOpponent };
}

/**
 * Get duel participant for queries, returning null instead of throwing.
 * Useful for queries that should return null for non-participants.
 */
export async function getDuelParticipantOrNull(
  ctx: QueryCtx | MutationCtx,
  duelId: Id<"duels">
): Promise<DuelParticipant | null> {
  const auth = await getAuthenticatedUserOrNull(ctx);
  if (!auth) return null;

  const duel = await ctx.db.get(duelId);
  if (!duel) return null;

  const isChallenger = duel.challengerId === auth.user._id;
  const isOpponent = duel.opponentId === auth.user._id;

  if (!isChallenger && !isOpponent) return null;

  const playerRole: PlayerRole = isChallenger ? "challenger" : "opponent";

  return { user: auth.user, duel, playerRole, isChallenger, isOpponent };
}

/**
 * Get the other player's role.
 */
export function getOtherRole(role: PlayerRole): PlayerRole {
  return role === "challenger" ? "opponent" : "challenger";
}

/**
 * Check if a duel is in an active state (can receive answers/actions).
 */
export function isDuelActive(duel: Doc<"duels">): boolean {
  return duel.status === "active";
}

/**
 * Check if a player has answered the current question.
 */
export function hasPlayerAnswered(
  duel: Doc<"duels">,
  role: PlayerRole
): boolean {
  return role === "challenger"
    ? duel.challengerAnswered
    : duel.opponentAnswered;
}
