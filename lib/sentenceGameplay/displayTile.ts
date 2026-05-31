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

/**
 * One Tailwind font-size class for an entire tile pool, sized to the longest
 * token so every tile shares the same size. This keeps the 2-column grid clean
 * (uniform tiles, never a mix of sizes) while letting a long word still sit on
 * a single line instead of wrapping. The pool steps down a notch only when it
 * contains a long word; short rounds keep the default `text-lg`.
 *
 * Tiers are calibrated for the ~half-width tile on a narrow phone. Length is
 * measured on the display string (after edge punctuation is stripped) so it
 * matches what's actually rendered. Tokens are capped at
 * `SENTENCE_SPANISH_TOKEN_MAX_LENGTH` (32), and real Spanish words top out
 * around 16 chars, so the shrink stays small and readable in practice.
 */
export function getSentenceTilePoolFontSizeClass(tiles: readonly string[]): string {
  const longest = tiles.reduce((max, tile) => {
    const length = formatSentenceTileForDisplay(tile).length;
    return length > max ? length : max;
  }, 0);

  if (longest <= 10) return "text-lg";
  if (longest <= 14) return "text-base";
  if (longest <= 18) return "text-sm";
  return "text-xs";
}
