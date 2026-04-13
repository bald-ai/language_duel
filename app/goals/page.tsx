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
import { PlanSwitcher } from "./components/PlanSwitcher";
import { MAX_THEMES_PER_GOAL, MIN_THEMES_TO_LOCK_GOAL } from "./constants";
import { getMiniBossUnlockThreshold } from "@/lib/weeklyGoals";
import {
  BOSS_INFO_COPY,
  formatBossStatus,
  getBossButtonStyle,
  isBossButtonDisabled,
} from "@/lib/bossUi";

// Local storage key for remembering last viewed plan
const LAST_PLAN_KEY = "language_duel_last_weekly_plan";

const GoalThemeSelector = dynamic(
  () => import("./components/GoalThemeSelector").then((mod) => mod.GoalThemeSelector),
  { loading: () => null }
);

// Format date as "Jan 4"
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

function formatGoalStatus(status: "editing" | "active" | "expired" | "completed"): string {
  switch (status) {
    case "editing":
      return "Planning";
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "completed":
      return "Completed";
  }
}

export default function GoalsPage() {
  const router = useRouter();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<Id<"users"> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreationFlow, setShowCreationFlow] = useState(false);
  const [endDateInput, setEndDateInput] = useState("");
  const [isSavingEndDate, setIsSavingEndDate] = useState(false);

  // All plans state
  const [selectedPlanId, setSelectedPlanId] = useState<Id<"weeklyGoals"> | null>(null);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Queries - reactive and cached
  const friends = useQuery(api.friends.getFriends);
  const allPlans = useQuery(api.weeklyGoals.getAllActiveGoals);
  const selectedPlan = useQuery(
    api.weeklyGoals.getGoalById,
    selectedPlanId ? { goalId: selectedPlanId } : "skip"
  );

  // Mutations
  const createGoal = useMutation(api.weeklyGoals.createGoal);
  const addTheme = useMutation(api.weeklyGoals.addTheme);
  const removeTheme = useMutation(api.weeklyGoals.removeTheme);
  const toggleCompletion = useMutation(api.weeklyGoals.toggleCompletion);
  const lockGoal = useMutation(api.weeklyGoals.lockGoal);
  const deleteGoal = useMutation(api.weeklyGoals.deleteGoal);
  const purgeExpiredGoals = useMutation(api.weeklyGoals.purgeExpiredGoalsForUser);
  const setGoalEndDate = useMutation(api.weeklyGoals.setGoalEndDate);

  // Initial selection and periodic expiry cleanup
  useEffect(() => {
    if (!allPlans || initialLoadDone) return;

    // Restore last viewed plan or select first
    if (allPlans.length > 0) {
      const lastPlanId = localStorage.getItem(LAST_PLAN_KEY);
      const planExists = allPlans.some((p) => p.goal._id === lastPlanId);
      const targetId = planExists ? (lastPlanId as Id<"weeklyGoals">) : allPlans[0].goal._id;
      setSelectedPlanId(targetId);
      localStorage.setItem(LAST_PLAN_KEY, targetId);
    }
    setInitialLoadDone(true);

    // Purge expired goals on initial load
    void purgeExpiredGoals();
  }, [allPlans, initialLoadDone, purgeExpiredGoals]);

  // Update localStorage when selection changes
  useEffect(() => {
    if (selectedPlanId) {
      localStorage.setItem(LAST_PLAN_KEY, selectedPlanId);
    }
  }, [selectedPlanId]);

  useEffect(() => {
    setEndDateInput(formatDateInputValue(selectedPlan?.goal?.endDate));
  }, [selectedPlan?.goal?.endDate, selectedPlan?.goal?._id]);

  // Ensure a valid plan is always selected when plans exist
  useEffect(() => {
    if (!allPlans || allPlans.length === 0) return;
    if (!initialLoadDone) return; // Don't interfere with initial load

    // Check if selectedPlan is null and selectedPlanId is either null or not found in allPlans
    const planExists = selectedPlanId && allPlans.some((p) => p.goal._id === selectedPlanId);

    if (selectedPlan === null && !planExists) {
      // Select the first available plan
      const firstPlanId = allPlans[0].goal._id;
      setSelectedPlanId(firstPlanId);
      localStorage.setItem(LAST_PLAN_KEY, firstPlanId);
    }
  }, [allPlans, selectedPlan, selectedPlanId, initialLoadDone]);

  // Handle plan selection from switcher
  const handleSelectPlan = (planId: Id<"weeklyGoals">) => {
    setSelectedPlanId(planId);
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
      setSelectedPlanId(newGoalId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create goal");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddThemes = async (themeIds: Id<"themes">[]) => {
    if (!selectedPlan?.goal) return;
    try {
      const remainingSlots = Math.max(0, MAX_THEMES_PER_GOAL - selectedPlan.goal.themes.length);
      const existingThemeIds = new Set(
        selectedPlan.goal.themes.map((theme) => theme.themeId)
      );
      const addedThemeIds = new Set<Id<"themes">>();
      const addPromises: Promise<unknown>[] = [];

      for (const themeId of themeIds) {
        if (addPromises.length >= remainingSlots) break;
        if (existingThemeIds.has(themeId) || addedThemeIds.has(themeId)) continue;

        addPromises.push(addTheme({ goalId: selectedPlan.goal._id, themeId }));
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
    if (!selectedPlan?.goal) return;
    try {
      await removeTheme({ goalId: selectedPlan.goal._id, themeId });
      // Query will auto-refresh
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove theme");
    }
  };

  const handleToggleCompletion = async (themeId: Id<"themes">) => {
    if (!selectedPlan?.goal) return;
    try {
      await toggleCompletion({ goalId: selectedPlan.goal._id, themeId });
      // Query will auto-refresh
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  };

  const handleLock = async () => {
    if (!selectedPlan?.goal) return;

    if (selectedPlan.goal.themes.length < MIN_THEMES_TO_LOCK_GOAL) {
      toast.error(`Add at least ${MIN_THEMES_TO_LOCK_GOAL} themes before locking.`);
      return;
    }
    if (typeof selectedPlan.goal.endDate !== "number") {
      toast.error("Pick an end date before locking.");
      return;
    }

    try {
      await lockGoal({ goalId: selectedPlan.goal._id });
      toast.success("Goal locked!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to lock goal");
    }
  };

  const handleDelete = async () => {
    if (!selectedPlan?.goal) return;
    try {
      await deleteGoal({ goalId: selectedPlan.goal._id });
      setSelectedPlanId(null);
      // Query will auto-refresh
      toast.success("Goal deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete goal");
    }
  };

  const handleSaveEndDate = async (dateValue: string) => {
    if (!selectedPlan?.goal) return;

    const timestamp = toLocalEndOfDayTimestamp(dateValue);
    if (timestamp == null) return;

    setIsSavingEndDate(true);
    try {
      await setGoalEndDate({
        goalId: selectedPlan.goal._id,
        endDate: timestamp,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save end date");
    } finally {
      setIsSavingEndDate(false);
    }
  };

  // Loading state
  if (allPlans === undefined || friends === undefined) {
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

  // Filter out friends who already have an active/editing goal with the user
  // Since max 1 goal per pair is enforced, we exclude anyone already in allPlans
  const existingPartnerIds = new Set(
    allPlans?.flatMap(plan => [
      plan.partner?._id,
      plan.creator?._id,
    ].filter(Boolean)) ?? []
  );
  const availableFriends = friends?.filter(
    friend => !existingPartnerIds.has(friend.friendId)
  ) ?? [];

  // Determine current state
  const hasPlans = allPlans.length > 0;
  const hasPlanSelected = selectedPlan != null; // handles both null and undefined
  const effectiveStatus = selectedPlan?.effectiveStatus;
  const isEditing = effectiveStatus === "editing";
  const isActive = effectiveStatus === "active";
  const isExpired = effectiveStatus === "expired";
  const canAddThemes =
    isEditing &&
    hasPlanSelected &&
    selectedPlan.goal.themes.length < MAX_THEMES_PER_GOAL;
  const viewerLocked =
    hasPlanSelected &&
    ((selectedPlan.viewerRole === "creator" && selectedPlan.goal.creatorLocked) ||
      (selectedPlan.viewerRole === "partner" && selectedPlan.goal.partnerLocked));
  const partnerLocked =
    hasPlanSelected &&
    ((selectedPlan.viewerRole === "creator" && selectedPlan.goal.partnerLocked) ||
      (selectedPlan.viewerRole === "partner" && selectedPlan.goal.creatorLocked));
  const hasEnoughThemesToLock =
    hasPlanSelected && selectedPlan.goal.themes.length >= MIN_THEMES_TO_LOCK_GOAL;
  const hasEndDate = hasPlanSelected && typeof selectedPlan.goal.endDate === "number";
  const canEditEndDate = Boolean(selectedPlan?.canEditEndDate);
  const startDate = selectedPlan?.goal?.lockedAt
    ? formatDate(selectedPlan.goal.lockedAt)
    : null;
  const endDate = selectedPlan?.goal?.endDate
    ? formatDate(selectedPlan.goal.endDate)
    : null;

  return (
    <ThemedPage className="px-4 py-6">
      <div className="max-w-md mx-auto space-y-6 relative z-10">
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

        {/* Plan Switcher - show when user has plans */}
        {hasPlans && (
          <PlanSwitcher
            plans={allPlans}
            selectedId={selectedPlanId}
            onSelect={handleSelectPlan}
            onCreateNew={() => setShowCreationFlow(true)}
          />
        )}

        {/* Creation Flow - show when no plans OR user clicked + */}
        {(!hasPlans || showCreationFlow) && (
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
                Pick a partner, choose themes, and set a finish date for your shared plan
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

        {/* Selected Plan Display */}
        {selectedPlan && !showCreationFlow && (
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
                      {selectedPlan.creator?.nickname?.charAt(0).toUpperCase() ||
                        selectedPlan.creator?.email?.charAt(0).toUpperCase() ||
                        "?"}
                    </div>
                    <p
                      className="text-xs mt-1 max-w-[60px] truncate"
                      style={{ color: colors.text.muted }}
                    >
                      {selectedPlan.creator?.nickname || selectedPlan.creator?.email?.split("@")[0]}
                    </p>
                    {selectedPlan.goal.creatorLocked && (
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
                        : "Planning Phase"}
                  </p>
                  <p className="text-xs" style={{ color: colors.text.muted }}>
                    {formatGoalStatus(selectedPlan.effectiveStatus)}
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
                      {selectedPlan.partner?.nickname?.charAt(0).toUpperCase() ||
                        selectedPlan.partner?.email?.charAt(0).toUpperCase() ||
                        "?"}
                    </div>
                    <p
                      className="text-xs mt-1 max-w-[60px] truncate"
                      style={{ color: colors.text.muted }}
                    >
                      {selectedPlan.partner?.nickname || selectedPlan.partner?.email?.split("@")[0]}
                    </p>
                    {selectedPlan.goal.partnerLocked && (
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
                borderColor: colors.primary.dark,
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
                    Pick an end date. The mini boss checkpoint is calculated automatically.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Midpoint
                  </p>
                  <p className="text-sm font-semibold" style={{ color: colors.text.DEFAULT }}>
                    {selectedPlan.midpointAt
                      ? `${isEditing ? "~" : ""}${formatDate(selectedPlan.midpointAt)}`
                      : "Pick an end date"}
                  </p>
                </div>
              </div>

              <div>
                <label>
                  <span className="sr-only">End date</span>
                  <input
                    type="date"
                    value={endDateInput}
                    onChange={(event) => {
                      const value = event.target.value;
                      setEndDateInput(value);
                      if (value && value !== formatDateInputValue(selectedPlan.goal.endDate)) {
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

              {!canEditEndDate && (
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  {isExpired
                    ? "This goal has expired. It will stay visible for the 48-hour grace window."
                    : "This end date is now read-only."}
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
                    Shared themes: {selectedPlan.completedThemeCount}/{selectedPlan.goal.themes.length}
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
                    if (selectedPlan.miniBossStatus === "available") {
                      router.push(`/boss/${selectedPlan.goal._id}/mini`);
                    }
                  }}
                  disabled={isBossButtonDisabled(selectedPlan.miniBossStatus)}
                  className="flex-1 rounded-xl border-2 px-3 py-2 text-left transition-all disabled:opacity-60"
                  style={getBossButtonStyle(selectedPlan.miniBossStatus)}
                  data-testid="goals-mini-boss-trigger"
                >
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Mini Boss
                  </p>
                  <p className="font-semibold" style={{ color: colors.text.DEFAULT }}>
                    {formatBossStatus(selectedPlan.miniBossStatus)}
                  </p>
                </button>
                <button
                  onClick={() => {
                    if (selectedPlan.bossStatus === "available") {
                      router.push(`/boss/${selectedPlan.goal._id}/big`);
                    }
                  }}
                  disabled={isBossButtonDisabled(selectedPlan.bossStatus)}
                  className="flex-1 rounded-xl border-2 px-3 py-2 text-left transition-all disabled:opacity-60"
                  style={getBossButtonStyle(selectedPlan.bossStatus)}
                  data-testid="goals-big-boss-trigger"
                >
                  <p className="text-xs uppercase tracking-wide" style={{ color: colors.text.muted }}>
                    Big Boss
                  </p>
                  <p className="font-semibold" style={{ color: colors.text.DEFAULT }}>
                    {formatBossStatus(selectedPlan.bossStatus)}
                  </p>
                </button>
              </div>
              {!isEditing && selectedPlan.miniBossStatus === "locked" && (
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  Mini boss unlocks at the midpoint{selectedPlan.midpointAt ? ` (${formatDate(selectedPlan.midpointAt)})` : ""} or when {getMiniBossUnlockThreshold(selectedPlan.goal.themes.length)} theme{getMiniBossUnlockThreshold(selectedPlan.goal.themes.length) === 1 ? " is" : "s are"} done.
                </p>
              )}
              {!isEditing && selectedPlan.miniBossStatus !== "locked" && selectedPlan.bossStatus === "locked" && (
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  {selectedPlan.miniBossStatus === "available"
                    ? "Tap Mini Boss to start! Complete it to unlock the big boss."
                    : "Complete all themes to unlock the big boss."}
                </p>
              )}
              {isEditing && (
                <p className="text-xs" style={{ color: colors.text.muted }}>
                  Lock the goal with at least {MIN_THEMES_TO_LOCK_GOAL} themes and an end date to start boss tracking.
                </p>
              )}
            </section>

            {/* Theme List */}
            <GoalThemeList
              themes={selectedPlan.goal.themes}
              viewerRole={selectedPlan.viewerRole}
              isEditing={isEditing}
              canToggle={isActive}
              onToggle={handleToggleCompletion}
              onRemove={handleRemoveTheme}
            />

            {/* Add Theme Button (only in editing mode and under 5 themes) */}
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
                + Add Theme ({selectedPlan.goal.themes.length}/{MAX_THEMES_PER_GOAL})
              </button>
            )}

            {/* Theme count at max */}
            {isEditing && selectedPlan.goal.themes.length >= MAX_THEMES_PER_GOAL && (
              <p
                className="text-center text-sm"
                style={{ color: colors.text.muted }}
              >
                Maximum themes reached ({MAX_THEMES_PER_GOAL}/{MAX_THEMES_PER_GOAL})
              </p>
            )}

            {/* Lock Button (only in editing mode, if user hasn't locked) */}
            {isEditing && !viewerLocked && (
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
            {selectedPlan && (
              <DeleteGoalButton onDelete={handleDelete} />
            )}

            {/* Waiting for partner to lock */}
            {isEditing && viewerLocked && !partnerLocked && (
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

            {isExpired && (
              <div
                className="text-center py-4 rounded-xl border-2"
                style={{
                  backgroundColor: colors.background.DEFAULT,
                  borderColor: colors.status.warning.DEFAULT,
                }}
              >
                <p style={{ color: colors.text.DEFAULT }}>
                  This goal expired before the big boss was defeated.
                </p>
                <p className="text-xs mt-1" style={{ color: colors.text.muted }}>
                  It will be removed automatically after the 48-hour grace window.
                </p>
              </div>
            )}
          </>
        )}

        {/* Theme Selector Modal */}
        {showThemeSelector && selectedPlan?.goal && (
          <GoalThemeSelector
            goalId={selectedPlan.goal._id}
            currentThemeCount={selectedPlan.goal.themes.length}
            onSelect={handleAddThemes}
            onClose={() => setShowThemeSelector(false)}
          />
        )}

        {/* Back Button */}
        <BackButton onClick={() => router.push("/")} label="Back to Menu" dataTestId="goals-back-menu" />
      </div>
    </ThemedPage>
  );
}
