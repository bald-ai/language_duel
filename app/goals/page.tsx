"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { colors } from "@/lib/theme";
import { toast } from "sonner";
import { ThemedPage } from "@/app/components/ThemedPage";
import { PartnerSelector } from "./components/PartnerSelector";
import { GoalThemeList } from "./components/GoalThemeList";
import { GoalThemeSelector } from "./components/GoalThemeSelector";
import { LockButton } from "./components/LockButton";
import { DeleteGoalButton } from "./components/DeleteGoalButton";
import { PlanSwitcher } from "./components/PlanSwitcher";

// Local storage key for remembering last viewed plan
const LAST_PLAN_KEY = "language_duel_last_weekly_plan";

// Format date as "Jan 4"
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function GoalsPage() {
  const router = useRouter();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<Id<"users"> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreationFlow, setShowCreationFlow] = useState(false);

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
  const completeGoal = useMutation(api.weeklyGoals.completeGoal);
  const deleteGoal = useMutation(api.weeklyGoals.deleteGoal);
  const purgeExpiredGoals = useMutation(api.weeklyGoals.purgeExpiredGoalsForUser);

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
      const remainingSlots = Math.max(0, 5 - selectedPlan.goal.themes.length);
      const existingThemeIds = new Set(
        selectedPlan.goal.themes.map((theme) => theme.themeId)
      );
      const addedThemeIds = new Set<Id<"themes">>();
      let addedCount = 0;

      for (const themeId of themeIds) {
        if (addedCount >= remainingSlots) break;
        if (existingThemeIds.has(themeId) || addedThemeIds.has(themeId)) continue;

        await addTheme({ goalId: selectedPlan.goal._id, themeId });
        addedThemeIds.add(themeId);
        addedCount += 1;
      }
      setShowThemeSelector(false);
      // Query will auto-refresh
      toast.success(`Added ${addedCount} theme${addedCount === 1 ? "" : "s"}`);
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
    try {
      await lockGoal({ goalId: selectedPlan.goal._id });
      // Query will auto-refresh
      toast.success("Goal locked!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to lock goal");
    }
  };

  const handleComplete = async () => {
    if (!selectedPlan?.goal) return;
    try {
      await completeGoal({ goalId: selectedPlan.goal._id });
      setSelectedPlanId(null);
      // Query will auto-refresh
      toast.success("Goal completed! Create a new one.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete goal");
    }
  };

  const handleDelete = async () => {
    if (!selectedPlan?.goal) return;
    try {
      await deleteGoal({ goalId: selectedPlan.goal._id });
      setSelectedPlanId(null);
      // Query will auto-refresh
      toast.success("Goal cancelled");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete goal");
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

  // Determine current state
  const hasPlans = allPlans.length > 0;
  const hasPlanSelected = selectedPlan != null; // handles both null and undefined
  const isEditing = hasPlanSelected && selectedPlan.goal.status === "editing";
  const isActive = hasPlanSelected && selectedPlan.goal.status === "active";
  const canAddThemes = isEditing && hasPlanSelected && selectedPlan.goal.themes.length < 5;
  const viewerLocked = hasPlanSelected && (
    (selectedPlan.viewerRole === "creator" && selectedPlan.goal.creatorLocked) ||
    (selectedPlan.viewerRole === "partner" && selectedPlan.goal.partnerLocked)
  );
  const partnerLocked = hasPlanSelected && (
    (selectedPlan.viewerRole === "creator" && selectedPlan.goal.partnerLocked) ||
    (selectedPlan.viewerRole === "partner" && selectedPlan.goal.creatorLocked)
  );

  // Check if all themes are completed by both users
  const allCompleted =
    hasPlanSelected &&
    selectedPlan.goal.themes.length > 0 &&
    selectedPlan.goal.themes.every((t) => t.creatorCompleted && t.partnerCompleted);

  // Date range display - only show for active goals with real dates
  const startDate = selectedPlan?.goal?.lockedAt ? formatDate(selectedPlan.goal.lockedAt) : null;
  const endDate = selectedPlan?.goal?.expiresAt ? formatDate(selectedPlan.goal.expiresAt) : null;

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
                Pick a partner and select themes to practice together for a week
              </p>
            </div>

            <PartnerSelector
              friends={friends}
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
                    {startDate && endDate ? `${startDate} to ${endDate}` : "Planning Phase"}
                  </p>
                  <p className="text-xs" style={{ color: colors.text.muted }}>
                    {isEditing ? "Not started yet" : "Active"}
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

            {/* Theme List */}
            <GoalThemeList
              themes={selectedPlan.goal.themes}
              viewerRole={selectedPlan.viewerRole}
              isEditing={isEditing}
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
              >
                + Add Theme ({selectedPlan.goal.themes.length}/5)
              </button>
            )}

            {/* Theme count at max */}
            {isEditing && selectedPlan.goal.themes.length >= 5 && (
              <p
                className="text-center text-sm"
                style={{ color: colors.text.muted }}
              >
                Maximum themes reached (5/5)
              </p>
            )}

            {/* Lock Button (only in editing mode, if user hasn't locked) */}
            {isEditing && !viewerLocked && (
              <LockButton
                partnerLocked={partnerLocked}
                onLock={handleLock}
              />
            )}

            {/* Delete Button (only in editing mode, if user hasn't locked) */}
            {isEditing && !viewerLocked && (
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

            {/* Complete Goal Button (when all checked or expired) */}
            {isActive && allCompleted && (
              <button
                onClick={handleComplete}
                className="w-full py-3 rounded-xl font-bold uppercase tracking-wider transition-colors"
                style={{
                  backgroundColor: colors.primary.DEFAULT,
                  color: "white",
                  textShadow: "0 2px 4px rgba(0,0,0,0.3)",
                }}
              >
                Complete Goal
              </button>
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
        <button
          onClick={() => router.push("/")}
          className="w-full py-4 rounded-2xl text-xl font-bold uppercase tracking-wide transition-colors border-2"
          style={{
            backgroundColor: colors.background.elevated,
            borderColor: colors.primary.dark,
            color: colors.text.DEFAULT,
          }}
        >
          Back to Menu
        </button>
      </div>
    </ThemedPage>
  );
}
