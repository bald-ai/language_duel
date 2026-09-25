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

const backendMessages: Record<string, string> = {
  AUTH_FAILED: "Please sign in and try again.",
  CONFIG_ERROR: "This feature is not set up correctly yet. Please try again later.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
  INVALID_IDENTITY: "Your sign-in is missing required account details. Please sign out and sign in again.",
};

export function getPlainBackendErrorMessage(
  code: BackendErrorCode | string,
  rawMessage?: string,
  fallback = GENERIC_USER_ERROR_MESSAGE
): string | null {
  if (Object.prototype.hasOwnProperty.call(backendMessages, code)) return backendMessages[code];
  switch (code) {
    case "CREDITS_EXHAUSTED":
      return creditMessage(rawMessage);
    case "NOT_AUTHORIZED":
      return permissionMessage(rawMessage, fallback);
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

  const translation = plainMessageTranslations.find(([pattern]) => pattern.test(trimmed));
  if (translation) return translation[1];

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

const plainMessageTranslations: ReadonlyArray<readonly [RegExp, string]> = [
  [/llm credits exhausted/i, AI_CREDITS_EXHAUSTED_MESSAGE],
  [/tts credits exhausted/i, AUDIO_CREDITS_EXHAUSTED_MESSAGE],
  [/^unauthorized$/i, "Please sign in and try again."],
  [/^not authorized$/i, "You do not have permission to do that."],
  [/convex url not configured/i, "This feature is not set up correctly yet. Please try again later."],
];

function permissionMessage(rawMessage: string | undefined, fallback: string): string {
  if (rawMessage && !/^(not authorized|unauthorized)$/i.test(rawMessage.trim())) {
    return normalizePlainErrorMessage(rawMessage, fallback);
  }
  return "You do not have permission to do that.";
}
