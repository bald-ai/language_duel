export const getErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (typeof data === "object" && data !== null && "message" in data) {
      return typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : fallback;
    }
  }
  return error instanceof Error ? error.message : fallback;
};
