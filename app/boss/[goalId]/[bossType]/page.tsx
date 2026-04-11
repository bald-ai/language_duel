"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ThemedPage } from "@/app/components/ThemedPage";
import { colors } from "@/lib/theme";
import { buildSessionWords } from "@/lib/sessionWords";

type BossType = "mini" | "big";

function isBossType(value: string): value is BossType {
  return value === "mini" || value === "big";
}

export default function BossLaunchPage() {
  const params = useParams();
  const router = useRouter();
  const [isStartingDuel, setIsStartingDuel] = useState(false);
  const [isStartingPractice, setIsStartingPractice] = useState(false);

  const goalId = typeof params.goalId === "string" ? params.goalId : "";
  const bossTypeParam = typeof params.bossType === "string" ? params.bossType : "";
  const bossType = isBossType(bossTypeParam) ? bossTypeParam : null;

  const goal = useQuery(
    api.weeklyGoals.getGoalById,
    goalId ? { goalId: goalId as Id<"weeklyGoals"> } : "skip"
  );
  const allThemes = useQuery(api.themes.getThemes, {});
  const startBossDuel = useMutation(api.weeklyGoals.startBossDuel);
  const startBossPractice = useMutation(api.weeklyGoals.startBossPractice);

  const selectedThemes = useMemo(() => {
    if (!goal || !allThemes || !bossType) return [];
    const themeMap = new Map(allThemes.map((theme) => [theme._id, theme]));
    return goal.goal.themes
      .filter((goalTheme) =>
        bossType === "big" || (goalTheme.creatorCompleted && goalTheme.partnerCompleted)
      )
      .flatMap((goalTheme) => {
        const theme = themeMap.get(goalTheme.themeId);
        return theme ? [theme] : [];
      });
  }, [allThemes, bossType, goal]);

  const fullSessionWords = useMemo(() => buildSessionWords(selectedThemes), [selectedThemes]);
  const bossWordCount = useMemo(() => {
    if (!bossType) return 0;
    const cap = bossType === "mini" ? 20 : 30;
    return Math.min(cap, fullSessionWords.length);
  }, [bossType, fullSessionWords.length]);

  const bossStatus = bossType === "mini" ? goal?.miniBossStatus : goal?.bossStatus;
  const bossTitle = bossType === "mini" ? "Mini Boss" : "Big Boss";
  const bossFraming = bossType === "mini" ? "Checkpoint" : "Final Boss";
  const canStart = bossStatus === "available";

  const handleChallengePartner = async () => {
    if (!goalId || !bossType) return;
    setIsStartingDuel(true);
    try {
      const challengeId = await startBossDuel({
        goalId: goalId as Id<"weeklyGoals">,
        bossType,
      });
      router.push(`/classic-duel/${challengeId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start boss duel");
    } finally {
      setIsStartingDuel(false);
    }
  };

  const handlePracticeSolo = async () => {
    if (!goalId || !bossType) return;
    setIsStartingPractice(true);
    try {
      const challengeId = await startBossPractice({
        goalId: goalId as Id<"weeklyGoals">,
        bossType,
      });
      router.push(`/solo/learn/${challengeId}?challengeId=${challengeId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start practice");
    } finally {
      setIsStartingPractice(false);
    }
  };

  if (!bossType) {
    return (
      <ThemedPage className="px-4 py-6">
        <div className="max-w-md mx-auto rounded-2xl border-2 p-6" style={{ backgroundColor: colors.background.elevated, borderColor: colors.status.danger.DEFAULT }}>
          <p style={{ color: colors.text.DEFAULT }}>Unknown boss type.</p>
        </div>
      </ThemedPage>
    );
  }

  if (goal === undefined) {
    return (
      <ThemedPage className="px-4 py-6">
        <div className="max-w-md mx-auto flex items-center justify-center py-20">
          <p style={{ color: colors.text.muted }}>Loading...</p>
        </div>
      </ThemedPage>
    );
  }

  if (goal === null) {
    return (
      <ThemedPage className="px-4 py-6">
        <div className="max-w-md mx-auto space-y-4">
          <div className="rounded-2xl border-2 p-6 text-center" style={{ backgroundColor: colors.background.elevated, borderColor: colors.status.danger.DEFAULT }}>
            <p className="text-lg font-semibold" style={{ color: colors.text.DEFAULT }}>
              This goal is no longer available
            </p>
            <button
              onClick={() => router.push("/goals")}
              className="mt-4 rounded-xl border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide"
              style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark, color: colors.text.DEFAULT }}
            >
              Back to Goals
            </button>
          </div>
        </div>
      </ThemedPage>
    );
  }

  return (
    <ThemedPage className="px-4 py-6">
      <div className="max-w-md mx-auto space-y-4">
        <button
          onClick={() => router.push("/goals")}
          className="rounded-xl border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
        >
          Back to Goals
        </button>

        <section
          className="rounded-3xl border-2 p-6 space-y-4"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            boxShadow: `0 20px 50px ${colors.primary.glow}`,
          }}
        >
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em]" style={{ color: colors.text.muted }}>
              {bossFraming}
            </p>
            <h1 className="text-3xl font-bold" style={{ color: colors.text.DEFAULT }}>
              {bossTitle}
            </h1>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Launch a shared multi-theme boss duel, or warm up with solo practice first.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-2 p-4" style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}>
              <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                Themes
              </p>
              <p className="text-xl font-semibold" style={{ color: colors.text.DEFAULT }}>
                {goal?.goal.themes.length ?? 0}
              </p>
            </div>
            <div className="rounded-2xl border-2 p-4" style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}>
              <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                Words
              </p>
              <p className="text-xl font-semibold" style={{ color: colors.text.DEFAULT }}>
                {bossWordCount}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border-2 p-4" style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}>
            <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
              Status
            </p>
            <p className="text-lg font-semibold" style={{ color: colors.text.DEFAULT }}>
              {bossStatus === "available" ? "Ready to start" : bossStatus === "completed" ? "Already defeated" : "Still locked"}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => void handleChallengePartner()}
              disabled={!canStart || isStartingDuel}
              className="w-full rounded-2xl py-3 px-4 text-sm font-bold uppercase tracking-wide disabled:opacity-60"
              style={{
                backgroundColor: colors.cta.DEFAULT,
                color: colors.text.DEFAULT,
                boxShadow: `0 16px 35px ${colors.cta.glow}`,
              }}
              data-testid="boss-challenge-partner"
            >
              {isStartingDuel ? "Sending Invite..." : "Challenge Partner"}
            </button>

            <button
              onClick={() => void handlePracticeSolo()}
              disabled={!canStart || isStartingPractice}
              className="w-full rounded-2xl border-2 py-3 px-4 text-sm font-bold uppercase tracking-wide disabled:opacity-60"
              style={{
                backgroundColor: colors.background.DEFAULT,
                borderColor: colors.primary.dark,
                color: colors.text.DEFAULT,
              }}
              data-testid="boss-practice-solo"
            >
              {isStartingPractice ? "Preparing Practice..." : "Practice Solo"}
            </button>
          </div>
        </section>
      </div>
    </ThemedPage>
  );
}
