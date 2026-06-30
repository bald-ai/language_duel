import { isRecord } from "./typeGuards";
import { readBackendErrorCode } from "./backendErrorCodes";
import {
  getPlainBackendErrorMessage,
  normalizePlainErrorMessage,
  withRetry,
} from "./userFacingErrors";

export const getErrorMessage = (error: unknown, fallback: string) => {
  const fallbackMessage = withRetry(fallback);
  const messageData = readErrorDataFromMessage(error);
  const code = readBackendErrorCode(error) ?? readBackendErrorCode(messageData);
  const structuredMessage = readStructuredMessage(error) ?? readStructuredMessage(messageData);

  if (code) {
    const plainCodeMessage = getPlainBackendErrorMessage(code, structuredMessage, fallbackMessage);
    if (plainCodeMessage) return plainCodeMessage;
  }

  if (structuredMessage) {
    return normalizePlainErrorMessage(structuredMessage, fallbackMessage);
  }

  if (error instanceof Error) {
    return normalizePlainErrorMessage(error.message, fallbackMessage);
  }

  return fallbackMessage;
};

function readStructuredMessage(error: unknown): string | undefined {
  if (isRecord(error) && isRecord(error.data)) {
    const message = error.data.message;
    return typeof message === "string" ? message : undefined;
  }
  if (isRecord(error)) {
    const message = error.message;
    return typeof message === "string" ? message : undefined;
  }
  return undefined;
}

function readErrorDataFromMessage(error: unknown): Record<string, unknown> | undefined {
  if (!(error instanceof Error)) return undefined;

  const start = error.message.indexOf("{");
  const end = error.message.lastIndexOf("}");
  if (start === -1 || end <= start) return undefined;

  try {
    const parsed = JSON.parse(error.message.slice(start, end + 1)) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
