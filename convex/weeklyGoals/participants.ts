import type { Id } from "../_generated/dataModel";

export function getGoalParticipantIds(goal: {
  creatorId: Id<"users">;
  partnerId?: Id<"users">;
}): Id<"users">[] {
  return goal.partnerId === undefined
    ? [goal.creatorId]
    : [goal.creatorId, goal.partnerId];
}

export function getGoalPartnerIdForViewer(
  goal: {
    creatorId: Id<"users">;
    partnerId?: Id<"users">;
  },
  viewerId: Id<"users">
): Id<"users"> | undefined {
  if (goal.creatorId === viewerId) {
    return goal.partnerId;
  }
  if (goal.partnerId === viewerId) {
    return goal.creatorId;
  }
  return undefined;
}

export function isGoalParticipant(
  goal: {
    creatorId: Id<"users">;
    partnerId?: Id<"users">;
  },
  userId: Id<"users">
): boolean {
  return goal.creatorId === userId || goal.partnerId === userId;
}
