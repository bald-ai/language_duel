/**
 * Format duration as MM:SS or H:MM:SS.
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format a duel score: whole numbers stay integers, otherwise one decimal place.
 */
export function formatScore(score: number): number | string {
  return Number.isInteger(score) ? score : score.toFixed(1);
}

/**
 * Format a timestamp as a local YYYY-MM-DD string for a date input value.
 */
export function formatDateInputValue(timestamp: number | undefined): string {
  if (typeof timestamp !== "number") return "";

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
