import { isRecord } from "./typeGuards";

export type BackendErrorCode =
  | "AUTH_FAILED"
  | "CANNOT_SELF_TARGET"
  | "CONFIG_ERROR"
  | "CONFLICT"
  | "CREDITS_EXHAUSTED"
  | "DUEL_NOT_ACTIVE"
  | "HINT_ALREADY_REQUESTED"
  | "HINT_NOT_ACCEPTED"
  | "INTERNAL_ERROR"
  | "INVALID_INPUT"
  | "INVALID_STATE"
  | "LIMIT_REACHED"
  | "NOT_AUTHORIZED"
  | "NOT_FOUND"
  | "NO_SABOTAGES_LEFT"
  | "OPPONENT_NOT_ANSWERED"
  | "SABOTAGE_ALREADY_SENT_THIS_QUESTION"
  | "STALE_ANSWER"
  | "STALE_TIMEOUT";

const BACKEND_ERROR_CODES: ReadonlySet<BackendErrorCode> = new Set([
  "AUTH_FAILED",
  "CANNOT_SELF_TARGET",
  "CONFIG_ERROR",
  "CONFLICT",
  "CREDITS_EXHAUSTED",
  "DUEL_NOT_ACTIVE",
  "HINT_ALREADY_REQUESTED",
  "HINT_NOT_ACCEPTED",
  "INTERNAL_ERROR",
  "INVALID_INPUT",
  "INVALID_STATE",
  "LIMIT_REACHED",
  "NOT_AUTHORIZED",
  "NOT_FOUND",
  "NO_SABOTAGES_LEFT",
  "OPPONENT_NOT_ANSWERED",
  "SABOTAGE_ALREADY_SENT_THIS_QUESTION",
  "STALE_ANSWER",
  "STALE_TIMEOUT",
]);

const isBackendErrorCode = (value: string): value is BackendErrorCode =>
  (BACKEND_ERROR_CODES as ReadonlySet<string>).has(value);

export function readBackendErrorCode(error: unknown): BackendErrorCode | undefined {
  if (!isRecord(error)) return undefined;

  if (typeof error.code === "string" && isBackendErrorCode(error.code)) {
    return error.code;
  }

  const data = error.data;
  if (isRecord(data) && typeof data.code === "string" && isBackendErrorCode(data.code)) {
    return data.code;
  }

  return undefined;
}
