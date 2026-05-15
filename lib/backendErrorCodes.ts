const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function readBackendErrorCode(error: unknown): string | undefined {
  if (!isRecord(error)) return undefined;

  if (typeof error.code === "string") {
    return error.code;
  }

  const data = error.data;
  if (isRecord(data) && typeof data.code === "string") {
    return data.code;
  }

  return undefined;
}
