import type { Id } from "@/convex/_generated/dataModel";
import type { DuelDifficultyPreset } from "@/lib/difficultyUtils";

export type ModalState = "none" | "soloPractice" | "challenge" | "waiting";

export interface CreateChallengeOptions {
  opponentId: Id<"users">;
  themeIds: Id<"themes">[];
  duelDifficultyPreset?: DuelDifficultyPreset;
}
