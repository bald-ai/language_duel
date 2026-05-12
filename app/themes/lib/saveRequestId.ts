export function createSaveRequestId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `theme-save-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
