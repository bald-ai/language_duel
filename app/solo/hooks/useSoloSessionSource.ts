"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  buildSessionItems,
  summarizeThemes,
  type SessionItem,
} from "@/lib/sessionItems";
import { sanitizeSoloReturnTo } from "@/lib/soloNavigation";

/**
 * Ad-hoc Solo Practice, weekly-goal practice, persisted boss sessions, and
 * spaced repetition all support mixed word + sentence decks.
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

  const { practiceSession, weeklyGoalPractice, allThemes } = useSoloSourceQueries(
    soloPracticeSessionId, weeklyGoalId, requestedThemeIds
  );

  const selectedThemes = useMemo(() => {
    if (weeklyGoalPractice?.ok) return weeklyGoalPractice.themes;
    if (!allThemes) return [];
    const themeMap = new Map(allThemes.map((theme) => [theme._id, theme]));
    return requestedThemeIds.flatMap((requestedThemeId) => {
      const theme = themeMap.get(requestedThemeId);
      return theme ? [theme] : [];
    });
  }, [allThemes, requestedThemeIds, weeklyGoalPractice]);

  const rawSessionItems = useMemo(
    () => practiceSession?.sessionItems ?? buildSessionItems(selectedThemes),
    [practiceSession?.sessionItems, selectedThemes]
  );
  const sessionItems: SoloSessionEntry[] = rawSessionItems;
  const themeSummary = useMemo(
    () => practiceSession?.themeSummary ?? summarizeThemes(selectedThemes),
    [practiceSession?.themeSummary, selectedThemes]
  );

  const sourceState = resolveSoloSourceState({
    soloPracticeSessionId, weeklyGoalId, requestedThemeIds,
    practiceSession, weeklyGoalPractice, allThemes,
  }, selectedThemes.length, loadingMessage);

  return {
    ...sourceState,
    sessionItems,
    themeSummary,
    requestedThemeIds,
    soloPracticeSessionId,
    weeklyGoalId,
    returnTo,
    returnLabel,
    ...getPracticeSessionMetadata(practiceSession),
    confidenceParam,
    durationParam,
  };
}

/** Query selection follows URL precedence: saved session, weekly goal, themes. */
function useSoloSourceQueries(
  soloPracticeSessionId: string | null,
  weeklyGoalId: string | null,
  requestedThemeIds: Id<"themes">[]
) {
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

  return { practiceSession, weeklyGoalPractice, allThemes };
}

type SoloSourceData = ReturnType<typeof useSoloSourceQueries>;
type SoloSourceInput = SoloSourceData & Pick<SoloSessionSource,
  "soloPracticeSessionId" | "weeklyGoalId" | "requestedThemeIds">;
type SoloSourceState = Pick<SoloSessionSource, "status" | "statusMessage" | "isSessionReady">;

function sourceState(status: SoloSourceStatus, statusMessage: string, isSessionReady = false): SoloSourceState {
  return { status, statusMessage, isSessionReady };
}

function resolveSoloSourceState(input: SoloSourceInput, themeCount: number, loadingMessage: string): SoloSourceState {
  if (input.soloPracticeSessionId) return savedSessionState(input.practiceSession, loadingMessage);
  if (input.weeklyGoalId) return weeklyGoalState(input.weeklyGoalPractice, themeCount, loadingMessage);
  if (input.requestedThemeIds.length === 0) return sourceState("invalid", "No theme selected");
  if (input.allThemes === undefined) return sourceState("loading", loadingMessage);
  if (themeCount !== input.requestedThemeIds.length) return sourceState("invalid", "Theme not found");
  return sourceState("ready", "", true);
}

function savedSessionState(session: SoloSourceData["practiceSession"], loadingMessage: string): SoloSourceState {
  if (session === undefined) return sourceState("loading", loadingMessage);
  if (session === null) return sourceState("unavailable", "This practice session is no longer available");
  return sourceState("ready", "", true);
}

function weeklyGoalState(goal: SoloSourceData["weeklyGoalPractice"], themeCount: number, loadingMessage: string): SoloSourceState {
  if (goal === undefined) return sourceState("loading", loadingMessage);
  if (goal === null) return sourceState("unavailable", "This practice session is no longer available");
  if (!goal.ok) return sourceState("invalid", goal.message);
  return sourceState("ready", "", themeCount > 0);
}

function getPracticeSessionMetadata(session: SoloSourceData["practiceSession"]) {
  const spacedRepetitionStep = session?.sourceType === "spaced_repetition" &&
    typeof session.spacedRepetitionStep === "number" ? session.spacedRepetitionStep : null;
  return { spacedRepetitionStep, isBossPractice: session?.sourceType === "boss" };
}
