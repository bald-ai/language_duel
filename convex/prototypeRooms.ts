/**
 * Backend for the "Online Mock Features" prototypes.
 *
 * One generic table (`prototypeRooms`) backs every prototype. Two players (each
 * on their own account) share a room via a short code; Convex reactivity makes
 * the shared `state` realtime. Deliberately decoupled from duels/challenges/
 * themes so the whole feature can be removed without touching the main app.
 */

import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { getAuthenticatedUser, getAuthenticatedUserOrNull } from "./helpers/auth";
import { toUserSummary } from "./helpers/userSummary";
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../lib/mockOnline/constants";
import { applyGameMove, createGameState, isGameFinished } from "../lib/mockOnline/engine";
import { mockGameValidator, moveValidator, type PlayerSlot } from "../lib/mockOnline/state";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

async function findRoomByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<Doc<"prototypeRooms"> | null> {
  return await ctx.db
    .query("prototypeRooms")
    .withIndex("by_code", (q) => q.eq("code", code))
    .first();
}

async function getRoomParticipant(
  ctx: MutationCtx,
  roomId: Id<"prototypeRooms">
): Promise<{ room: Doc<"prototypeRooms">; slot: PlayerSlot }> {
  const { user } = await getAuthenticatedUser(ctx);
  const room = await ctx.db.get(roomId);
  if (!room) {
    throw new ConvexError({ code: "NOT_FOUND", message: "Room not found" });
  }
  const isHost = room.hostId === user._id;
  const isGuest = room.guestId === user._id;
  if (!isHost && !isGuest) {
    throw new ConvexError({ code: "NOT_AUTHORIZED", message: "You are not in this room" });
  }
  return { room, slot: isHost ? "host" : "guest" };
}

export const createRoom = mutation({
  args: { game: mockGameValidator },
  handler: async (ctx, { game }) => {
    const { user } = await getAuthenticatedUser(ctx);

    let code = generateCode();
    for (let attempt = 0; attempt < 5 && (await findRoomByCode(ctx, code)); attempt += 1) {
      code = generateCode();
    }

    const now = Date.now();
    const roomId = await ctx.db.insert("prototypeRooms", {
      code,
      game,
      hostId: user._id,
      status: "waiting",
      state: createGameState(game),
      createdAt: now,
      updatedAt: now,
    });

    return { roomId, code };
  },
});

export const joinRoom = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user } = await getAuthenticatedUser(ctx);
    const normalized = code.trim().toUpperCase();

    const room = await findRoomByCode(ctx, normalized);
    if (!room) {
      throw new ConvexError({ code: "NOT_FOUND", message: "No room with that code" });
    }
    if (room.hostId === user._id) {
      throw new ConvexError({ code: "CANNOT_JOIN_OWN_ROOM", message: "You can't join your own room" });
    }
    if (room.guestId && room.guestId !== user._id) {
      throw new ConvexError({ code: "ROOM_FULL", message: "This room already has two players" });
    }

    if (room.guestId !== user._id) {
      await ctx.db.patch(room._id, { guestId: user._id, status: "active", updatedAt: Date.now() });
    }
    return { roomId: room._id };
  },
});

export const getRoom = query({
  args: { roomId: v.id("prototypeRooms") },
  handler: async (ctx, { roomId }) => {
    const auth = await getAuthenticatedUserOrNull(ctx);
    if (!auth) return null;

    const room = await ctx.db.get(roomId);
    if (!room) return null;

    const isHost = room.hostId === auth.user._id;
    const isGuest = room.guestId === auth.user._id;
    if (!isHost && !isGuest) return null;

    const [host, guest] = await Promise.all([
      ctx.db.get(room.hostId),
      room.guestId ? ctx.db.get(room.guestId) : Promise.resolve(null),
    ]);

    return {
      room,
      viewerSlot: (isHost ? "host" : "guest") as PlayerSlot,
      host: toUserSummary(host),
      guest: toUserSummary(guest),
    };
  },
});

export const applyMove = mutation({
  args: { roomId: v.id("prototypeRooms"), move: moveValidator },
  handler: async (ctx, { roomId, move }) => {
    const { room, slot } = await getRoomParticipant(ctx, roomId);
    if (room.status !== "active") {
      throw new ConvexError({ code: "INVALID_STATE", message: "Game is not active" });
    }

    const nextState = applyGameMove(room.state, slot, move);
    await ctx.db.patch(roomId, {
      state: nextState,
      status: isGameFinished(nextState) ? "finished" : "active",
      updatedAt: Date.now(),
    });
  },
});

export const restartGame = mutation({
  args: { roomId: v.id("prototypeRooms") },
  handler: async (ctx, { roomId }) => {
    const { room } = await getRoomParticipant(ctx, roomId);
    if (!room.guestId) {
      throw new ConvexError({ code: "INVALID_STATE", message: "Need a second player first" });
    }
    await ctx.db.patch(roomId, {
      state: createGameState(room.game),
      status: "active",
      updatedAt: Date.now(),
    });
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id("prototypeRooms") },
  handler: async (ctx, { roomId }) => {
    const { user } = await getAuthenticatedUser(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) return;
    if (room.hostId !== user._id && room.guestId !== user._id) return;
    await ctx.db.delete(roomId);
  },
});
