import type { MockGame } from "@/lib/mockOnline/state";

export const GAME_ORDER: readonly MockGame[] = ["sentence_coop", "sentence_duel"];

interface GameMeta {
  label: string;
  tagline: string;
  maxWidthClass: string;
}

export const GAME_META: Record<MockGame, GameMeta> = {
  sentence_coop: { label: "Sentence Co-op", tagline: "Take turns · build it together", maxWidthClass: "max-w-[560px]" },
  sentence_duel: { label: "Sentence Duel", tagline: "Word by word · fewest mistakes wins", maxWidthClass: "max-w-[560px]" },
};
