import type { Id } from "@/convex/_generated/dataModel";

export function isSelfDuelSelection(
  viewer: { _id: Id<"users"> } | null | undefined,
  opponentId: Id<"users"> | null | undefined
): boolean {
  if (viewer == null || opponentId == null) return false;
  return viewer._id === opponentId;
}
