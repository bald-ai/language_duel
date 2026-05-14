"use client";

export { getErrorMessage } from "@/lib/errors";

const LEGACY_EXPECTED_RACE_MESSAGES = [
  "Stale answer: question has changed",
  "Stale timeout: question has changed",
  "Duel is not active",
] as const;

const EXPECTED_DUEL_RACE_ERROR_CODES = [
  "STALE_ANSWER",
  "STALE_TIMEOUT",
  "DUEL_NOT_ACTIVE",
] as const;

type DuelRaceErrorCode = typeof EXPECTED_DUEL_RACE_ERROR_CODES[number];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isExpectedDuelRaceErrorCode = (code: unknown): code is DuelRaceErrorCode =>
  typeof code === "string" &&
  (EXPECTED_DUEL_RACE_ERROR_CODES as readonly string[]).includes(code);

export const isExpectedDuelRaceError = (error: unknown) => {
  const dataCode = isRecord(error) && isRecord(error.data)
    ? error.data.code
    : undefined;

  if (isExpectedDuelRaceErrorCode(dataCode)) {
    return true;
  }

  const message = error instanceof Error
    ? error.message
    : (isRecord(error) && typeof error.message === "string" ? error.message : "");

  return LEGACY_EXPECTED_RACE_MESSAGES.some((expectedMessage) =>
    message.includes(expectedMessage)
  );
};
