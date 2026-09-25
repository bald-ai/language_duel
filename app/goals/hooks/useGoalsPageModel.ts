"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCountdown } from "@/app/goals/hooks/useCountdown";
import { buildSoloUrl, type SoloMode } from "@/lib/soloNavigation";
import { getErrorMessage } from "@/lib/errors";
import {
  areAllThemesCompleted,
  canToggleGoalThemeCompletion,
  formatGoalCountdown,
  getGoalDeleteAt,
  getGoalDraftExpiresAt,
  getWeeklyGoalLockFlags,
} from "@/lib/weeklyGoals";
import { formatVisibleUser } from "@/lib/userDisplay";
import { formatDateInputValue } from "@/lib/displayFormat";
import { toast } from "sonner";
import { MAX_THEMES_PER_GOAL, MIN_THEMES_TO_LOCK_GOAL } from "../constants";
import { formatBossStatus } from "../bossUi";
import { useGoalsController } from "./useGoalsController";

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toLocalEndOfDayTimestamp(dateValue: string): number | null {
  if (!dateValue) return null;

  const [year, month, day] = dateValue.split("-").map(Number);
  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null;
  }

  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
}

type SelectedGoal = FunctionReturnType<typeof api.weeklyGoals.getGoalById> | undefined;

function getGoalStatusPresentation(selectedGoal: SelectedGoal) {
  const effectiveStatus = selectedGoal?.effectiveStatus;
  return {
    isDraft: effectiveStatus === "draft",
    isGracePeriod: effectiveStatus === "grace_period",
    canEditEndDate: Boolean(selectedGoal?.canEditEndDate),
    canToggleThemeCompletion: canToggleGoalThemeCompletion({ effectiveStatus }),
    ...getWeeklyGoalLockFlags(selectedGoal?.lockState ?? "none"),
  };
}

function getGoalThemePermissions(selectedGoal: SelectedGoal) {
  if (!selectedGoal) return { canAddThemes: false, hasEnoughThemesToLock: false, hasEndDate: false };
  return {
    canAddThemes: selectedGoal.effectiveStatus === "draft" && selectedGoal.goal.themes.length < MAX_THEMES_PER_GOAL,
    hasEnoughThemesToLock: selectedGoal.goal.themes.length >= MIN_THEMES_TO_LOCK_GOAL,
    hasEndDate: typeof selectedGoal.goal.endDate === "number",
  };
}

function getGoalBossPresentation(selectedGoal: SelectedGoal) {
  if (!selectedGoal) return { allSelectedThemesCompleted: false, miniBossDisplayStatus: "unavailable" as const, miniBossLabel: "" };
  const allSelectedThemesCompleted = areAllThemesCompleted(selectedGoal.goal.themes, selectedGoal.mode);
  return {
    allSelectedThemesCompleted,
    miniBossDisplayStatus: allSelectedThemesCompleted ? "unavailable" as const : selectedGoal.miniBossStatus ?? "unavailable",
    miniBossLabel: allSelectedThemesCompleted ? "All themes completed - Do big boss!" : formatBossStatus(selectedGoal.miniBossStatus),
  };
}

function getGoalDatePresentation(selectedGoal: SelectedGoal) {
  if (!selectedGoal) return { startDate: null, endDate: null };
  return {
    startDate: selectedGoal.goal.lockedAt ? formatDate(selectedGoal.goal.lockedAt) : null,
    endDate: selectedGoal.goal.endDate ? formatDate(selectedGoal.goal.endDate) : null,
  };
}

function useGoalDeadlines(selectedGoal: SelectedGoal) {
  const deleteAt = getGoalDeleteAt(selectedGoal?.goal.endDate);
  const graceCountdown = useCountdown(deleteAt ?? 0);
  const draftExpiresAt = getGoalDraftExpiresAt(selectedGoal?.goal.createdAt);
  const draftCountdown = useCountdown(draftExpiresAt ?? 0);
  return {
    deleteAt, draftExpiresAt,
    formattedGraceCountdown: formatGoalCountdown(graceCountdown.timeRemaining),
    formattedDraftCountdown: formatGoalCountdown(draftCountdown.timeRemaining),
  };
}

function useGoalEndDateInput(selectedGoal: SelectedGoal) {
  const [endDateInput, setEndDateInput] = useState(() => formatDateInputValue(selectedGoal?.goal.endDate));
  const endDate = selectedGoal?.goal.endDate;
  const goalId = selectedGoal?.goal._id;
  const [previousSource, setPreviousSource] = useState({ endDate, goalId });
  if (previousSource.endDate !== endDate || previousSource.goalId !== goalId) {
    setPreviousSource({ endDate, goalId });
    setEndDateInput(formatDateInputValue(endDate));
  }
  return { endDateInput, setEndDateInput };
}

function selectThemesToAdd(goal: NonNullable<SelectedGoal>["goal"], themeIds: Id<"themes">[]) {
  const remainingSlots = Math.max(0, MAX_THEMES_PER_GOAL - goal.themes.length);
  const existingThemeIds = new Set(goal.themes.map(theme => theme.themeId));
  const addedThemeIds = new Set<Id<"themes">>();
  for (const themeId of themeIds) {
    if (addedThemeIds.size >= remainingSlots) break;
    if (existingThemeIds.has(themeId)) continue;
    addedThemeIds.add(themeId);
  }
  return [...addedThemeIds];
}

export function useGoalsPageModel() {
  const router = useRouter();
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  const [showPracticeModal, setShowPracticeModal] = useState(false);
  const [creationMode, setCreationMode] = useState<"solo" | "shared">("solo");
  const [selectedPartnerId, setSelectedPartnerId] = useState<Id<"users"> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingEndDate, setIsSavingEndDate] = useState(false);

  const friends = useQuery(api.friends.getFriends);
  const allGoals = useQuery(api.weeklyGoals.getVisibleGoals);
  const {
    selectedGoalId,
    initialLoadDone,
    showCreationFlow,
    selectGoal,
    showCreateGoal,
    hideCreateGoal,
    selectCreatedGoal,
    clearSelectedGoal,
  } = useGoalsController(allGoals);
  const selectedGoal = useQuery(
    api.weeklyGoals.getGoalById,
    selectedGoalId ? { goalId: selectedGoalId } : "skip"
  );
  const weeklyGoalPracticeThemes = useQuery(
    api.weeklyGoals.getWeeklyGoalPracticeThemes,
    showPracticeModal && selectedGoalId ? { weeklyGoalId: selectedGoalId } : "skip"
  );

  const createSoloGoal = useMutation(api.weeklyGoals.createSoloGoal);
  const createSharedGoal = useMutation(api.weeklyGoals.createSharedGoal);
  const addTheme = useMutation(api.weeklyGoals.addTheme);
  const removeTheme = useMutation(api.weeklyGoals.removeTheme);
  const toggleCompletion = useMutation(api.weeklyGoals.toggleCompletion);
  const lockGoal = useMutation(api.weeklyGoals.lockGoal);
  const deleteGoal = useMutation(api.weeklyGoals.deleteGoal);
  const setGoalEndDate = useMutation(api.weeklyGoals.setGoalEndDate);

  const { endDateInput, setEndDateInput } = useGoalEndDateInput(selectedGoal);

  useEffect(() => {
    if (!allGoals || allGoals.length === 0 || !initialLoadDone) return;

    const goalExists = selectedGoalId && allGoals.some((goal) => goal.goal._id === selectedGoalId);
    if (selectedGoal === null && !goalExists) {
      selectGoal(allGoals[0].goal._id);
    }
  }, [allGoals, selectedGoal, selectedGoalId, initialLoadDone, selectGoal]);

  const { deleteAt, draftExpiresAt, formattedGraceCountdown, formattedDraftCountdown } = useGoalDeadlines(selectedGoal);

  const handleCreateGoal = async () => {
    if (creationMode === "shared" && !selectedPartnerId) return;
    setIsCreating(true);
    try {
      const newGoalId = creationMode === "solo"
        ? await createSoloGoal({})
        : await createSharedGoal({ partnerId: selectedPartnerId! });
      toast.success("Goal created! Add themes to get started.");
      setSelectedPartnerId(null);
      setCreationMode("solo");
      selectCreatedGoal(newGoalId);
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to create goal"));
    } finally {
      setIsCreating(false);
    }
  };

  const handleAddThemes = async (themeIds: Id<"themes">[]) => {
    if (!selectedGoal?.goal) return;
    try {
      const addPromises = selectThemesToAdd(selectedGoal.goal, themeIds).map(themeId =>
        addTheme({ goalId: selectedGoal.goal._id, themeId })
      );
      const results = addPromises.length > 0 ? await Promise.allSettled(addPromises) : [];
      const fulfilledCount = results.filter((result) => result.status === "fulfilled").length;
      setShowThemeSelector(false);
      if (fulfilledCount > 0) {
        toast.success(`Added ${fulfilledCount} theme${fulfilledCount === 1 ? "" : "s"}`);
      } else {
        toast.error("Failed to add themes");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to add themes"));
    }
  };

  const handleRemoveTheme = async (themeId: Id<"themes">) => {
    if (!selectedGoal?.goal) return;

    const { goal, viewerRole, creator, partner, lockState } = selectedGoal;
    const partnerName =
      viewerRole === "creator"
        ? formatVisibleUser(partner, "Your partner")
        : formatVisibleUser(creator, "Your partner");

    try {
      await removeTheme({ goalId: goal._id, themeId });
      if (lockState === "viewer_locked" || lockState === "both_locked") {
        toast.success("You removed a theme, so your lock was cleared.");
      } else if (lockState === "partner_locked") {
        toast.success(`You removed a theme, so ${partnerName}'s lock was cleared.`);
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to remove theme"));
    }
  };

  const handleToggleCompletion = async (themeId: Id<"themes">) => {
    if (!selectedGoal?.goal) return;
    try {
      await toggleCompletion({ goalId: selectedGoal.goal._id, themeId });
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to update"));
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
      toast.error(getErrorMessage(error, "Failed to lock goal"));
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
      clearSelectedGoal();
      toast.success("Goal deleted");
    } catch (error) {
      toast.error(getErrorMessage(error, "Failed to delete goal"));
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
      toast.error(getErrorMessage(error, "Failed to save end date"));
    } finally {
      setIsSavingEndDate(false);
    }
  };

  if (allGoals === undefined || friends === undefined) {
    return { isLoading: true as const };
  }

  const existingPartnerIds = new Set(
    allGoals
      .filter((goalWithUsers) => goalWithUsers.mode === "shared")
      .flatMap((goalWithUsers) => [
        goalWithUsers.partner?._id,
        goalWithUsers.creator?._id,
      ].filter(Boolean))
  );
  const availableFriends = friends.filter((friend) => !existingPartnerIds.has(friend.friendId));

  const hasGoals = allGoals.length > 0;
  const { isDraft, isGracePeriod, canEditEndDate, canToggleThemeCompletion, viewerLocked, partnerLocked } = getGoalStatusPresentation(selectedGoal);
  const { canAddThemes, hasEnoughThemesToLock, hasEndDate } = getGoalThemePermissions(selectedGoal);
  const canPracticeGoalThemes = hasEnoughThemesToLock;
  const { allSelectedThemesCompleted, miniBossDisplayStatus, miniBossLabel } = getGoalBossPresentation(selectedGoal);
  const { startDate, endDate } = getGoalDatePresentation(selectedGoal);

  return {
    isLoading: false as const,
    allGoals,
    allSelectedThemesCompleted,
    availableFriends,
    canAddThemes,
    canEditEndDate,
    canPracticeGoalThemes,
    canToggleThemeCompletion,
    creationMode,
    deleteAt,
    draftExpiresAt,
    endDate,
    endDateInput,
    formattedDraftCountdown,
    formattedGraceCountdown,
    handleAddThemes,
    handleContinuePractice,
    handleCreateGoal,
    handleDelete,
    handleLock,
    handlePracticeGoalThemes,
    handleRemoveTheme,
    handleSaveEndDate,
    handleToggleCompletion,
    hasEndDate,
    hasEnoughThemesToLock,
    hasGoals,
    hideCreateGoal,
    isCreating,
    isDraft,
    isGracePeriod,
    isSavingEndDate,
    miniBossDisplayStatus,
    miniBossLabel,
    partnerLocked,
    selectedGoal,
    selectedGoalId,
    selectedPartnerId,
    selectGoal,
    setCreationMode: (mode: "solo" | "shared") => {
      setCreationMode(mode);
      if (mode === "solo") {
        setSelectedPartnerId(null);
      }
    },
    setEndDateInput,
    setSelectedPartnerId,
    setShowPracticeModal,
    setShowThemeSelector,
    showCreateGoal,
    showCreationFlow,
    showPracticeModal,
    showThemeSelector,
    startDate,
    viewerLocked,
    weeklyGoalPracticeThemes,
  };
}
