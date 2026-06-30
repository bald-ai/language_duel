import { isRecord } from "./typeGuards";

export type BackendErrorCode =
  | "AUTH_FAILED"
  | "CANNOT_SELF_TARGET"
  | "CONFIG_ERROR"
  | "CONFLICT"
  | "CREDITS_EXHAUSTED"
  | "DUEL_NOT_ACTIVE"
  | "HINT_ALREADY_REQUESTED"
  | "HINT_ALREADY_USED"
  | "HINT_NOT_ACCEPTED"
  | "HINT_NOT_AVAILABLE"
  | "INTERNAL_ERROR"
  | "INVALID_IDENTITY"
  | "INVALID_INPUT"
  | "INVALID_STATE"
  | "INVALID_TBT_STATE"
  | "LIMIT_REACHED"
  | "NOT_AUTHORIZED"
  | "NOT_FOUND"
  | "NO_SABOTAGES_LEFT"
  | "OPPONENT_NOT_ANSWERED"
  | "QUESTION_HINT_ALREADY_FIRED"
  | "SABOTAGE_ALREADY_SENT_THIS_QUESTION"
  | "STALE_ANSWER"
  | "STALE_TAP"
  | "STALE_TIMEOUT"
  | "TBT_REQUIRES_SENTENCES"
  | "WRONG_MODE"
  | "WRONG_QUESTION_KIND";

const BACKEND_ERROR_CODES: ReadonlySet<BackendErrorCode> = new Set([
  "AUTH_FAILED",
  "CANNOT_SELF_TARGET",
  "CONFIG_ERROR",
  "CONFLICT",
  "CREDITS_EXHAUSTED",
  "DUEL_NOT_ACTIVE",
  "HINT_ALREADY_REQUESTED",
  "HINT_ALREADY_USED",
  "HINT_NOT_ACCEPTED",
  "HINT_NOT_AVAILABLE",
  "INTERNAL_ERROR",
  "INVALID_IDENTITY",
  "INVALID_INPUT",
  "INVALID_STATE",
  "INVALID_TBT_STATE",
  "LIMIT_REACHED",
  "NOT_AUTHORIZED",
  "NOT_FOUND",
  "NO_SABOTAGES_LEFT",
  "OPPONENT_NOT_ANSWERED",
  "QUESTION_HINT_ALREADY_FIRED",
  "SABOTAGE_ALREADY_SENT_THIS_QUESTION",
  "STALE_ANSWER",
  "STALE_TAP",
  "STALE_TIMEOUT",
  "TBT_REQUIRES_SENTENCES",
  "WRONG_MODE",
  "WRONG_QUESTION_KIND",
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
