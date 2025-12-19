/**
 * Extract error message from a failed fetch response.
 */
export async function getResponseErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const maybeError = record.error ?? record.message;
        if (typeof maybeError === "string" && maybeError.trim()) return maybeError;
      }
    } catch {
      // ignore JSON parse errors
    }
    return text;
  } catch {
    return `Request failed (${response.status})`;
  }
}
