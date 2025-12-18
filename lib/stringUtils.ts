/**
 * String utility functions for text normalization and formatting
 */

/**
 * Strips the (Irr) marker and legacy * marker from verbs
 */
export const stripIrr = (str: string): string => {
  return str
    .replace(/\(irr\)$/i, "") // Strip (Irr) marker (case-insensitive)
    .replace(/\*$/, "")      // Still strip * for backward compatibility
    .trim();
};

/**
 * Normalize accented characters for comparison
 * Removes diacritics, converts to lowercase, trims, and normalizes spaces
 */
export const normalizeAccents = (str: string): string => {
  return stripIrr(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
};

/**
 * Format duration as MM:SS or H:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

