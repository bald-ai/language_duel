"use client";

import { readBackendErrorCode } from "@/lib/backendErrorCodes";

export { getErrorMessage } from "@/lib/errors";

const EXPECTED_DUEL_RACE_ERROR_CODES = [
  "STALE_ANSWER",
  "STALE_TIMEOUT",
  "DUEL_NOT_ACTIVE",
] as const;

type DuelRaceErrorCode = typeof EXPECTED_DUEL_RACE_ERROR_CODES[number];

const isExpectedDuelRaceErrorCode = (code: unknown): code is DuelRaceErrorCode =>
  typeof code === "string" &&
  (EXPECTED_DUEL_RACE_ERROR_CODES as readonly string[]).includes(code);

export const isExpectedDuelRaceError = (error: unknown) => {
  return isExpectedDuelRaceErrorCode(readBackendErrorCode(error));
};
