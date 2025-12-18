/** Minimum nickname length */
export const NICKNAME_MIN_LENGTH = 3;

/** Maximum nickname length */
export const NICKNAME_MAX_LENGTH = 20;

/** Regex for valid nickname characters (alphanumeric + underscore) */
export const NICKNAME_REGEX = /^[a-zA-Z0-9_]+$/;

/** Default nickname for new users */
export const DEFAULT_NICKNAME = "NewPlayer";

/** Error messages */
export const NICKNAME_ERRORS = {
  TOO_SHORT: `Nickname must be at least ${NICKNAME_MIN_LENGTH} characters`,
  TOO_LONG: `Nickname must be at most ${NICKNAME_MAX_LENGTH} characters`,
  INVALID_CHARS: "Nickname can only contain letters, numbers, and underscores",
} as const;

