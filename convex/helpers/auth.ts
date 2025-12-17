/**
 * Authentication and participant helper functions.
 * Reduces boilerplate in mutations by centralizing auth checks.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

export type PlayerRole = "challenger" | "opponent";

export interface AuthenticatedUser {
  user: Doc<"users">;
  clerkId: string;
}

export interface DuelParticipant {
  user: Doc<"users">;
  duel: Doc<"challenges">;
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
    throw new Error("Unauthorized");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .first();

  if (!user) {
    throw new Error("User not found");
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
  duelId: Id<"challenges">
): Promise<DuelParticipant> {
  const { user } = await getAuthenticatedUser(ctx);

  const duel = await ctx.db.get(duelId);
  if (!duel) {
    throw new Error("Challenge not found");
  }

  const isChallenger = duel.challengerId === user._id;
  const isOpponent = duel.opponentId === user._id;

  if (!isChallenger && !isOpponent) {
    throw new Error("User not part of this challenge");
  }

  const playerRole: PlayerRole = isChallenger ? "challenger" : "opponent";

  return { user, duel, playerRole, isChallenger, isOpponent };
}

/**
 * Get duel participant for queries, returning null instead of throwing.
 * Useful for queries that should return null for non-participants.
 */
export async function getDuelParticipantOrNull(
  ctx: QueryCtx | MutationCtx,
  duelId: Id<"challenges">
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
export function isDuelActive(duel: Doc<"challenges">): boolean {
  const status = duel.status;
  return status === "accepted" || status === "challenging";
}

/**
 * Check if the duel is in the learning phase.
 */
export function isDuelLearning(duel: Doc<"challenges">): boolean {
  return duel.status === "learning";
}

/**
 * Check if the duel is in the challenging phase.
 */
export function isDuelChallenging(duel: Doc<"challenges">): boolean {
  return duel.status === "challenging";
}

/**
 * Get player-specific field from duel based on role.
 * This helps reduce the challenger/opponent branching boilerplate.
 */
export function getPlayerField<K extends keyof Doc<"challenges">>(
  duel: Doc<"challenges">,
  role: PlayerRole,
  challengerKey: K,
  opponentKey: K
): Doc<"challenges">[K] {
  return role === "challenger" ? duel[challengerKey] : duel[opponentKey];
}

/**
 * Check if a player has answered the current question.
 */
export function hasPlayerAnswered(
  duel: Doc<"challenges">,
  role: PlayerRole
): boolean {
  return role === "challenger"
    ? duel.challengerAnswered
    : duel.opponentAnswered;
}

