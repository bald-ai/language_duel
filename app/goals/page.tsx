"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";
import { toast } from "sonner";
import { ThemedPage } from "@/app/components/ThemedPage";
import { BackButton } from "@/app/components/BackButton";
import { PartnerSelector } from "./components/PartnerSelector";
import { GoalThemeList } from "./components/GoalThemeList";
import { LockButton } from "./components/LockButton";
import { DeleteGoalButton } from "./components/DeleteGoalButton";
import { GoalSwitcher } from "./components/GoalSwitcher";
import { MAX_THEMES_PER_GOAL, MIN_THEMES_TO_LOCK_GOAL } from "./constants";
import { canToggleGoalThemeCompletion } from "./helpers";
import {
  formatGoalGraceCountdown,
  getGoalDeleteAt,
  getGoalDraftExpiresAt,
  getMiniBossUnlockThreshold,
} from "@/lib/weeklyGoals";
import {
  BOSS_INFO_COPY,
  formatBossStatus,
  getBossButtonStyle,
  isBossButtonDisabled,
} from "./bossUi";
import { useCountdown } from "@/app/notifications/hooks/useCountdown";
import { buildSoloUrl, type SoloMode } from "@/lib/soloNavigation";

// Local storage key for remembering last viewed goal
const LAST_GOAL_KEY = "language_duel_last_weekly_goal";

const GoalThemeSelector = dynamic(
  () => import("./components/GoalThemeSelector").then((mod) => mod.GoalThemeSelector),
  { loading: () => null }
);
const SoloPracticeModal = dynamic(
  () => import("@/app/components/modals/SoloPracticeModal").then((mod) => mod.SoloPracticeModal),
  { loading: () => null }
);

// Format date as "Jan 4"
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDateInputValue(timestamp: number | undefined): string {
  if (typeof timestamp !== "number") return "";

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalEndOfDayTimestamp(dateValue: string): number | null {
  if (!dateValue) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null;
  }

  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

function formatGoalStatus(status: "draft" | "locked" | "grace_period" | "completed"): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "locked":
      return "Locked";
    case "grace_period":
      return "Grace period";
    case "completed":
      return "Completed";
  }
}

export default function GoalsPage() {
  const router = useRouter();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<Id<"users"> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreationFlow, setShowCreationFlow] = useState(false);
  const [endDateInput, setEndDateInput] = useState("");
  const [isSavingEndDate, setIsSavingEndDate] = useState(false);

  // All goals state
  const [selectedGoalId, setSelectedGoalId] = useState<Id<"weeklyGoals"> | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Queries - reactive and cached
  const friends = useQuery(api.friends.getFriends);
  const allGoals = useQuery(api.weeklyGoals.getVisibleGoals);
  const selectedGoal = useQuery(
    api.weeklyGoals.getGoalById,
    selectedGoalId ? { goalId: selectedGoalId } : "skip"
  );
  const weeklyGoalPracticeThemes = useQuery(
    api.weeklyGoals.getWeeklyGoalPracticeThemes,
    showPracticeModal && selectedGoalId ? { weeklyGoalId: selectedGoalId } : "skip"
  );

  // Mutations
  const createGoal = useMutation(api.weeklyGoals.createGoal);
  const addTheme = useMutation(api.weeklyGoals.addTheme);
  const removeTheme = useMutation(api.weeklyGoals.removeTheme);
  const toggleCompletion = useMutation(api.weeklyGoals.toggleCompletion);
  const lockGoal = useMutation(api.weeklyGoals.lockGoal);
  const deleteGoal = useMutation(api.weeklyGoals.deleteGoal);
  const syncGracePeriodGoals = useMutation(api.weeklyGoals.syncGracePeriodGoalsForUser);
  const setGoalEndDate = useMutation(api.weeklyGoals.setGoalEndDate);

  // Initial selection and periodic expiry cleanup
  useEffect(() => {
    if (!allGoals || initialLoadDone) return;

    // Restore last viewed goal or select first
    if (allGoals.length > 0) {
      const lastGoalId = localStorage.getItem(LAST_GOAL_KEY);
      const goalExists = allGoals.some((p) => p.goal._id === lastGoalId);
      const targetId = goalExists ? (lastGoalId as Id<"weeklyGoals">) : allGoals[0].goal._id;
      setSelectedGoalId(targetId);
      localStorage.setItem(LAST_GOAL_KEY, targetId);
    }
    setInitialLoadDone(true);

    // Move overdue goals into grace period and delete goals past retention.
    void syncGracePeriodGoals();
  }, [allGoals, initialLoadDone, syncGracePeriodGoals]);

  // Update localStorage when selection changes
  useEffect(() => {
    if (selectedGoalId) {
      localStorage.setItem(LAST_GOAL_KEY, selectedGoalId);
    }
  }, [selectedGoalId]);

  useEffect(() => {
    setEndDateInput(formatDateInputValue(selectedGoal?.goal?.endDate));
  }, [selectedGoal?.goal?.endDate, selectedGoal?.goal?._id]);

  // Ensure a valid goal is always selected when goals exist
  useEffect(() => {
    if (!allGoals || allGoals.length === 0) return;
    if (!initialLoadDone) return; // Don't interfere with initial load

    // Check if selectedGoal is null and selectedGoalId is either null or not found in allGoals
    const goalExists = selectedGoalId && allGoals.some((p) => p.goal._id === selectedGoalId);

    if (selectedGoal === null && !goalExists) {
      // Select the first available goal
      const firstGoalId = allGoals[0].goal._id;
      setSelectedGoalId(firstGoalId);
      localStorage.setItem(LAST_GOAL_KEY, firstGoalId);
    }
  }, [allGoals, selectedGoal, selectedGoalId, initialLoadDone]);

  const deleteAt = getGoalDeleteAt(selectedGoal?.goal?.endDate);
  const graceCountdown = useCountdown(deleteAt ?? 0);
  const formattedGraceCountdown = formatGoalGraceCountdown(graceCountdown.timeRemaining);
  const draftExpiresAt = getGoalDraftExpiresAt(selectedGoal?.goal?.createdAt);
  const draftCountdown = useCountdown(draftExpiresAt ?? 0);
  const formattedDraftCountdown = formatGoalGraceCountdown(draftCountdown.timeRemaining);

  // Handle goal selection from switcher
  const handleSelectGoal = (goalId: Id<"weeklyGoals">) => {
    setSelectedGoalId(goalId);
    setShowCreationFlow(false);
  };

  // Handlers
  const handleCreateGoal = async () => {
    if (!selectedPartnerId) return;
    setIsCreating(true);
    try {
      const newGoalId = await createGoal({ partnerId: selectedPartnerId });
      toast.success("Goal created! Add themes to get started.");
      setSelectedPartnerId(null);
      setShowCreationFlow(false);
      // Select the newly created goal - query will auto-refresh
      setSelectedGoalId(newGoalId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create goal");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddThemes = async (themeIds: Id<"themes">[]) => {
    if (!selectedGoal?.goal) return;
    try {
      const remainingSlots = Math.max(0, MAX_THEMES_PER_GOAL - selectedGoal.goal.themes.length);
      const existingThemeIds = new Set(
        selectedGoal.goal.themes.map((theme) => theme.themeId)
      );
      const addedThemeIds = new Set<Id<"themes">>();
      const addPromises: Promise<unknown>[] = [];

      for (const themeId of themeIds) {
        if (addPromises.length >= remainingSlots) break;
        if (existingThemeIds.has(themeId) || addedThemeIds.has(themeId)) continue;

        addPromises.push(addTheme({ goalId: selectedGoal.goal._id, themeId }));
        addedThemeIds.add(themeId);
      }
      let fulfilledCount = 0;
      if (addPromises.length > 0) {
        const results = await Promise.allSettled(addPromises);
        fulfilledCount = results.filter((result) => result.status === "fulfilled").length;
      }
      setShowThemeSelector(false);
      // Query will auto-refresh
      if (fulfilledCount > 0) {
        toast.success(`Added ${fulfilledCount} theme${fulfilledCount === 1 ? "" : "s"}`);
      } else {
        toast.error("Failed to add themes");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add themes");
    }
  };

  const handleRemoveTheme = async (themeId: Id<"themes">) => {
    if (!selectedGoal?.goal) return;

    const { goal, viewerRole, creator, partner } = selectedGoal;
    const lockedRole = goal.creatorLocked
      ? "creator"
      : goal.partnerLocked
        ? "partner"
        : null;
    const partnerName =
      viewerRole === "creator"
        ? (partner?.nickname || partner?.email?.split("@")[0] || "Your partner")
        : (creator?.nickname || creator?.email?.split("@")[0] || "Your partner");

    try {
      await removeTheme({ goalId: goal._id, themeId });
      if (lockedRole === viewerRole) {
        toast.success("You removed a theme, so your lock was cleared.");
      } else if (lockedRole) {
        toast.success(`You removed a theme, so ${partnerName}'s lock was cleared.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove theme");
    }
  };

  const handleToggleCompletion = async (themeId: Id<"themes">) => {
    if (!selectedGoal?.goal) return;
    try {
      await toggleCompletion({ goalId: selectedGoal.goal._id, themeId });
      // Query will auto-refresh
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  };

  const handleLock = async () => {
    if (!selectedGoal?.goal) return;

    if (selectedGoal.goal.themes.length < MIN_THEMES_TO_LOCK_GOAL) {
      toast.error(`Add at least ${MIN_THEMES_TO_LOCK_GOAL} themes before locking.`);
      return;
    }
    if (typeof selectedGoal.goal.endDate !== "number") {
      toast.error("Pick an end date before locking.");
      return;
    }

    try {
      await lockGoal({ goalId: selectedGoal.goal._id });
      toast.success("Goal locked!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to lock goal");
    }
  };

  const handlePracticeGoalThemes = () => {
    if (!selectedGoal?.goal || selectedGoal.goal.themes.length < MIN_THEMES_TO_LOCK_GOAL) return;
    setShowPracticeModal(true);
  };

  const handleContinuePractice = (
    themeIds: Id<"themes">[],
    mode: SoloMode,
    durationSeconds?: number
  ) => {
    if (!selectedGoal?.goal || themeIds.length === 0) return;

    router.push(
      buildSoloUrl(crypto.randomUUID(), mode, {
        weeklyGoalId: selectedGoal.goal._id,
        themeIds,
        durationSeconds,
        returnTo: "/goals",
        returnLabel: "Back to weekly goal",
      })
    );
    setShowPracticeModal(false);
  };

  const handleDelete = async () => {
    if (!selectedGoal?.goal) return;
    try {
      await deleteGoal({ goalId: selectedGoal.goal._id });
      setSelectedGoalId(null);
      // Query will auto-refresh
      toast.success("Goal deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete goal");
    }
  };

  const handleSaveEndDate = async (dateValue: string) => {
    if (!selectedGoal?.goal) return;

    const timestamp = toLocalEndOfDayTimestamp(dateValue);
    if (timestamp == null) return;

    setIsSavingEndDate(true);
    try {
      await setGoalEndDate({
        goalId: selectedGoal.goal._id,
        endDate: timestamp,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save end date");
    } finally {
      setIsSavingEndDate(false);
    }
  };

  // Loading state
  if (allGoals === undefined || friends === undefined) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.background.DEFAULT }}
      >
        <div style={{ color: colors.text.muted }} className="text-lg">
          Loading...
        </div>
      </div>
    );
  }

  // Filter out friends who already have a visible goal with the user.
  // Since max 1 goal per pair is enforced, we exclude anyone already in allGoals
  const existingPartnerIds = new Set(
    allGoals?.flatMap((goalWithUsers) => [
      goalWithUsers.partner?._id,
      goalWithUsers.creator?._id,
    ].filter(Boolean)) ?? []
  );
  const availableFriends = friends?.filter(
    friend => !existingPartnerIds.has(friend.friendId)
  ) ?? [];

  // Determine current state
  const hasGoals = allGoals.length > 0;
  const hasGoalSelected = selectedGoal != null; // handles both null and undefined
  const effectiveStatus = selectedGoal?.effectiveStatus;
  const isDraft = effectiveStatus === "draft";
  const isGracePeriod = effectiveStatus === "grace_period";
  const canAddThemes =
    isDraft &&
    hasGoalSelected &&
    selectedGoal.goal.themes.length < MAX_THEMES_PER_GOAL;
  const viewerLocked =
    hasGoalSelected &&
    ((selectedGoal.viewerRole === "creator" && selectedGoal.goal.creatorLocked) ||
      (selectedGoal.viewerRole === "partner" && selectedGoal.goal.partnerLocked));
  const partnerLocked =
    hasGoalSelected &&
    ((selectedGoal.viewerRole === "creator" && selectedGoal.goal.partnerLocked) ||
      (selectedGoal.viewerRole === "partner" && selectedGoal.goal.creatorLocked));
  const canToggleThemeCompletion = canToggleGoalThemeCompletion({
    effectiveStatus,
  });
  const hasEnoughThemesToLock =
    hasGoalSelected && selectedGoal.goal.themes.length >= MIN_THEMES_TO_LOCK_GOAL;
  const canPracticeGoalThemes = Boolean(hasEnoughThemesToLock);
  const hasEndDate = hasGoalSelected && typeof selectedGoal.goal.endDate === "number";
  const canEditEndDate = Boolean(selectedGoal?.canEditEndDate);
  const allSelectedThemesCompleted = Boolean(
    selectedGoal &&
    selectedGoal.goal.themes.length > 0 &&
    selectedGoal.completedThemeCount === selectedGoal.goal.themes.length
  );
  const miniBossDisplayStatus = allSelectedThemesCompleted
    ? "unavailable"
    : selectedGoal?.miniBossStatus ?? "unavailable";
  const miniBossLabel = allSelectedThemesCompleted
    ? "All themes completed - Do big boss!"
    : selectedGoal
      ? formatBossStatus(selectedGoal.miniBossStatus)
      : "";
  const startDate = selectedGoal?.goal?.lockedAt
    ? formatDate(selectedGoal.goal.lockedAt)
    : null;
  const endDate = selectedGoal?.goal?.endDate
    ? formatDate(selectedGoal.goal.endDate)
    : null;

  return (
    <ThemedPage className="px-4 py-6">
      <div className="w-full max-w-[29rem] mx-auto space-y-6 relative z-10">
        {/* Header */}
        <header className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push("/")}
            className="p-2 rounded-lg border-2 transition-colors hover:opacity-80"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
            }}
            data-testid="goals-back"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke={colors.text.muted}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1
            className="text-2xl font-bold uppercase tracking-wide"
            style={{ color: colors.text.DEFAULT }}
          >
            Weekly Goals
          </h1>
        </header>

        {/* Goal Switcher - show when user has goals */}
        {hasGoals && (
          <GoalSwitcher
            goals={allGoals}
            selectedId={selectedGoalId}
            onSelect={handleSelectGoal}
            onCreateNew={() => setShowCreationFlow(true)}
          />
        )}

        {/* Creation Flow - show when no goals OR user clicked + */}
        {(!hasGoals || showCreationFlow) && (
          <section
            className="rounded-2xl border-2 p-6 space-y-6"
            style={{
              backgroundColor: colors.background.elevated,
              borderColor: colors.primary.dark,
            }}
          >
            <div className="text-center space-y-2">
              <h2
                className="text-xl font-bold"
                style={{ color: colors.text.DEFAULT }}
              >
                Create a Weekly Goal
              </h2>
              <p style={{ color: colors.text.muted }} className="text-sm">
                Pick a partner, choose themes, and set a finish date for your shared goal
              </p>
            </div>

            <PartnerSelector
              friends={availableFriends}
              selectedId={selectedPartnerId}
              onSelect={setSelectedPartnerId}
            />

            <div className="flex gap-2">
              {showCreationFlow && (
                <button
                  onClick={() => setShowCreationFlow(false)}
                  className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider transition-colors border-2"
                  style={{
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.primary.dark,
                    color: colors.text.DEFAULT,
                  }}
                  data-testid="goals-create-cancel"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleCreateGoal}
                disabled={!selectedPartnerId || isCreating}
                className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: colors.primary.DEFAULT,
                  color: "white",
                  textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                }}
                data-testid="goals-create-submit"
              >
                {isCreating ? "Creating..." : "Create Goal"}
              </button>
            </div>
          </section>
        )}

        {/* Selected Goal Display */}
        {selectedGoal && !showCreationFlow && (
          <>
            {/* Partner Display Header */}
            <section
              className="rounded-2xl border-2 p-4"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Creator */}
                  <div className="text-center">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: colors.primary.DEFAULT,
                        color: colors.text.DEFAULT,
                      }}
                    >
                      {selectedGoal.creator?.nickname?.charAt(0).toUpperCase() ||
                        selectedGoal.creator?.email?.charAt(0).toUpperCase() ||
                        "?"}
                    </div>
                    <p
                      className="text-xs mt-1 max-w-[60px] truncate"
                      style={{ color: colors.text.muted }}
                    >
                      {selectedGoal.creator?.nickname || selectedGoal.creator?.email?.split("@")[0]}
                    </p>
                    {selectedGoal.goal.creatorLocked && (
                      <span style={{ color: colors.status.success.DEFAULT }}>✓</span>
                    )}
                  </div>
                </div>

                {/* Date Range */}
                <div className="text-center">
                  <p
                    className="text-sm font-bold"
                    style={{ color: colors.text.DEFAULT }}
                  >
                    {startDate && endDate
                      ? `${startDate} to ${endDate}`
                      : endDate
                        ? `Ends ${endDate}`
                        : "Draft phase"}
                  </p>
                  <p className="text-xs" style={{ color: colors.text.muted }}>
                    {formatGoalStatus(selectedGoal.effectiveStatus)}
                  </p>
                </div>

                {/* Partner */}
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: colors.secondary.DEFAULT,
                        color: colors.text.DEFAULT,
                      }}
                    >
                      {selectedGoal.partner?.nickname?.charAt(0).toUpperCase() ||
                        selectedGoal.partner?.email?.charAt(0).toUpperCase() ||
                        "?"}
                    </div>
                    <p
                      className="text-xs mt-1 max-w-[60px] truncate"
                      style={{ color: colors.text.muted }}
                    >
                      {selectedGoal.partner?.nickname || selectedGoal.partner?.email?.split("@")[0]}
                    </p>
                    {selectedGoal.goal.partnerLocked && (
                      <span style={{ color: colors.status.success.DEFAULT }}>✓</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section
              className="rounded-2xl border-2 p-4 space-y-4"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: isGracePeriod
                  ? colors.status.warning.DEFAULT
                  : colors.primary.dark,
              }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p
                    className="text-sm font-bold uppercase tracking-wide"
                    style={{ color: colors.text.DEFAULT }}
                  >
                    Goal Timing
                  </p>
                  <p className="text-sm" style={{ color: colors.text.muted }}>
                    {isGracePeriod
                      ? "The goal is in grace period. You still have a final window to finish it."
                      : "Pick an end date for this weekly goal."}
                  </p>
                </div>
              </div>

              {isGracePeriod ? (
                <div
                  className="rounded-2xl border-2 p-5 space-y-4"
                  style={{
                    backgroundColor: colors.background.DEFAULT,
                    borderColor: colors.status.danger.DEFAULT,
                  }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className="text-xs font-bold uppercase tracking-[0.2em]"
                        style={{ color: colors.status.danger.DEFAULT }}
                      >
                        Grace Period
                      </p>
                      <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
                        This goal will be permanently removed when the timer hits zero.
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                        Deletes At
                      </p>
                      <p
                        className="text-sm font-semibold"
                        style={{ color: colors.text.DEFAULT }}
                        data-testid="goals-delete-deadline"
                      >
                        {deleteAt ? formatDateTime(deleteAt) : "Unknown"}
                      </p>
                    </div>
                  </div>

                  <div
                    className="rounded-2xl px-4 py-5 text-center"
                    style={{ backgroundColor: `${colors.status.danger.DEFAULT}14` }}
                  >
                    <p
                      className="text-[2.5rem] font-black tracking-[0.2em] tabular-nums"
                      style={{ color: colors.status.danger.DEFAULT }}
                      data-testid="goals-grace-countdown"
                    >
                      {formattedGraceCountdown}
                    </p>
                    <p className="text-sm mt-3" style={{ color: colors.text.DEFAULT }}>
                      You can still complete this goal before the timer runs out.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {isDraft && draftExpiresAt && (
                    <div
                      className="rounded-xl border px-4 py-3"
                      style={{
                        backgroundColor: colors.background.DEFAULT,
                        borderColor: colors.neutral.light,
                        color: colors.text.muted,
                      }}
                      data-testid="goals-draft-expiry"
                    >
                      <p className="text-sm">
                        Draft expires in{" "}
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color: colors.text.DEFAULT }}
                          data-testid="goals-draft-countdown"
                        >
                          {formattedDraftCountdown}
                        </span>
                        . Lock this goal before then or it will be removed.
                      </p>
                    </div>
                  )}
                  <label>
                    <span className="sr-only">End date</span>
                    <input
                      type="date"
                      value={endDateInput}
                      onChange={(event) => {
                        const value = event.target.value;
                        setEndDateInput(value);
                        if (value && value !== formatDateInputValue(selectedGoal.goal.endDate)) {
                          void handleSaveEndDate(value);
                        }
                      }}
                      disabled={!canEditEndDate || isSavingEndDate}
                      className="w-full rounded-xl border-2 px-3 py-3 disabled:opacity-60"
                      style={{
                        backgroundColor: colors.background.DEFAULT,
                        borderColor: colors.primary.dark,
                        color: colors.text.DEFAULT,
                      }}
                      data-testid="goals-end-date-input"
                    />
                  </label>
                </div>
              )}

              {!isGracePeriod && !canEditEndDate && (
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  This end date is now read-only.
                </p>
              )}
            </section>

            <section
              className="rounded-2xl border-2 p-4 space-y-3"
              style={{
                backgroundColor: colors.background.elevated,
                borderColor: colors.primary.dark,
              }}
            >
              <div className="flex items-center justify-between">
                <p
                  className="text-sm font-bold uppercase tracking-wide"
                  style={{ color: colors.text.DEFAULT }}
                >
                  Boss Progress
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-sm" style={{ color: colors.text.muted }}>
                    Shared themes: {selectedGoal.completedThemeCount}/{selectedGoal.goal.themes.length}
                  </p>
                  <details className="relative">
                    <summary
                      className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border text-xs font-bold"
                      style={{
                        borderColor: colors.primary.dark,
                        backgroundColor: colors.background.DEFAULT,
                        color: colors.text.muted,
                      }}
                      aria-label="Boss info"
                    >
                      i
                    </summary>
                    <div
                      className="absolute right-0 top-8 z-10 w-72 rounded-xl border-2 p-3 text-xs shadow-lg"
                      style={{
                        borderColor: colors.primary.dark,
                        backgroundColor: colors.background.elevated,
                        color: colors.text.DEFAULT,
                      }}
                    >
                      <p className="font-semibold" style={{ color: colors.text.DEFAULT }}>
                        Mini Boss
                      </p>
                      <p style={{ color: colors.text.muted }}>
                        {BOSS_INFO_COPY.mini}
                      </p>
                      <p className="mt-3 font-semibold" style={{ color: colors.text.DEFAULT }}>
                        Big Boss
                      </p>
                      <p style={{ color: colors.text.muted }}>
                        {BOSS_INFO_COPY.big}
                      </p>
                    </div>
                  </details>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (!allSelectedThemesCompleted && selectedGoal.miniBossStatus === "ready") {
                      router.push(`/boss/${selectedGoal.goal._id}/mini`);
                    }
                  }}
                  disabled={allSelectedThemesCompleted || isBossButtonDisabled(selectedGoal.miniBossStatus)}
                  className="flex-1 rounded-xl border-2 px-3 py-2 text-left transition-all disabled:opacity-60"
                  style={getBossButtonStyle(miniBossDisplayStatus)}
                  data-testid="goals-mini-boss-trigger"
                >
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Mini Boss
                  </p>
                  <p className="font-semibold" style={{ color: colors.text.DEFAULT }}>
                    {miniBossLabel}
                  </p>
                </button>
                <button
                  onClick={() => {
                    if (selectedGoal.bossStatus === "ready") {
                      router.push(`/boss/${selectedGoal.goal._id}/big`);
                    }
                  }}
                  disabled={isBossButtonDisabled(selectedGoal.bossStatus)}
                  className="flex-1 rounded-xl border-2 px-3 py-2 text-left transition-all disabled:opacity-60"
                  style={getBossButtonStyle(selectedGoal.bossStatus)}
                  data-testid="goals-big-boss-trigger"
                >
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Big Boss
                  </p>
                  <p className="font-semibold" style={{ color: colors.text.DEFAULT }}>
                    {formatBossStatus(selectedGoal.bossStatus)}
                  </p>
                </button>
              </div>
              {!isDraft && allSelectedThemesCompleted && (
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  All themes completed - Do big boss!
                </p>
              )}
              {!isDraft && !allSelectedThemesCompleted && selectedGoal.miniBossStatus === "unavailable" && (
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  Mini boss unlocks when {getMiniBossUnlockThreshold(selectedGoal.goal.themes.length)} theme{getMiniBossUnlockThreshold(selectedGoal.goal.themes.length) === 1 ? " is" : "s are"} done.
                </p>
              )}
              {!isDraft && !allSelectedThemesCompleted && selectedGoal.miniBossStatus !== "unavailable" && selectedGoal.bossStatus === "unavailable" && (
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  {selectedGoal.miniBossStatus === "ready"
                    ? "Tap Mini Boss to start, or complete all themes to unlock the big boss."
                    : "Complete all themes to unlock the big boss."}
                </p>
              )}
              {isDraft && (
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  Lock the goal with at least {MIN_THEMES_TO_LOCK_GOAL} themes and an end date to start boss tracking.
                </p>
              )}
            </section>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handlePracticeGoalThemes}
                disabled={!canPracticeGoalThemes}
                className="flex w-full items-center justify-center gap-3 rounded-xl border-2 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  backgroundColor: colors.background.elevated,
                  borderColor: colors.primary.dark,
                  color: colors.text.DEFAULT,
                }}
                data-testid="goals-practice-themes"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke={colors.cta.light} strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Practice goal themes
              </button>
              {!canPracticeGoalThemes && (
                <p className="text-center text-xs" style={{ color: colors.text.muted }}>
                  Add at least {MIN_THEMES_TO_LOCK_GOAL} themes to practice this goal.
                </p>
              )}
            </div>

            {/* Theme List */}
            <GoalThemeList
              themes={selectedGoal.goal.themes}
              viewerRole={selectedGoal.viewerRole}
              isEditing={isDraft}
              canToggle={canToggleThemeCompletion}
              onToggle={handleToggleCompletion}
              onRemove={handleRemoveTheme}
            />

            {/* Add Theme Button (only in draft mode and below the max theme limit) */}
            {canAddThemes && (
              <button
                onClick={() => setShowThemeSelector(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed text-sm font-bold uppercase tracking-wide transition-all hover:opacity-80"
                style={{
                  borderColor: colors.primary.dark,
                  color: colors.text.DEFAULT,
                  backgroundColor: `${colors.background.elevated}CC`,
                }}
                data-testid="goals-add-theme"
              >
                + Add Theme ({selectedGoal.goal.themes.length}/{MAX_THEMES_PER_GOAL})
              </button>
            )}

            {/* Theme count at max */}
            {isDraft && selectedGoal.goal.themes.length >= MAX_THEMES_PER_GOAL && (
              <p
                className="text-center text-sm"
                style={{ color: colors.text.muted }}
              >
                Maximum themes reached ({MAX_THEMES_PER_GOAL}/{MAX_THEMES_PER_GOAL})
              </p>
            )}

            {/* Lock Button (only in draft mode, if user hasn't locked) */}
            {isDraft && !viewerLocked && (
              <>
                <LockButton
                  partnerLocked={partnerLocked}
                  onLock={handleLock}
                />
                {(!hasEnoughThemesToLock || !hasEndDate) && (
                  <p className="text-center text-sm" style={{ color: colors.text.muted }}>
                    {!hasEnoughThemesToLock
                      ? `Add at least ${MIN_THEMES_TO_LOCK_GOAL} themes before locking.`
                      : "Choose an end date before locking."}
                  </p>
                )}
              </>
            )}

            {/* Delete Button */}
            {selectedGoal && (
              <DeleteGoalButton onDelete={handleDelete} />
            )}

            {/* Waiting for partner to lock */}
            {isDraft && viewerLocked && !partnerLocked && (
              <div
                className="text-center py-4 rounded-xl border-2"
                style={{
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.primary.dark,
                }}
              >
                <p style={{ color: colors.text.muted }}>
                  Waiting for partner to lock...
                </p>
              </div>
            )}

            {isGracePeriod && (
              <div
                className="text-center py-4 rounded-xl border-2"
                style={{
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.status.warning.DEFAULT,
                }}
              >
                <p style={{ color: colors.text.DEFAULT }}>
                  This goal reached its grace period before the big boss was defeated.
                </p>
                <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                  You can still finish it before the 48-hour grace window ends.
                </p>
              </div>
            )}
          </>
        )}

        {/* Theme Selector Modal */}
        {showThemeSelector && selectedGoal?.goal && (
          <GoalThemeSelector
            goalId={selectedGoal.goal._id}
            currentThemeCount={selectedGoal.goal.themes.length}
            onSelect={handleAddThemes}
            onClose={() => setShowThemeSelector(false)}
          />
        )}

        {showPracticeModal && selectedGoal?.goal && (
          weeklyGoalPracticeThemes && weeklyGoalPracticeThemes.ok ? (
            <SoloPracticeModal
              key={`${selectedGoal.goal._id}:${weeklyGoalPracticeThemes.source}`}
              themes={weeklyGoalPracticeThemes.themes}
              onContinue={handleContinuePractice}
              onClose={() => setShowPracticeModal(false)}
              onNavigateToThemes={() => {}}
              initialDraftThemeIds={weeklyGoalPracticeThemes.themes.map((theme) => theme._id)}
              forceThemeSelectorFirst
              hideCreateThemeButton
              themeSelectorNotice={
                weeklyGoalPracticeThemes.source === "snapshot"
                  ? "Practicing from the snapshot taken when this goal was locked. Editing the original themes won't affect this practice."
                  : undefined
              }
            />
          ) : (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
              role="dialog"
              aria-modal="true"
            >
              <div
                className="w-full max-w-md rounded-2xl border-2 p-5 text-center"
                style={{
                  backgroundColor: colors.background.elevated,
                  borderColor: weeklyGoalPracticeThemes?.ok === false
                    ? colors.status.danger.DEFAULT
                    : colors.primary.dark,
                }}
              >
                <p className="text-sm" style={{ color: colors.text.DEFAULT }}>
                  {weeklyGoalPracticeThemes?.ok === false
                    ? weeklyGoalPracticeThemes.message
                    : "Loading goal themes..."}
                </p>
                {weeklyGoalPracticeThemes?.ok === false && (
                  <button
                    type="button"
                    onClick={() => setShowPracticeModal(false)}
                    className="mt-4 rounded-xl border-2 px-4 py-2 text-sm font-bold uppercase tracking-wide"
                    style={{
                      backgroundColor: colors.background.DEFAULT,
                      borderColor: colors.primary.dark,
                      color: colors.text.DEFAULT,
                    }}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {/* Back Button */}
        <BackButton onClick={() => router.push("/")} label="Back to Menu" dataTestId="goals-back-menu" />
      </div>
    </ThemedPage>
  );
}
