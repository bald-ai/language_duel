import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { formatVisibleUser } from "@/lib/userDisplay";

export type TabKey = "all" | "ready" | "comingUp" | "done";

// Single-source the board contract from the server query so the client never
// re-declares (and drifts from) the real shape.
export type BoardData = FunctionReturnType<typeof api.weeklyGoalRepetitions.getBoard>;
export type BoardItem = BoardData["all"][number];

export function formatShortDate(timestamp: number | null): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function partnerLabel(item: BoardItem): string {
  if (item.mode === "solo") return "Solo goal";
  if (!item.partner) return "Deleted participant";
  const partnerName = formatVisibleUser(item.partner, "partner");
  return `You and ${partnerName}`;
}

export function boardItemTitle(item: { themeNames: string[] }): string {
  const [firstThemeName] = item.themeNames;
  if (!firstThemeName) return "Completed goal";
  if (item.themeNames.length === 1) return firstThemeName;
  return `${firstThemeName} + ${item.themeNames.length - 1} more`;
}

export function currentStepOf(item: { step: number | null; totalSteps: number }): number {
  return item.step ?? item.totalSteps;
}

export function sectionTitle(tab: TabKey): string {
  switch (tab) {
    case "ready":
      return "Ready Now";
    case "comingUp":
      return "Coming Up";
    case "done":
      return "Done";
    case "all":
      return "All";
  }
}
