/**
 * Play-time types for sentence rounds. Distinct from `SentenceRoundInput`
 * (the editable source on themes) — these shapes are produced once at session
 * creation (`buildSentenceQuestionSnapshot`) and pinned on the duel doc.
 */

import type { Id } from "../types";

/**
 * The pre-shuffled tile pool plus the canonical solution for one sentence
 * position. Server-only — the answer key is masked at the duel DTO boundary
 * (`convex/duels.ts` → `buildViewerSafeDuel`).
 */
export interface SentenceQuestionSnapshot {
  kind: "sentence";
  englishPrompt: string;
  spanishSentence: string;
  tilePool: string[];
  /** English free-word hints aligned to `tilePool`; distractors and non-free words are null. */
  tileMeanings: Array<string | null>;
}

/**
 * Final result a client reports back to the server for one sentence round.
 * Granular per-tap state is intentionally client-side: the server's reward
 * signal is the clean-vs-mistakes tier, not per-tile drip score (decision:
 * sentence scoring).
 */
export interface SentenceRoundResult {
  completed: boolean;
  mistakes: number;
}

/**
 * The deduplicated tile pool layout. Server pre-shuffles; client renders.
 * Tile indices are local to this pool — identical-text tiles are
 * interchangeable (decision: if a correct word repeats, any identical
 * available tile can satisfy the next matching slot).
 */
export interface SentenceTilePool {
  /** The shuffled tile strings, identical-text tiles allowed. */
  tiles: string[];
}

/**
 * Bookkeeping for a per-position sentence round on a duel session. Empty until
 * a player begins / submits the round. Persisted parallel to the existing
 * per-player answer fields.
 */
export interface SentenceParticipantResult {
  /** Position into itemOrder, matches `duelQuestions[index]`. */
  position: number;
  /** How many wrong tile taps this player accumulated on this round. */
  mistakes: number;
  /** Whether the player completed the sentence (vs timed out / abandoned). */
  completed: boolean;
}

export type SentenceQuestionPosition = {
  themeId: Id<"themes">;
  themeName: string;
};
