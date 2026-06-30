import { getErrorMessage } from "../errors";
import { normalizePlainErrorMessage, withRetry } from "../userFacingErrors";

/**
 * Extract error message from a failed fetch response.
 */
export async function getResponseErrorMessage(
  response: Response,
  fallback = "Something went wrong. Please try again."
): Promise<string> {
  const fallbackMessage = withRetry(fallback);
  try {
    const text = await response.text();
    if (!text) return normalizePlainErrorMessage(undefined, fallbackMessage);
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const codedMessage = getErrorMessage(record, fallbackMessage);
        if (codedMessage !== fallbackMessage) return codedMessage;

        const maybeError = record.error ?? record.message;
        if (typeof maybeError === "string" && maybeError.trim()) {
          return normalizePlainErrorMessage(maybeError, fallbackMessage);
        }
      }
    } catch {
      // ignore JSON parse errors
    }
    return normalizePlainErrorMessage(text, fallbackMessage);
  } catch {
    return normalizePlainErrorMessage(undefined, fallbackMessage);
  }
}
