import type { MockGame } from "@/lib/mockOnline/state";

export const GAME_ORDER: readonly MockGame[] = [
  "memory",
  "missing_chunk",
  "rebuild_sentence",
  "speed",
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
};
