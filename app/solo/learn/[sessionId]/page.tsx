"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import { SOLO_TIMER_OPTIONS, DEFAULT_DURATION } from "./constants";
import { useSoloLearnState } from "./hooks/useSoloLearnState";
import { SoloLearnContent } from "./components/SoloLearnContent";
import { useSoloLearnTimer } from "./hooks/useSoloLearnTimer";
import { useTTS } from "@/hooks/useTTS";
import { buildSoloSearchParams } from "@/lib/soloNavigation";
import { encodeConfidenceParam } from "@/lib/soloConfidenceParam";

// Shared solo chrome
import { useSoloSessionSource } from "@/app/solo/hooks/useSoloSessionSource";
import { SoloStatusScreen } from "@/app/solo/components/SoloStatusScreen";
import { sentenceItemMaxLevel } from "@/lib/soloSentenceRuntime";

export default function LearnPhasePage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const source = useSoloSessionSource({ loadingMessage: "Loading study session..." });
  const {
    status,
    statusMessage,
    sessionItems,
    requestedThemeIds,
    soloPracticeSessionId,
    weeklyGoalId,
    returnTo,
    returnLabel,
    isSessionReady,
    durationParam,
  } = source;

  const initialDuration = useMemo(() => {
    const parsed = Number.parseInt(durationParam ?? "", 10);
    const presetDuration = SOLO_TIMER_OPTIONS.includes(parsed as (typeof SOLO_TIMER_OPTIONS)[number])
      ? parsed
      : null;
    return presetDuration ?? DEFAULT_DURATION;
  }, [durationParam]);

  const themeIdsKey = useMemo(() => requestedThemeIds.join(","), [requestedThemeIds]);
  const sessionSourceKey = soloPracticeSessionId
    ? `solo-practice:${soloPracticeSessionId}`
    : weeklyGoalId
      ? `weeklyGoal:${weeklyGoalId}:${themeIdsKey}`
      : themeIdsKey || "no-theme";

  const study = useSoloLearnState({ sessionItems, sessionSourceKey, sessionId });
  const { getConfidence } = study;

  const timer = useSoloLearnTimer(initialDuration, isSessionReady);
  const { timeRemaining } = timer;

  const { playingWordKey, playTTS } = useTTS();

  const playingWordIndex = useMemo(() => {
    if (!playingWordKey || !playingWordKey.startsWith("solo-learn-")) {
      return null;
    }
    const parsed = Number.parseInt(playingWordKey.replace("solo-learn-", ""), 10);
    return Number.isNaN(parsed) ? null : parsed;
  }, [playingWordKey]);

  const hasMultipleThemes = useMemo(
    () => new Set(sessionItems.map((item) => String(item.themeId))).size > 1,
    [sessionItems]
  );

  const buildPracticeUrl = useCallback(() => {
    const confidenceByItemIndex: Record<number, number> = {};
    sessionItems.forEach((item, itemIndex) => {
      const itemKey = `${sessionSourceKey}-${itemIndex}`;
      const maxLevel = item.kind === "sentence" ? sentenceItemMaxLevel(item) : 3;
      confidenceByItemIndex[itemIndex] = getConfidence(itemKey, maxLevel);
    });

    const urlParams = buildSoloSearchParams({
      soloPracticeSessionId,
      weeklyGoalId,
      themeIds: requestedThemeIds,
      returnTo,
      returnLabel,
    });
    urlParams.set("confidence", encodeConfidenceParam(confidenceByItemIndex));

    return `/solo/${sessionId}?${urlParams.toString()}`;
  }, [
    getConfidence,
    requestedThemeIds,
    returnLabel,
    returnTo,
    sessionId,
    sessionItems,
    sessionSourceKey,
    soloPracticeSessionId,
    weeklyGoalId,
  ]);

  // Auto-advance to practice when the study timer runs out.
  useEffect(() => {
    if (timeRemaining === 0 && isSessionReady) {
      router.push(buildPracticeUrl());
    }
  }, [buildPracticeUrl, timeRemaining, isSessionReady, router]);

  const playWordTTS = useCallback(
    (wordIndex: number, spanishWord: string, storageId?: string, themeId?: string) => {
      void playTTS(`solo-learn-${wordIndex}`, spanishWord, { storageId, themeId });
    },
    [playTTS]
  );

  const handleSkip = useCallback(() => {
    router.push(buildPracticeUrl());
  }, [buildPracticeUrl, router]);

  const handleExit = useCallback(() => router.push(returnTo), [router, returnTo]);

  if (status !== "ready") {
    return (
      <SoloStatusScreen
        status={status}
        message={statusMessage}
        returnLabel={returnLabel}
        onExit={handleExit}
        testIdBase="solo-learn"
      />
    );
  }

  return (
    <SoloLearnContent source={source} study={study} timer={timer} sessionSourceKey={sessionSourceKey}
      playingWordIndex={playingWordIndex} hasMultipleThemes={hasMultipleThemes}
      playWordTTS={playWordTTS} handleSkip={handleSkip} handleExit={handleExit} />
  );
}
