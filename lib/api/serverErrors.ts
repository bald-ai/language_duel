export type ApiErrorCode =
  | "AUTH_FAILED"
  | "CONFIG_ERROR"
  | "CREDITS_EXHAUSTED"
  | "UNKNOWN_ERROR";

export class ApiRouteError extends Error {
  code: ApiErrorCode;
  status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.name = "ApiRouteError";
    this.code = code;
    this.status = status;
  }
}

type ResolvedApiError = {
  code: ApiErrorCode;
  message: string;
  status: number;
};

function mapKnownMessage(message: string): ResolvedApiError | null {
  if (message === "Unauthorized" || message === "Not authenticated") {
    return { code: "AUTH_FAILED", message, status: 401 };
  }

  if (message === "Convex URL not configured") {
    return { code: "CONFIG_ERROR", message, status: 500 };
  }

  if (message === "LLM credits exhausted" || message === "TTS credits exhausted") {
    return { code: "CREDITS_EXHAUSTED", message, status: 402 };
  }

  return null;
}

export function resolveApiError(
  error: unknown,
  options: {
    defaultCode: ApiErrorCode;
    defaultStatus: number;
    defaultMessage: string;
  }
): ResolvedApiError {
  if (error instanceof ApiRouteError) {
    return { code: error.code, message: error.message, status: error.status };
  }

  if (error instanceof Error) {
    const mapped = mapKnownMessage(error.message);
    if (mapped) return mapped;
    return {
      code: options.defaultCode,
      message: error.message || options.defaultMessage,
      status: options.defaultStatus,
    };
  }

  return {
    code: options.defaultCode,
    message: options.defaultMessage,
    status: options.defaultStatus,
  };
}
