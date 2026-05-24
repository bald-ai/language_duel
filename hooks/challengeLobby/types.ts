import type { Id } from "@/convex/_generated/dataModel";
import type { DuelDifficultyPreset } from "@/lib/difficultyUtils";
import type { DuelMode } from "@/lib/duelMode";

export type ModalState = "none" | "soloPractice" | "challenge" | "waiting";

export interface CreateChallengeOptions {
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  duelDifficultyPreset?: DuelDifficultyPreset;
  duelMode: DuelMode;
}

// Boundary shape the lobby modals consume for both the friends list (`users[]`)
// and the current viewer. The hook's richer query results (e.g. friends carry an
// `imageUrl`) are structurally assignable to this; the modal only needs what
// `formatVisibleUser` reads.
export interface LobbyUser {
  _id: Id<"users">;
  name?: string;
  nickname?: string;
  discriminator?: number;
}

export interface PendingChallenge {
  challenge: { _id: Id<"challenges"> };
  challenger: Omit<LobbyUser, "_id"> | null;
}
