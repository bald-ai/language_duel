"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAppearanceColors } from "@/app/components/AppearanceProvider";
import { ThemedPage } from "@/app/components/ThemedPage";
import { BackButton } from "@/app/components/BackButton";
import { GoalThemeList } from "./GoalThemeList";
import { LockButton } from "./LockButton";
import { DeleteGoalButton } from "./DeleteGoalButton";
import { GoalSwitcher } from "./GoalSwitcher";
import { GoalBossProgressPanel } from "./GoalBossProgressPanel";
import { GoalCreationPanel } from "./GoalCreationPanel";
import { GoalParticipantsPanel } from "./GoalParticipantsPanel";
import { GoalPracticeModalHost } from "./GoalPracticeModalHost";
import { GoalPracticePanel } from "./GoalPracticePanel";
import { GoalTimingPanel } from "./GoalTimingPanel";
import { MAX_THEMES_PER_GOAL, MIN_THEMES_TO_LOCK_GOAL } from "../constants";
import { useGoalsPageModel } from "../hooks/useGoalsPageModel";

const GoalThemeSelector = dynamic(
  () => import("./GoalThemeSelector").then((mod) => mod.GoalThemeSelector),
  { loading: () => null }
);

export function GoalsPageContent() {
  const colors = useAppearanceColors();
  const router = useRouter();
  const model = useGoalsPageModel();

  if (model.isLoading) {
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

  const {
    allGoals,
    allSelectedThemesCompleted,
    availableFriends,
    canAddThemes,
    canEditEndDate,
    canPracticeGoalThemes,
    canToggleThemeCompletion,
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
  } = model;

  return (
    <ThemedPage className="px-4 py-6">
      <div className="w-full max-w-[29rem] mx-auto space-y-6 relative z-10">
        <header className="relative flex items-center mb-8">
          <button
            onClick={() => router.push("/")}
            className="absolute left-0 p-2 rounded-lg border-2 transition-colors hover:opacity-80"
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
            className="w-full text-center text-2xl font-bold uppercase tracking-wide"
            style={{ color: colors.text.DEFAULT }}
          >
            Weekly Goals
          </h1>
        </header>

        {hasGoals && (
          <GoalSwitcher
            goals={allGoals}
            selectedId={selectedGoalId}
            onSelect={selectGoal}
            onCreateNew={showCreateGoal}
          />
        )}

        {(!hasGoals || showCreationFlow) && (
          <GoalCreationPanel
            availableFriends={availableFriends}
            selectedPartnerId={selectedPartnerId}
            isCreating={isCreating}
            showCancel={showCreationFlow}
            onPartnerSelect={setSelectedPartnerId}
            onCancel={hideCreateGoal}
            onCreate={handleCreateGoal}
          />
        )}

        {selectedGoal && !showCreationFlow && (
          <>
            <GoalParticipantsPanel
              selectedGoal={selectedGoal}
              startDate={startDate}
              endDate={endDate}
            />

            <GoalTimingPanel
              selectedGoal={selectedGoal}
              isDraft={isDraft}
              isGracePeriod={isGracePeriod}
              canEditEndDate={canEditEndDate}
              isSavingEndDate={isSavingEndDate}
              deleteAt={deleteAt}
              draftExpiresAt={draftExpiresAt}
              endDateInput={endDateInput}
              formattedDraftCountdown={formattedDraftCountdown}
              formattedGraceCountdown={formattedGraceCountdown}
              onEndDateInputChange={setEndDateInput}
              onSaveEndDate={handleSaveEndDate}
            />

            <GoalBossProgressPanel
              selectedGoal={selectedGoal}
              isDraft={isDraft}
              allSelectedThemesCompleted={allSelectedThemesCompleted}
              miniBossDisplayStatus={miniBossDisplayStatus}
              miniBossLabel={miniBossLabel}
              onStartMiniBoss={() => {
                if (!allSelectedThemesCompleted && selectedGoal.miniBossStatus === "ready") {
                  router.push(`/boss/${selectedGoal.goal._id}/mini`);
                }
              }}
              onStartBigBoss={() => {
                if (selectedGoal.bigBossStatus === "ready") {
                  router.push(`/boss/${selectedGoal.goal._id}/big`);
                }
              }}
            />

            <GoalPracticePanel
              canPracticeGoalThemes={canPracticeGoalThemes}
              onPractice={handlePracticeGoalThemes}
            />

            <GoalThemeList
              themes={selectedGoal.goal.themes}
              viewerRole={selectedGoal.viewerRole}
              isEditing={isDraft}
              canToggle={canToggleThemeCompletion}
              onToggle={handleToggleCompletion}
              onRemove={handleRemoveTheme}
            />

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

            {isDraft && selectedGoal.goal.themes.length >= MAX_THEMES_PER_GOAL && (
              <p
                className="text-center text-sm"
                style={{ color: colors.text.muted }}
              >
                Maximum themes reached ({MAX_THEMES_PER_GOAL}/{MAX_THEMES_PER_GOAL})
              </p>
            )}

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

            <DeleteGoalButton onDelete={handleDelete} />

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

        {showThemeSelector && selectedGoal?.goal && (
          <GoalThemeSelector
            goalId={selectedGoal.goal._id}
            currentThemeCount={selectedGoal.goal.themes.length}
            onSelect={handleAddThemes}
            onClose={() => setShowThemeSelector(false)}
          />
        )}

        {showPracticeModal && selectedGoal?.goal && (
          <GoalPracticeModalHost
            goalId={selectedGoal.goal._id}
            weeklyGoalPracticeThemes={weeklyGoalPracticeThemes}
            onContinue={handleContinuePractice}
            onClose={() => setShowPracticeModal(false)}
          />
        )}

        <BackButton onClick={() => router.push("/")} label="Back to Menu" dataTestId="goals-back-menu" />
      </div>
    </ThemedPage>
  );
}
