import type { MockGame } from "@/lib/mockOnline/state";

export const GAME_ORDER: readonly MockGame[] = [
  "memory",
  "missing_chunk",
  "rebuild_sentence",
  "speed",
  "sentence_race",
  "sentence_coop",
  "sentence_duel",
];

interface GameMeta {
  label: string;
  tagline: string;
  maxWidthClass: string;
}

export const GAME_META: Record<MockGame, GameMeta> = {
  memory: { label: "Memory Match", tagline: "Flip pairs · most matches wins", maxWidthClass: "max-w-[760px]" },
  missing_chunk: { label: "Missing Chunk", tagline: "Fill the blank · fastest scores", maxWidthClass: "max-w-[480px]" },
  rebuild_sentence: { label: "Rebuild Sentence", tagline: "Unscramble first to score", maxWidthClass: "max-w-[520px]" },
  speed: { label: "Speed Translate", tagline: "Rapid-fire · first correct scores", maxWidthClass: "max-w-[480px]" },
  sentence_race: { label: "Sentence Race", tagline: "Build your own · first correct scores", maxWidthClass: "max-w-[560px]" },
  sentence_coop: { label: "Sentence Co-op", tagline: "Take turns · build it together", maxWidthClass: "max-w-[560px]" },
  sentence_duel: { label: "Sentence Duel", tagline: "Word by word · a wrong pick loses your turn", maxWidthClass: "max-w-[560px]" },
};
