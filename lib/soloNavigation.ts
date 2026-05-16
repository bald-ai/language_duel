import type { Id } from "./types";

export type SoloMode = "practice_only" | "learn_practice";

export interface SoloNavigationSource {
  soloPracticeSessionId?: Id<"soloPracticeSessions"> | string | null;
  weeklyGoalId?: Id<"weeklyGoals"> | string | null;
  themeIds?: Array<Id<"themes"> | string>;
  returnTo?: string | null;
  returnLabel?: string | null;
  confidence?: string | null;
  durationSeconds?: number;
}

const SAFE_RETURN_PATH_PATTERN = /^\/(?!\/)[A-Za-z0-9/_?=&%.,:;~+-]*$/;

export function sanitizeSoloReturnTo(returnTo?: string | null): string {
  if (!returnTo) return "/";
  return SAFE_RETURN_PATH_PATTERN.test(returnTo) ? returnTo : "/";
}

export function buildSoloSearchParams(source: SoloNavigationSource): URLSearchParams {
  const params = new URLSearchParams();

  if (source.soloPracticeSessionId) {
    params.set("soloPracticeSessionId", String(source.soloPracticeSessionId));
  } else if (source.weeklyGoalId) {
    params.set("weeklyGoalId", String(source.weeklyGoalId));
    if (source.themeIds && source.themeIds.length > 0) {
      params.set("themeIds", source.themeIds.map(String).join(","));
    }
  } else if (source.themeIds && source.themeIds.length > 0) {
    if (source.themeIds.length === 1) {
      params.set("themeId", String(source.themeIds[0]));
    }
    params.set("themeIds", source.themeIds.map(String).join(","));
  }

  if (source.durationSeconds !== undefined) {
    params.set("duration", String(source.durationSeconds));
  }
  if (source.confidence) {
    params.set("confidence", source.confidence);
  }

  const returnTo = sanitizeSoloReturnTo(source.returnTo);
  if (returnTo !== "/") {
    params.set("returnTo", returnTo);
  }
  if (source.returnLabel) {
    params.set("returnLabel", source.returnLabel);
  }

  return params;
}

export function buildSoloUrl(
  sessionId: string,
  mode: SoloMode,
  source: SoloNavigationSource
): string {
  const pathSessionId = source.soloPracticeSessionId ? "session" : sessionId;
  const base = mode === "practice_only" ? `/solo/${pathSessionId}` : `/solo/learn/${pathSessionId}`;
  const params = buildSoloSearchParams(source);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
