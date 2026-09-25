/** Normalize the shared generation envelope for editor state without throwing. */
export function readGenerationResult<T>(
  result: { success: boolean; data?: T; error?: string },
  failureMessage: string,
): { ok: true; data: T } | { ok: false; error: string } {
  if (!result.success || !result.data) {
    return { ok: false, error: result.error || failureMessage };
  }
  return { ok: true, data: result.data };
}
