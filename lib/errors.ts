import { isRecord } from "./typeGuards";

export const getErrorMessage = (error: unknown, fallback: string) => {
  if (isRecord(error) && isRecord(error.data)) {
    const message = error.data.message;
    return typeof message === "string" ? message : fallback;
  }
  return error instanceof Error ? error.message : fallback;
};
