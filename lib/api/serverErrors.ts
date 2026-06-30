import { readBackendErrorCode } from "../backendErrorCodes";
import {
  getPlainBackendErrorMessage,
  normalizePlainErrorMessage,
  withRetry,
} from "../userFacingErrors";

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

const STRUCTURED_ERROR_STATUS: Record<ApiErrorCode, number> = {
  AUTH_FAILED: 401,
  CONFIG_ERROR: 500,
  CREDITS_EXHAUSTED: 402,
  UNKNOWN_ERROR: 500,
};

function isApiErrorCode(code: string | undefined): code is ApiErrorCode {
  return code === "AUTH_FAILED" ||
    code === "CONFIG_ERROR" ||
    code === "CREDITS_EXHAUSTED" ||
    code === "UNKNOWN_ERROR";
}

export function resolveApiError(
  error: unknown,
  options: {
    defaultCode: ApiErrorCode;
    defaultStatus: number;
    defaultMessage: string;
  }
): ResolvedApiError {
  const fallbackMessage = withRetry(options.defaultMessage);

  if (error instanceof ApiRouteError) {
    return {
      code: error.code,
      message:
        getPlainBackendErrorMessage(error.code, error.message, fallbackMessage) ??
        normalizePlainErrorMessage(error.message, fallbackMessage),
      status: error.status,
    };
  }

  const backendCode = readBackendErrorCode(error);
  if (isApiErrorCode(backendCode)) {
    const rawMessage = error instanceof Error ? error.message : undefined;
    return {
      code: backendCode,
      message:
        getPlainBackendErrorMessage(backendCode, rawMessage, fallbackMessage) ??
        normalizePlainErrorMessage(rawMessage, fallbackMessage),
      status: STRUCTURED_ERROR_STATUS[backendCode],
    };
  }

  if (error instanceof Error) {
    return {
      code: options.defaultCode,
      message: normalizePlainErrorMessage(error.message, fallbackMessage),
      status: options.defaultStatus,
    };
  }

  return {
    code: options.defaultCode,
    message: fallbackMessage,
    status: options.defaultStatus,
  };
}
