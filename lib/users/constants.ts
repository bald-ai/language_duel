export const NICKNAME_MIN_LENGTH = 3;
export const NICKNAME_MAX_LENGTH = 20;
export const NICKNAME_REGEX = /^[a-zA-Z0-9_]+$/;
export const DEFAULT_NICKNAME = "NewPlayer";

export const NICKNAME_ERRORS = {
  TOO_SHORT: `Nickname must be at least ${NICKNAME_MIN_LENGTH} characters`,
  TOO_LONG: `Nickname must be at most ${NICKNAME_MAX_LENGTH} characters`,
  INVALID_CHARS: "Nickname can only contain letters, numbers, and underscores",
} as const;
