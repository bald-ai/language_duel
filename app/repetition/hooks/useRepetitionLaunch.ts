"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { buildSoloUrl } from "@/lib/soloNavigation";
import { getErrorMessage } from "@/lib/errors";
import type { DuelMode } from "@/lib/duelMode";
export function useRepetitionLaunch() {
  const params = useParams();
  const router = useRouter();
  const goalId = typeof params.goalId === "string" ? params.goalId : "";
  const preview = useQuery(
    api.weeklyGoalRepetitions.getLaunchPreview,
    goalId ? { weeklyGoalId: goalId as Id<"weeklyGoals"> } : "skip",
  );
  const createRepetitionChallenge = useMutation(
    api.weeklyGoalRepetitions.createRepetitionChallenge,
  );
  const startRepetitionSoloPractice = useMutation(
    api.weeklyGoalRepetitions.startRepetitionSoloPractice,
  );
  const [isStarting, setIsStarting] = useState<"duel" | "solo" | null>(null);
  const [selectedMode, setSelectedMode] = useState<DuelMode>("pvp");

  const handleStartDuel = async () => {
    setIsStarting("duel");
    try {
      await createRepetitionChallenge({
        weeklyGoalId: goalId as Id<"weeklyGoals">,
        duelMode: selectedMode,
      });
      toast.success("Spaced repetition duel invite sent.");
      router.push("/repetition");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not start duel"));
    } finally {
      setIsStarting(null);
    }
  };

  const handleStartSolo = async () => {
    setIsStarting("solo");
    try {
      const soloPracticeSessionId = await startRepetitionSoloPractice({
        weeklyGoalId: goalId as Id<"weeklyGoals">,
      });
      router.push(
        buildSoloUrl(String(soloPracticeSessionId), "practice_only", {
          soloPracticeSessionId,
          returnTo: "/repetition",
          returnLabel: "Back to repetition",
        }),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not start solo"));
    } finally {
      setIsStarting(null);
    }
  };

  return {
    preview,
    isStarting,
    selectedMode,
    setSelectedMode,
    handleStartDuel,
    handleStartSolo,
    goBack: () => router.push("/repetition"),
  };
}
