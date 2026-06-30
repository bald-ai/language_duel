import type { BackendErrorCode } from "./backendErrorCodes";

export const GENERIC_USER_ERROR_MESSAGE = "Something went wrong. Please try again.";
export const AI_CREDITS_EXHAUSTED_MESSAGE = "You are out of AI generation credits.";
export const AUDIO_CREDITS_EXHAUSTED_MESSAGE = "You are out of audio credits.";

export function withRetry(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return GENERIC_USER_ERROR_MESSAGE;
  if (/try again/i.test(trimmed)) return trimmed;

  const sentence = /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
  return `${sentence} Please try again.`;
}

function creditMessage(rawMessage?: string): string {
  if (rawMessage && /\b(tts|audio)\b/i.test(rawMessage)) {
    return AUDIO_CREDITS_EXHAUSTED_MESSAGE;
  }
  if (rawMessage && /\b(llm|ai|generation)\b/i.test(rawMessage)) {
    return AI_CREDITS_EXHAUSTED_MESSAGE;
  }
  return "You are out of credits for this action.";
}

export function getPlainBackendErrorMessage(
  code: BackendErrorCode | string,
  rawMessage?: string,
  fallback = GENERIC_USER_ERROR_MESSAGE
): string | null {
  switch (code) {
    case "AUTH_FAILED":
      return "Please sign in and try again.";
    case "CONFIG_ERROR":
      return "This feature is not set up correctly yet. Please try again later.";
    case "CREDITS_EXHAUSTED":
      return creditMessage(rawMessage);
    case "INTERNAL_ERROR":
      return "Something went wrong on our side. Please try again.";
    case "INVALID_IDENTITY":
      return "Your sign-in is missing required account details. Please sign out and sign in again.";
    case "NOT_AUTHORIZED":
      if (rawMessage && !/^(not authorized|unauthorized)$/i.test(rawMessage.trim())) {
        return normalizePlainErrorMessage(rawMessage, fallback);
      }
      return "You do not have permission to do that.";
    case "NOT_FOUND":
      return rawMessage
        ? normalizePlainErrorMessage(rawMessage, fallback)
        : "We could not find that item. It may have been deleted.";
    case "UNKNOWN_ERROR":
      return withRetry(fallback);
    default:
      return null;
  }
}

export function normalizePlainErrorMessage(
  message: string | undefined,
  fallback = GENERIC_USER_ERROR_MESSAGE
): string {
  const trimmed = message?.trim();
  if (!trimmed) return withRetry(fallback);

  if (/llm credits exhausted/i.test(trimmed)) return AI_CREDITS_EXHAUSTED_MESSAGE;
  if (/tts credits exhausted/i.test(trimmed)) return AUDIO_CREDITS_EXHAUSTED_MESSAGE;
  if (/^unauthorized$/i.test(trimmed)) return "Please sign in and try again.";
  if (/^not authorized$/i.test(trimmed)) return "You do not have permission to do that.";
  if (/convex url not configured/i.test(trimmed)) {
    return "This feature is not set up correctly yet. Please try again later.";
  }

  const technicalPatterns = [
    /^internal server error$/i,
    /^unknown error$/i,
    /^request failed \(\d+\)$/i,
    /^no content in response$/i,
    /convexerror/i,
    /unexpected token/i,
  ];

  if (technicalPatterns.some((pattern) => pattern.test(trimmed))) {
    return withRetry(fallback);
  }

  return trimmed;
}
