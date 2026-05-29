/**
 * Display-only formatting for sentence tiles.
 *
 * The stored tile text keeps its original capitalization and trailing
 * punctuation so gameplay matching (and the post-round answer reveal) stay
 * exact. But rendering those raw tokens on the tappable tiles leaks the answer
 * order: the sentence-initial word is the only capitalized tile and the final
 * word is the only one carrying `.`/`?`/`!` (or a leading `¿`/`¡`). Stripping
 * both edges for display keeps every tile visually uniform so position can't be
 * guessed. Matching still runs against the raw token, so this never affects
 * correctness.
 */
export function formatSentenceTileForDisplay(tile: string): string {
  const withoutEdges = tile.replace(/^[¿¡]+/, "").replace(/[.!?]+$/, "");
  if (withoutEdges.length === 0) return withoutEdges;
  return withoutEdges[0].toLowerCase() + withoutEdges.slice(1);
}
