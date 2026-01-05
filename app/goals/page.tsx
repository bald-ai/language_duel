"use client";

import { useState, useEffect, useCallback } from "react";
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

  // Queries
  const friends = useQuery(api.friends.getFriends);
  const fetchActiveGoal = useMutation(api.weeklyGoals.getActiveGoal);
  type GoalData = Awaited<ReturnType<typeof fetchActiveGoal>>;
  const [goalData, setGoalData] = useState<GoalData | undefined>(undefined);

  // Mutations
  const createGoal = useMutation(api.weeklyGoals.createGoal);
  const addTheme = useMutation(api.weeklyGoals.addTheme);
  const removeTheme = useMutation(api.weeklyGoals.removeTheme);
  const toggleCompletion = useMutation(api.weeklyGoals.toggleCompletion);
  const lockGoal = useMutation(api.weeklyGoals.lockGoal);
  const completeGoal = useMutation(api.weeklyGoals.completeGoal);
  const cleanupExpired = useMutation(api.weeklyGoals.cleanupExpiredGoal);

  const refreshGoalData = useCallback(async () => {
    try {
      const data = await fetchActiveGoal();
      setGoalData(data);
    } catch (error) {
      setGoalData(null);
      toast.error(error instanceof Error ? error.message : "Failed to load goal");
    }
  }, [fetchActiveGoal]);

  useEffect(() => {
    void refreshGoalData();
  }, [refreshGoalData]);

  // Check for expired goal and clean up
  useEffect(() => {
    if (goalData?.goal?.expiresAt && goalData.goal.expiresAt < Date.now()) {
      const cleanup = async () => {
        await cleanupExpired({ goalId: goalData.goal._id });
        await refreshGoalData();
      };
      void cleanup();
    }
  }, [goalData, cleanupExpired, refreshGoalData]);

  // Handlers
  const handleCreateGoal = async () => {
    if (!selectedPartnerId) return;
    setIsCreating(true);
    try {
      await createGoal({ partnerId: selectedPartnerId });
      await refreshGoalData();
      toast.success("Goal created! Add themes to get started.");
      setSelectedPartnerId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create goal");
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddThemes = async (themeIds: Id<"themes">[]) => {
    if (!goalData?.goal) return;
    try {
      const remainingSlots = Math.max(0, 5 - goalData.goal.themes.length);
      const existingThemeIds = new Set(
        goalData.goal.themes.map((theme) => theme.themeId)
      );
      const addedThemeIds = new Set<Id<"themes">>();
      let addedCount = 0;

      for (const themeId of themeIds) {
        if (addedCount >= remainingSlots) break;
        if (existingThemeIds.has(themeId) || addedThemeIds.has(themeId)) continue;

        await addTheme({ goalId: goalData.goal._id, themeId });
        addedThemeIds.add(themeId);
        addedCount += 1;
      }
      setShowThemeSelector(false);
      await refreshGoalData();
      toast.success(`Added ${addedCount} theme${addedCount === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add themes");
    }
  };

  const handleRemoveTheme = async (themeId: Id<"themes">) => {
    if (!goalData?.goal) return;
    try {
      await removeTheme({ goalId: goalData.goal._id, themeId });
      await refreshGoalData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove theme");
    }
  };

  const handleToggleCompletion = async (themeId: Id<"themes">) => {
    if (!goalData?.goal) return;
    try {
      await toggleCompletion({ goalId: goalData.goal._id, themeId });
      await refreshGoalData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  };

  const handleLock = async () => {
    if (!goalData?.goal) return;
    try {
      await lockGoal({ goalId: goalData.goal._id });
      await refreshGoalData();
      toast.success("Goal locked!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to lock goal");
    }
  };

  const handleComplete = async () => {
    if (!goalData?.goal) return;
    try {
      await completeGoal({ goalId: goalData.goal._id });
      await refreshGoalData();
      toast.success("Goal completed! Create a new one.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to complete goal");
    }
  };

  // Loading state
  if (goalData === undefined || friends === undefined) {
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

  // Check if all themes are completed by both users
  const allCompleted =
    goalData?.goal &&
    goalData.goal.themes.length > 0 &&
    goalData.goal.themes.every((t) => t.creatorCompleted && t.partnerCompleted);

  // Determine current state
  const hasGoal = goalData !== null;
  const isEditing = hasGoal && goalData.goal.status === "editing";
  const isActive = hasGoal && goalData.goal.status === "active";
  const canAddThemes = isEditing && goalData.goal.themes.length < 5;
  const viewerLocked = hasGoal && (
    (goalData.viewerRole === "creator" && goalData.goal.creatorLocked) ||
    (goalData.viewerRole === "partner" && goalData.goal.partnerLocked)
  );
  const partnerLocked = hasGoal && (
    (goalData.viewerRole === "creator" && goalData.goal.partnerLocked) ||
    (goalData.viewerRole === "partner" && goalData.goal.creatorLocked)
  );

  // Date range display
  const startDate = goalData?.goal?.lockedAt
    ? formatDate(goalData.goal.lockedAt)
    : formatDate(Date.now());
  const endDate = goalData?.goal?.expiresAt
    ? formatDate(goalData.goal.expiresAt)
    : formatDate(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
            Weekly Goal
          </h1>
        </header>

        {/* No Goal - Creation Flow */}
        {!hasGoal && (
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

            <button
              onClick={handleCreateGoal}
              disabled={!selectedPartnerId || isCreating}
              className="w-full py-3 rounded-xl font-bold uppercase tracking-wider transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: colors.primary.DEFAULT,
                color: "white",
                textShadow: "0 2px 4px rgba(0,0,0,0.3)",
              }}
            >
              {isCreating ? "Creating..." : "Create Goal"}
            </button>
          </section>
        )}

        {/* Has Goal - Display */}
        {hasGoal && (
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
                      {goalData.creator?.nickname?.charAt(0).toUpperCase() ||
                        goalData.creator?.email?.charAt(0).toUpperCase() ||
                        "?"}
                    </div>
                    <p
                      className="text-xs mt-1 max-w-[60px] truncate"
                      style={{ color: colors.text.muted }}
                    >
                      {goalData.creator?.nickname || goalData.creator?.email?.split("@")[0]}
                    </p>
                    {goalData.goal.creatorLocked && (
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
                    {startDate} to {endDate}
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
                      {goalData.partner?.nickname?.charAt(0).toUpperCase() ||
                        goalData.partner?.email?.charAt(0).toUpperCase() ||
                        "?"}
                    </div>
                    <p
                      className="text-xs mt-1 max-w-[60px] truncate"
                      style={{ color: colors.text.muted }}
                    >
                      {goalData.partner?.nickname || goalData.partner?.email?.split("@")[0]}
                    </p>
                    {goalData.goal.partnerLocked && (
                      <span style={{ color: colors.status.success.DEFAULT }}>✓</span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Theme List */}
            <GoalThemeList
              themes={goalData.goal.themes}
              viewerRole={goalData.viewerRole}
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
                + Add Theme ({goalData.goal.themes.length}/5)
              </button>
            )}

            {/* Theme count at max */}
            {isEditing && goalData.goal.themes.length >= 5 && (
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
        {showThemeSelector && goalData?.goal && (
          <GoalThemeSelector
            goalId={goalData.goal._id}
            currentThemeCount={goalData.goal.themes.length}
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
