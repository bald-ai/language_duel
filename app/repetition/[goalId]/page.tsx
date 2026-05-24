"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ThemedPage } from "@/app/components/ThemedPage";
import { BackButton } from "@/app/components/BackButton";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { formatVisibleUser } from "@/lib/userDisplay";
import { buildSoloUrl } from "@/lib/soloNavigation";
import {
  getSpacedRepetitionIntervalDaysForStep,
  SPACED_REPETITION_TOTAL_STEPS,
} from "@/lib/spacedRepetition";
import { RepetitionProgress } from "../components/RepetitionProgress";
import { boardItemTitle, currentStepOf } from "../components/boardItemDisplay";
import { getErrorMessage } from "@/lib/errors";
import type { DuelMode } from "@/lib/duelMode";
import { DuelModePicker } from "@/app/components/modals/DuelModePicker";

export default function RepetitionLaunchPage() {
  const colors = useAppearanceColors();
  const params = useParams();
  const router = useRouter();
  const goalId = typeof params.goalId === "string" ? params.goalId : "";
  const preview = useQuery(
    api.weeklyGoalRepetitions.getLaunchPreview,
    goalId ? { weeklyGoalId: goalId as Id<"weeklyGoals"> } : "skip"
  );
  const createRepetitionChallenge = useMutation(api.weeklyGoalRepetitions.createRepetitionChallenge);
  const startRepetitionSoloPractice = useMutation(api.weeklyGoalRepetitions.startRepetitionSoloPractice);
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
      const soloPracticeSessionId = await startRepetitionSoloPractice({ weeklyGoalId: goalId as Id<"weeklyGoals"> });
      router.push(
        buildSoloUrl(String(soloPracticeSessionId), "practice_only", {
          soloPracticeSessionId,
          returnTo: "/repetition",
          returnLabel: "Back to repetition",
        })
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not start solo"));
    } finally {
      setIsStarting(null);
    }
  };

  if (preview === undefined) {
    return (
      <ThemedPage className="px-4 py-6">
        <main className="relative z-10 mx-auto flex min-h-[60vh] w-full max-w-[32rem] items-center justify-center">
          <p style={{ color: colors.text.muted }}>Loading launch...</p>
        </main>
      </ThemedPage>
    );
  }

  if (preview === null) {
    return (
      <ThemedPage className="px-4 py-6">
        <main className="relative z-10 mx-auto w-full max-w-[32rem] space-y-5">
          <BackButton onClick={() => router.push("/repetition")} label="Back" />
          <div
            className="rounded-2xl border-2 p-6 text-center"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.status.danger.DEFAULT,
              color: colors.text.DEFAULT,
            }}
          >
            This spaced repetition item is not available.
          </div>
        </main>
      </ThemedPage>
    );
  }

  const currentStep = currentStepOf(preview);
  const intervalDays = getSpacedRepetitionIntervalDaysForStep(currentStep);
  const canStart = preview.canStart;
  const duelAvailable = preview.duelAvailable;
  const wordCountLabel = canStart ? preview.wordCount : "-";
  const title = boardItemTitle(preview);

  return (
    <ThemedPage className="px-4 py-6">
      <main className="relative z-10 mx-auto w-full max-w-[32rem] space-y-5">
        <BackButton
          onClick={() => router.push("/repetition")}
          label="Back to Board"
          dataTestId="sr-launch-back"
        />

        <section
          className="rounded-2xl border-2 p-5 space-y-5"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: canStart ? colors.cta.DEFAULT : colors.status.warning.DEFAULT,
            boxShadow: `0 16px 38px ${colors.primary.glow}`,
          }}
        >
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em]" style={{ color: colors.text.muted }}>
              Spaced Repetition {currentStep}/{preview.totalSteps}
            </p>
            <h1 className="mt-2 text-2xl font-black" style={{ color: colors.text.DEFAULT }}>
              {title}
            </h1>
            <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>
              {formatVisibleUser(preview.partner, "Deleted participant")} · {intervalDays}-day mark
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border p-3" style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: colors.text.muted }}>Themes</p>
              <p className="text-xl font-black" style={{ color: colors.text.DEFAULT }}>{preview.themeCount}</p>
            </div>
            <div className="rounded-xl border p-3" style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: colors.text.muted }}>Words</p>
              <p className="text-xl font-black" style={{ color: colors.text.DEFAULT }}>{wordCountLabel}</p>
            </div>
            <div className="rounded-xl border p-3" style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}>
              <p className="text-[10px] uppercase tracking-wide" style={{ color: colors.text.muted }}>Lives</p>
              <p className="text-xl font-black" style={{ color: colors.text.DEFAULT }}>{preview.livesTotal}</p>
            </div>
          </div>

          <RepetitionProgress
            completedCount={preview.completedSteps.length}
            currentStep={currentStep}
            showLabels
          />

          {!preview.contentAvailable && (
            <p className="rounded-xl border p-3 text-sm" style={{ borderColor: colors.status.warning.DEFAULT, color: colors.text.DEFAULT }}>
              {preview.unavailableReason}
            </p>
          )}
          {preview.bucket === "coming_up" && (
            <p className="rounded-xl border p-3 text-sm" style={{ borderColor: colors.primary.dark, color: colors.text.DEFAULT }}>
              This repetition unlocks in {preview.daysRemaining} day{preview.daysRemaining === 1 ? "" : "s"}.
            </p>
          )}
          {preview.bucket === "done" && (
            <p className="rounded-xl border p-3 text-sm" style={{ borderColor: colors.cta.DEFAULT, color: colors.text.DEFAULT }}>
              This goal is {SPACED_REPETITION_TOTAL_STEPS}/{SPACED_REPETITION_TOTAL_STEPS} complete.
            </p>
          )}

          {duelAvailable && (
            <DuelModePicker
              selectedMode={selectedMode}
              onSelectMode={setSelectedMode}
              dataTestIdPrefix="repetition-mode"
            />
          )}

          <div className={`grid gap-2 ${duelAvailable ? "grid-cols-2" : "grid-cols-1"}`}>
            {duelAvailable && (
              <button
                type="button"
                onClick={handleStartDuel}
                disabled={!canStart || isStarting !== null}
                className="rounded-xl border-2 px-3 py-3 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor: colors.cta.DEFAULT,
                  borderColor: colors.cta.dark,
                  color: colors.text.inverse,
                }}
                data-testid="sr-launch-start-duel"
              >
                {isStarting === "duel" ? "Starting..." : "Start Duel"}
              </button>
            )}
            <button
              type="button"
              onClick={handleStartSolo}
              disabled={!canStart || isStarting !== null}
              className="rounded-xl border-2 px-3 py-3 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              data-testid="sr-launch-start-solo"
            >
              {isStarting === "solo" ? "Starting..." : "Solo"}
            </button>
          </div>
          {!duelAvailable && (
            <p className="text-xs" style={{ color: colors.text.muted }}>
              This partner is no longer available. Solo practice is still available.
            </p>
          )}
        </section>
      </main>
    </ThemedPage>
  );
}
