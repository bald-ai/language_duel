import { ConvexError } from "convex/values";
import type { UserSummary } from "@/convex/helpers/userSummary";

export function playerName(summary: UserSummary | null | undefined, fallback: string): string {
  return summary?.nickname ?? summary?.name ?? fallback;
}

export function convexErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "string") return data;
    if (data && typeof data === "object" && "message" in data) {
      const message = (data as { message?: unknown }).message;
      if (typeof message === "string") return message;
    }
  }
  return fallback;
}
