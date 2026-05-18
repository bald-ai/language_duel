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
