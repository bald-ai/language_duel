"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ThemedPage } from "@/app/components/ThemedPage";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { buildSoloUrl } from "@/lib/soloNavigation";
import { getErrorMessage } from "@/lib/errors";
import type { BossType } from "@/lib/limitedLives";
import { LIMITED_LIVES_DUEL_MODES, type DuelMode } from "@/lib/duelMode";
import { DuelModePicker } from "@/app/components/modals/DuelModePicker";

function isBossType(value: string): value is BossType {
  return value === "mini" || value === "big";
}

export default function BossLaunchPage() {
  const colors = useAppearanceColors();
  const params = useParams();
  const router = useRouter();
  const [isStartingDuel, setIsStartingDuel] = useState(false);
  const [isStartingPractice, setIsStartingPractice] = useState(false);
  const [selectedMode, setSelectedMode] = useState<DuelMode>("pvp");

  const goalId = typeof params.goalId === "string" ? params.goalId : "";
  const bossTypeParam = typeof params.bossType === "string" ? params.bossType : "";
  const bossType = isBossType(bossTypeParam) ? bossTypeParam : null;

  const preview = useQuery(
    api.weeklyGoals.getBossLaunchPreview,
    goalId && bossType
      ? { goalId: goalId as Id<"weeklyGoals">, bossType }
      : "skip"
  );
  const createBossChallenge = useMutation(api.weeklyGoals.createBossChallenge);
  const startBossSoloPractice = useMutation(api.weeklyGoals.startBossSoloPractice);
  const selectedBossStatus = preview?.selectedBossStatus;
  const isSoloGoal = preview?.mode === "solo";
  const bossTitle = bossType === "mini" ? "Mini Boss" : "Big Boss";
  const bossFraming = bossType === "mini" ? "Checkpoint" : "Final Boss";
  const canStart = selectedBossStatus === "ready";

  const handleChallengePartner = async () => {
    if (!goalId || !bossType) return;
    setIsStartingDuel(true);
    try {
      await createBossChallenge({
        goalId: goalId as Id<"weeklyGoals">,
        bossType,
        duelMode: selectedMode,
      });
      toast.success("Boss challenge sent.");
      router.push("/goals");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to start boss duel"));
    } finally {
      setIsStartingDuel(false);
    }
  };

  const handlePracticeSolo = async () => {
    if (!goalId || !bossType) return;
    setIsStartingPractice(true);
    try {
      const soloPracticeSessionId = await startBossSoloPractice({
        goalId: goalId as Id<"weeklyGoals">,
        bossType,
      });
      router.push(
        buildSoloUrl(String(soloPracticeSessionId), "learn_practice", {
          soloPracticeSessionId,
        })
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to start practice"));
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

  if (preview === undefined) {
    return (
      <ThemedPage className="px-4 py-6">
        <div className="max-w-md mx-auto flex items-center justify-center py-20">
          <p style={{ color: colors.text.muted }}>Loading...</p>
        </div>
      </ThemedPage>
    );
  }

  if (preview === null) {
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
              {isSoloGoal
                ? "Launch a solo boss run."
                : "Launch a shared multi-theme boss duel, or warm up with solo practice first."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border-2 p-4" style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}>
              <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                Themes
              </p>
              <p className="text-xl font-semibold" style={{ color: colors.text.DEFAULT }}>
                {preview.themeCount}
              </p>
            </div>
            <div className="rounded-2xl border-2 p-4" style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}>
              <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                Items
              </p>
              <p className="text-xl font-semibold" style={{ color: colors.text.DEFAULT }}>
                {preview.itemCount}
              </p>
            </div>
            <div className="rounded-2xl border-2 p-4" style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}>
              <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                Lives
              </p>
              <p className="text-xl font-semibold" style={{ color: colors.text.DEFAULT }}>
                {preview.livesTotal}
              </p>
            </div>
            <div className="rounded-2xl border-2 p-4" style={{ backgroundColor: colors.background.DEFAULT, borderColor: colors.primary.dark }}>
              <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                Status
              </p>
              <p className="text-lg font-semibold" style={{ color: colors.text.DEFAULT }}>
                {selectedBossStatus === "ready" ? "Ready to start" : selectedBossStatus === "defeated" ? "Already defeated" : "Still unavailable"}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {!isSoloGoal && (
              <>
                <DuelModePicker
                  selectedMode={selectedMode}
                  onSelectMode={setSelectedMode}
                  dataTestIdPrefix="boss-mode"
                  allowedModes={LIMITED_LIVES_DUEL_MODES}
                  layout="rows"
                />

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
              </>
            )}

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
