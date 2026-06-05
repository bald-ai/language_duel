"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  buildSessionItems,
  isSessionSentenceItem,
  summarizeThemes,
  type SessionItem,
} from "@/lib/sessionItems";
import { sanitizeSoloReturnTo } from "@/lib/soloNavigation";

/**
 * Normal ad-hoc Solo Practice supports mixed word + sentence decks. Persisted
 * boss/SR sessions and weekly-goal practice stay word-only for the MVP.
 */
export type SoloSessionEntry = SessionItem;

/**
 * Gate state shared by the Solo Practice and Solo Learn pages. `ready` means all
 * five entry checks passed and `sessionItems`/`themeSummary` are usable; the
 * other three drive the {@link SoloStatusScreen}.
 */
export type SoloSourceStatus = "invalid" | "loading" | "unavailable" | "ready";

export interface SoloSessionSource {
  status: SoloSourceStatus;
  /** Message for the non-ready states; empty string when ready. */
  statusMessage: string;
  sessionItems: SoloSessionEntry[];
  themeSummary: string;
  requestedThemeIds: Id<"themes">[];
  soloPracticeSessionId: string | null;
  weeklyGoalId: string | null;
  returnTo: string;
  returnLabel: string;
  spacedRepetitionStep: number | null;
  isBossPractice: boolean;
  /**
   * Stricter "the timer/skip flow may run" readiness used by the Learn page;
   * for weekly goals it additionally requires resolved themes.
   */
  isSessionReady: boolean;
  /** Raw URL params each page parses itself (confidence in/duration in). */
  confidenceParam: string | null;
  durationParam: string | null;
}

/**
 * Resolves where a solo session's words come from — a boss/spaced-repetition
 * snapshot, a weekly goal's themes, or ad-hoc theme ids — and reports the entry
 * gate. Both solo pages share this so the ~95 lines of param reading, the three
 * Convex queries, and the five gate branches live in one place.
 */
export function useSoloSessionSource({
  loadingMessage,
}: {
  loadingMessage: string;
}): SoloSessionSource {
  const searchParams = useSearchParams();
  const themeId = searchParams.get("themeId");
  const themeIdsParam = searchParams.get("themeIds");
  const soloPracticeSessionId = searchParams.get("soloPracticeSessionId");
  const weeklyGoalId = searchParams.get("weeklyGoalId");
  const returnTo = sanitizeSoloReturnTo(searchParams.get("returnTo"));
  const returnLabel = searchParams.get("returnLabel") || "Back to Home";
  const confidenceParam = searchParams.get("confidence");
  const durationParam = searchParams.get("duration");

  const requestedThemeIds = useMemo(() => {
    if (themeIdsParam) {
      return themeIdsParam.split(",").filter(Boolean) as Id<"themes">[];
    }
    return themeId ? [themeId as Id<"themes">] : [];
  }, [themeId, themeIdsParam]);

  const practiceSession = useQuery(
    api.weeklyGoals.getBossPracticeSession,
    soloPracticeSessionId ? { soloPracticeSessionId: soloPracticeSessionId as Id<"soloPracticeSessions"> } : "skip"
  );
  const weeklyGoalPractice = useQuery(
    api.weeklyGoals.getWeeklyGoalPracticeThemes,
    !soloPracticeSessionId && weeklyGoalId
      ? {
          weeklyGoalId: weeklyGoalId as Id<"weeklyGoals">,
          themeIds: requestedThemeIds.length > 0 ? requestedThemeIds : undefined,
        }
      : "skip"
  );
  const allThemes = useQuery(api.themes.getThemes, soloPracticeSessionId || weeklyGoalId ? "skip" : {});

  const selectedThemes = useMemo(() => {
    if (weeklyGoalPractice?.ok) return weeklyGoalPractice.themes;
    if (!allThemes) return [];
    const themeMap = new Map(allThemes.map((theme) => [theme._id, theme]));
    return requestedThemeIds.flatMap((requestedThemeId) => {
      const theme = themeMap.get(requestedThemeId);
      return theme ? [theme] : [];
    });
  }, [allThemes, requestedThemeIds, weeklyGoalPractice]);

  const isNormalSoloPractice = !soloPracticeSessionId && !weeklyGoalId;
  const rawSessionItems = useMemo(
    () => practiceSession?.sessionItems ?? buildSessionItems(selectedThemes),
    [practiceSession?.sessionItems, selectedThemes]
  );
  const hasUnsupportedSentenceItems =
    !isNormalSoloPractice && rawSessionItems.some(isSessionSentenceItem);
  const sessionItems: SoloSessionEntry[] = hasUnsupportedSentenceItems
    ? []
    : rawSessionItems;
  const themeSummary = useMemo(
    () => practiceSession?.themeSummary ?? summarizeThemes(selectedThemes),
    [practiceSession?.themeSummary, selectedThemes]
  );

  const spacedRepetitionStep =
    practiceSession?.sourceType === "spaced_repetition" &&
    typeof practiceSession.spacedRepetitionStep === "number"
      ? practiceSession.spacedRepetitionStep
      : null;
  const isBossPractice = practiceSession?.sourceType === "boss";

  const isSessionReady = soloPracticeSessionId
    ? practiceSession !== undefined && practiceSession !== null
    : weeklyGoalId
      ? Boolean(weeklyGoalPractice?.ok && selectedThemes.length > 0)
      : allThemes !== undefined &&
        requestedThemeIds.length > 0 &&
        selectedThemes.length === requestedThemeIds.length;

  let status: SoloSourceStatus = "ready";
  let statusMessage = "";
  if (!soloPracticeSessionId && !weeklyGoalId && requestedThemeIds.length === 0) {
    status = "invalid";
    statusMessage = "No theme selected";
  } else if (
    (soloPracticeSessionId && practiceSession === undefined) ||
    (!soloPracticeSessionId && weeklyGoalId && weeklyGoalPractice === undefined) ||
    (!soloPracticeSessionId && !weeklyGoalId && allThemes === undefined)
  ) {
    status = "loading";
    statusMessage = loadingMessage;
  } else if (
    (soloPracticeSessionId && practiceSession === null) ||
    (!soloPracticeSessionId && weeklyGoalId && weeklyGoalPractice === null)
  ) {
    status = "unavailable";
    statusMessage = "This practice session is no longer available";
  } else if (!soloPracticeSessionId && weeklyGoalPractice && !weeklyGoalPractice.ok) {
    status = "invalid";
    statusMessage = weeklyGoalPractice.message;
  } else if (
    !soloPracticeSessionId &&
    !weeklyGoalId &&
    selectedThemes.length !== requestedThemeIds.length
  ) {
    status = "invalid";
    statusMessage = "Theme not found";
  } else if (hasUnsupportedSentenceItems) {
    status = "invalid";
    statusMessage =
      "Sentence themes are only available from normal Solo Practice for now.";
  }

  return {
    status,
    statusMessage,
    sessionItems,
    themeSummary,
    requestedThemeIds,
    soloPracticeSessionId,
    weeklyGoalId,
    returnTo,
    returnLabel,
    spacedRepetitionStep,
    isBossPractice,
    isSessionReady,
    confidenceParam,
    durationParam,
  };
}
