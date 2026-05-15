import { readBackendErrorCode } from "../backendErrorCodes";

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
  if (error instanceof ApiRouteError) {
    return { code: error.code, message: error.message, status: error.status };
  }

  const backendCode = readBackendErrorCode(error);
  if (isApiErrorCode(backendCode)) {
    return {
      code: backendCode,
      message: error instanceof Error && error.message ? error.message : options.defaultMessage,
      status: STRUCTURED_ERROR_STATUS[backendCode],
    };
  }

  if (error instanceof Error) {
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
