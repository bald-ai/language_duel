/**
 * Play-time types for sentence rounds. Distinct from `SentenceRoundInput`
 * (the editable source on themes) — these shapes are produced once at session
 * creation (`buildSentenceQuestionSnapshot`) and pinned on the duel doc.
 */


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
