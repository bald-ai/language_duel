"""Sequential source mutations with restoration and assertion-level evidence."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

CASES = [
    ('sentence-clean-row-state', 'app/themes/components/SentenceThemeDetail.tsx', 'englishHasIssue: false,', 'englishHasIssue: true,', 'tests/components/SentenceThemeDetail.test.tsx'),
    ('relay-round-header-role', 'app/duel/[duelId]/components/RelayDuelView.tsx', '{amAnswerer ? `from ${theirName}` : `to ${theirName}`}', '{amAnswerer ? `to ${theirName}` : `from ${theirName}`}', 'tests/components/RelayDuelView.test.tsx'),
    ('retention-dismiss-participants', 'convex/weeklyGoals/cleanup.ts', 'const participantIds = [...new Set(goals.flatMap(getGoalParticipantIds))];', 'const participantIds: Id<"users">[] = [];', 'tests/convex/weeklyGoals.retention.test.ts'),

    ('repetition-unavailable-launch', 'app/repetition/components/RepetitionReadyCard.tsx', 'disabled={!item.canStart}\n            className="rounded-xl border-2 px-3 py-2 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"\n            style={{\n              backgroundColor: colors.cta.DEFAULT,', 'disabled={false}\n            className="rounded-xl border-2 px-3 py-2 text-sm font-bold uppercase tracking-wide transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"\n            style={{\n              backgroundColor: colors.cta.DEFAULT,', 'tests/components/RepetitionBoard.test.tsx'),
    ('word-trampoline-flight-scale', 'app/duel/[duelId]/components/DuelAnswerGrid.tsx', 'trampPos.phase === "flying" ?', 'trampPos.phase === "shaking" ?', 'tests/components/DuelAnswerGrid.test.tsx'),
    ('sentence-trampoline-flight-scale', 'app/duel/[duelId]/components/SentenceBuildBoard.tsx', 'pos.phase === "flying" ?', 'pos.phase === "shaking" ?', 'tests/components/SentenceBuildBoard.test.tsx'),
    ('guided-composition-entry', 'app/game/levels/Level1Input.tsx', 'if (nativeEvent.data) {', 'if (false) {', 'tests/components/Level1Input.test.tsx'),
    ('goal-theme-picker-open', 'app/goals/components/GoalsPageContent.tsx', '{showThemeSelector && selectedGoal?.goal && (', '{false && selectedGoal?.goal && (', 'tests/components/GoalsPageContent.test.tsx'),
    ('solo-mastery-final-level', 'lib/soloPracticeRuntime.ts', 'session.questionLevel >= currentItemState.maxLevel', 'session.questionLevel > currentItemState.maxLevel', 'tests/hooks/useSoloCompletionReporting.test.ts'),
    ('solo-completion-awaits-mastery', 'app/solo/[sessionId]/hooks/useSoloCompletionReporting.ts', 'masteryWritesPending > 0', 'false', 'tests/hooks/useSoloCompletionReporting.test.ts'),
    ('duel-timeout-reveal', 'app/duel/[duelId]/hooks/useDuelPhaseState.ts', 'isLocked || lockedAnswerRef.current || hasTimedOutRef.current;', 'isLocked || lockedAnswerRef.current;', 'tests/hooks/useDuelPhaseState.test.ts'),
    ('review-restores-original-order', 'app/themes/lib/pickAndPruneItems.ts', 'left.originalIndex - right.originalIndex', 'right.originalIndex - left.originalIndex', 'tests/hooks/usePickAndPrune.test.ts'),
    ('choice-correct-feedback', 'app/game/levels/Level2MultipleChoice.tsx', 'if (isCorrect) {', 'if (!isCorrect) {', 'tests/components/Level2MultipleChoice.test.tsx'),
    ('goal-removal-partner-name', 'app/goals/hooks/useGoalsPageModel.ts', 'viewerRole === "creator"\n        ? formatVisibleUser(partner', 'viewerRole === "partner"\n        ? formatVisibleUser(partner', 'tests/hooks/useGoalsPageModel.test.ts'),
    ('sentence-audio-requires-save', 'app/themes/hooks/useSentenceThemeController.ts', 'if (!selectedState || selectedState.kind === "unsaved") {\n      toast.error("Save the theme first before generating TTS");', 'if (false) {\n      toast.error("Save the theme first before generating TTS");', 'tests/hooks/useSentenceThemeController.test.tsx'),

    ('study-audio-busy-controls', 'app/solo/learn/[sessionId]/components/SoloLearnContent.tsx', 'playingWordIndex={playingWordIndex}', 'playingWordIndex={null}', 'tests/components/SoloLearnPage.test.tsx'),
    ('lobby-self-duel-dispatch', 'hooks/useChallengeLobby.ts', 'if (isSelfDuelSelection(viewer, options.opponentId)) {', 'if (false) {', 'tests/hooks/useChallengeLobby.test.ts'),
    ('challenge-decline-identity', 'hooks/challengeLobby/useChallengeActions.ts', 'await declineChallengeMutation({ challengeId });', 'await declineChallengeMutation({ challengeId: "wrong" as Id<"challenges"> });', 'tests/hooks/useChallengeLobby.test.ts'),

    ('sentence-review-batch-size', 'app/themes/hooks/useSentenceThemeController.ts', 'roundCount: safeTarget * 2,', 'roundCount: safeTarget,', 'tests/hooks/useSentenceThemeDrafts.test.ts'),
    ('sentence-permission-theme-identity', 'app/themes/hooks/useSentenceThemeController.ts', 'themeId: selectedState.theme._id,\n          visibility,', 'themeId: "wrong" as typeof selectedState.theme._id,\n          visibility,', 'tests/hooks/useSentenceThemeDrafts.test.ts'),
    ('sentence-generation-result-success', 'app/themes/lib/generationResult.ts', 'if (!result.success || !result.data) {', 'if (result.success || !result.data) {', 'tests/hooks/useSentenceThemeDrafts.test.ts'),

    ('theme-generation-review-count', 'app/themes/hooks/useThemeGenerator.ts', 'wordCount: PICK_AND_PRUNE_WORD_COUNT,', 'wordCount: 19,', 'tests/hooks/useThemeGenerator.test.ts'),
    ('solo-learn-duplicate-hint', 'app/solo/learn/[sessionId]/hooks/useSoloLearnState.ts', 'if (current.revealedPositions.includes(position)) return prev;', 'if (false) return prev;', 'tests/hooks/useSoloLearnState.test.ts'),
    ('weekly-invite-decline-action', 'app/notifications/components/NotificationCards.tsx', 'onClick={() => actions.declineWeeklyGoal(id)}', 'onClick={() => actions.dismissWeeklyGoal(id)}', 'tests/components/NotificationsTab.test.tsx'),
    ('solo-completed-display', 'app/solo/[sessionId]/page.tsx', 'const content = session.completed ? (', 'const content = false ? (', 'tests/components/SoloPracticePage.test.tsx'),

    ('cloze-reject-wrong-placement', 'lib/soloSentenceRuntime.ts', 'if (!expectedToken || !isSoloSentenceTokenMatch(chip.text, expectedToken)) {', 'if (false) {', 'tests/components/SentenceClozeQuestion.test.tsx'),
    ('cloze-keyboard-left-direction', 'app/solo/[sessionId]/hooks/useSentenceClozeKeyboard.ts', 'ArrowLeft: -1,', 'ArrowLeft: undefined,', 'tests/components/SentenceClozeQuestion.test.tsx'),
    ('cloze-recognition-once', 'app/solo/[sessionId]/components/SentenceClozeQuestion.tsx', 'const handleRecognitionGotIt = () => {\n    if (recognitionLocked) return;', 'const handleRecognitionGotIt = () => {\n    if (false) return;', 'tests/components/SentenceClozeQuestion.test.tsx'),
    ('lobby-opponent-remount', 'hooks/ChallengeLobbyModals.tsx', 'key={lobby.initialChallengeOpponentId ?? "challenge-modal"}', 'key="challenge-modal"', 'tests/components/ChallengeLobbyModals.test.tsx'),
    ('home-signed-out-guard', 'app/HomePageClient.tsx', 'if (!isSignedIn) {', 'if (false) {', 'tests/components/HomePageClient.test.tsx'),

    ('goal-theme-deselect', 'app/goals/components/GoalThemeSelector.tsx', 'next.delete(themeId);', 'next.add(themeId);', 'tests/components/GoalThemeSelector.test.tsx'),
    ('confidence-increment-direction', 'app/solo/learn/[sessionId]/components/ConfidenceSlider.tsx', 'useCallback(() => step(+1), [step])', 'useCallback(() => step(-1), [step])', 'tests/components/ConfidenceSlider.test.tsx'),
    ('nickname-rejected-value', 'app/settings/components/NicknameEditor.tsx', 'if (success) {', 'if (!success) {', 'tests/components/NicknameEditor.test.tsx'),
    ('goal-practice-snapshot-notice', 'app/goals/components/GoalPracticeModalHost.tsx', 'weeklyGoalPracticeThemes.source === "snapshot"', 'weeklyGoalPracticeThemes.source !== "snapshot"', 'tests/components/GoalPracticeModalHost.test.tsx'),
    ('duel-mode-disabled-row-style', 'app/components/modals/DuelModePicker.tsx', 'return isDisabled\n', 'return false\n', 'tests/components/DuelModePicker.test.tsx'),
    ('typed-answer-first-letter', 'app/duel/[duelId]/hooks/useDuelTypeReveal.ts', 'correctAnswer.slice(0, i + 1)', 'correctAnswer.slice(0, i)', 'tests/hooks/useDuelTypeReveal.test.ts'),
    ('solo-accuracy-high-boundary', 'app/solo/[sessionId]/components/CompletionScreen.tsx', 'accuracy >= ACCURACY_THRESHOLDS.HIGH', 'accuracy > ACCURACY_THRESHOLDS.HIGH', 'tests/components/SoloStatusScreens.test.tsx'),

    ('duel-confirm-selection-lock', 'app/duel/[duelId]/components/DuelFooter.tsx', 'const confirmDisabled = !answers.selectedAnswer || answers.isLocked;', 'const confirmDisabled = answers.isLocked;', 'tests/components/DuelView.pve.test.tsx'),
    ('theme-word-answer-edit-field', 'app/themes/components/ThemeWordCard.tsx', 'onEditWord(index, "answer")', 'onEditWord(index, "word")', 'tests/components/ThemeDetail.behavior.test.tsx'),
    ('solo-modal-study-duration', 'app/components/modals/SoloPracticeModal.tsx', 'selectedMode === "learn_practice" ? selectedDuration : undefined', 'selectedMode === "learn_practice" ? 600 : undefined', 'tests/components/SoloPracticeModal.test.tsx'),
    ('presence-inflight-lock', 'hooks/usePresence.ts', 'if (isUpdatingRef.current) {', 'if (false) {', 'tests/hooks/usePresence.test.ts'),
    ('sync-user-latest-identity', 'hooks/useSyncUser.ts', 'pendingPayloadRef.current = syncPayload;', 'pendingPayloadRef.current ??= syncPayload;', 'tests/hooks/useSyncUser.test.ts'),
    ('solo-launch-duration', 'hooks/useSoloPracticeLauncher.ts', '{ themeIds, durationSeconds }', '{ themeIds }', 'tests/hooks/useSoloPracticeLauncher.test.ts'),

    ('notification-friend-request-identity', 'app/notifications/hooks/useFriendNotificationActions.ts', 'await acceptFriendRequestMutation({ notificationId });', 'await acceptFriendRequestMutation({ notificationId: "wrong" as Id<"notifications"> });', 'tests/hooks/useNotifications.test.ts'),
    ('settings-trigger-update-field', 'app/settings/notifications/page.tsx', 'updatePrefs({ [metadata.trigger]: value })', 'updatePrefs({ [metadata.category]: value })', 'tests/components/SettingsPages.test.tsx'),

    ('solo-level-reverse-dispatch', 'app/solo/[sessionId]/components/SoloQuestion.tsx', 'session.translationDirection === "reverse"', 'session.translationDirection === "forward"', 'tests/components/SoloQuestion.test.tsx'),

    ('peer-hint-elimination-limit', 'app/duel/[duelId]/hooks/duelViewModelHelpers.ts', 'args.eliminatedOptions.length < PVP_HINT_ELIMINATION_PICKS', 'args.eliminatedOptions.length <= PVP_HINT_ELIMINATION_PICKS', 'tests/hooks/duelHintFlags.test.ts'),

    ('word-study-reveal-toggle', 'app/solo/learn/[sessionId]/components/WordCard.tsx', 'isFullyRevealed ? onResetWord : onRevealFullWord', 'isFullyRevealed ? onRevealFullWord : onResetWord', 'tests/components/WordStudyCard.test.tsx'),

    ('countdown-repeat-skip-lock', 'app/game/components/duel/CountdownControls.tsx', 'disabled={iHaveSkipped}', 'disabled={false}', 'tests/components/CountdownControls.test.tsx'),
    ('theme-add-word-duplicate', 'app/themes/hooks/useThemeGenerationController.ts', 'if (isWordDuplicate(addWordHook.newWordInput, params.localWords)) {', 'if (false) {', 'tests/hooks/useThemesController.test.ts'),

    ('relay-sentence-spectator-lock', 'app/duel/[duelId]/components/RelaySentenceAnswer.tsx', 'const locked = !amAnswerer || showFeedback;', 'const locked = showFeedback;', 'tests/components/RelayDuelView.test.tsx'),
    ('relay-client-timeout-boundary', 'app/duel/[duelId]/hooks/useRelayCountdown.ts', 'msLeft <= 0 && !firedRef.current', 'msLeft < 0 && !firedRef.current', 'tests/components/RelayDuelView.test.tsx'),
    ('relay-pick-in-flight', 'app/duel/[duelId]/components/RelayDuelView.tsx', 'if (pickingPosition !== null) return;', 'if (false) return;', 'tests/components/RelayDuelView.test.tsx'),

    ('theme-picker-retained-selection', 'app/components/modals/ThemeSelector.tsx', 'currentThemeId !== themeId', 'currentThemeId === themeId', 'tests/components/ThemeSelectorGroups.test.tsx'),
    ('notification-accepted-duel-route', 'app/notifications/components/NotificationsTab.tsx', 'router.push(`/duel/${result.duelId}`);', 'router.push("/duel/wrong");', 'tests/components/NotificationsTab.test.tsx'),
    ('sentence-board-bonus-time', 'app/duel/[duelId]/components/SentenceBoard.tsx', 'SENTENCE_TIMER_SECONDS + (duel.currentQuestionTimerBonusSeconds ?? 0)', 'SENTENCE_TIMER_SECONDS', 'tests/components/SentenceBoard.test.tsx'),
    ('sentence-board-peel-last', 'app/duel/[duelId]/components/SentenceBoard.tsx', 'order === placedTileIndices.length - 1', 'order !== placedTileIndices.length - 1', 'tests/components/SentenceBoard.test.tsx'),

    ('sentence-hint-question-gate', 'app/duel/[duelId]/components/SentenceHintPoolUI.tsx', 'currentQuestionHintFired ||', 'false ||', 'tests/components/SentenceEditingControls.test.tsx'),
    ('preference-loading-save-gate', 'app/components/usePersistedPreference.ts', 'if (saveValue && serverValueLoaded) {', 'if (saveValue) {', 'tests/hooks/usePersistedPreference.test.ts'),

    ('themes-review-priority', 'app/themes/page.tsx', 'if (controller.isSentenceReviewActive) return null;', 'if (false) return null;', 'tests/components/ThemesPage.test.tsx'),
    ('sabotage-completed-duel', 'convex/sabotage.ts', 'if (!isDuelActive(duel)) {', 'if (false) {', 'tests/convex/sabotage.test.ts'),
    ('repetition-lost-last-life', 'convex/weeklyGoalRepetitions/duelCompletion.ts', 'duel.livesRemaining <= 0', 'duel.livesRemaining < 0', 'tests/convex/weeklyGoalRepetitions.test.ts'),
    ('boss-launch-participant', 'convex/weeklyGoals/bossWorkflows.ts', 'if (!isGoalParticipant(goal, user._id)) {', 'if (false) {', 'tests/convex/weeklyBossFlow.test.ts'),

    ('prototype-generation-count', 'app/mocks/theme-sentences/page.tsx', 'sentenceCount: targetCount * 2,', 'sentenceCount: targetCount,', 'tests/components/ThemeSentencesPrototype.test.tsx'),
    ('add-word-trimmed-input', 'app/themes/hooks/useAddWord.ts', 'newWord: trimmedWord,', 'newWord: state.newWordInput,', 'tests/hooks/useAddWord.test.ts'),
    ('friend-search-success-reset', 'app/notifications/components/AddFriendSection.tsx', 'setSearchTerm("");', 'setSearchTerm("unchanged");', 'tests/components/AddFriendSection.test.tsx'),
    ('sentence-duplicate-distractors', 'convex/themes/archiveDuplicate.ts', 'distractors: [...round.distractors],', 'distractors: ["perro", "come", "azul"],', 'tests/convex/sentenceThemeLifecycle.test.ts'),
    ('email-user-preferences', 'convex/emails/notificationEmails.ts', 'if (!isNotificationEnabled(trigger, prefs)) {', 'if (false) {', 'tests/convex/notificationEmails.test.ts'),

    ('sentence-study-hint-count', 'app/solo/learn/[sessionId]/components/SentenceStudyCard.tsx', 'tokens.length - revealedSet.size', 'tokens.length + revealedSet.size', 'tests/components/SentenceStudyCard.test.tsx'),
    ('sentence-study-missing-audio', 'app/solo/learn/[sessionId]/components/SentenceStudyCard.tsx', 'const ttsDisabled = !hasStoredTTS || isTTSDisabled;', 'const ttsDisabled = isTTSDisabled;', 'tests/components/SentenceStudyCard.test.tsx'),

    ('boss-solo-learning-route', 'app/boss/hooks/useBossLaunch.ts', '"learn_practice"', '"practice_only"', 'tests/components/GoalLaunchPages.test.tsx'),
    ('repetition-pending-actions', 'app/repetition/[goalId]/page.tsx', 'const isDisabled = !preview.canStart || isStarting !== null;', 'const isDisabled = !preview.canStart;', 'tests/components/GoalLaunchPages.test.tsx'),

    ('answer-hidden-opponent-pick', 'app/duel/[duelId]/components/AnswerOptionButton.tsx', 'showOpponentPick && opponentAnswer === answer', 'opponentAnswer === answer', 'tests/components/AnswerOptionRendering.test.tsx'),
    ('answer-feedback-style-precedence', 'app/duel/[duelId]/components/AnswerOptionButton.tsx', 'const combinedStyle = { ...style, ...state.style };', 'const combinedStyle = { ...state.style, ...style };', 'tests/components/AnswerOptionRendering.test.tsx'),

    ('guided-typing-hint-letter', 'app/game/levels/Level1Input.tsx', 'newTyped[slotIndex] = letterSlots[slotIndex].char;', 'newTyped[slotIndex] = "x";', 'tests/components/Level1Input.test.tsx'),
    ('notification-retention-index-boundary', 'convex/notifications.ts', '.lt("createdAt", cutoff)', '.lt("createdAt", cutoff + 1)', 'tests/convex/notificationRetention.test.ts'),
    ('sentence-generation-name-limit', 'app/themes/components/GenerateSentenceThemeModal.tsx', 'event.target.value.length <= THEME_NAME_MAX_LENGTH', 'event.target.value.length < THEME_NAME_MAX_LENGTH', 'tests/components/SentenceGenerationModals.test.tsx'),
    ('solo-link-mode', 'hooks/useSoloDeepLink.ts', 'soloModeParam === "practice_only"', 'soloModeParam !== "practice_only"', 'tests/hooks/useSoloDeepLink.test.ts'),

    ('sentence-edited-audio', 'app/themes/lib/sentenceRoundEditing.ts', 'return rest;', 'return round;', 'tests/hooks/useSentenceThemeController.test.tsx'),
    ('sentence-english-free-words', 'app/themes/lib/sentenceRoundEditing.ts', 'round.spanishSentence,\n            round.freeWordPositions,', 'round.spanishSentence,\n            [],', 'tests/hooks/useSentenceThemeController.test.tsx'),
    ('sentence-tts-credit-warning', 'app/themes/hooks/useSentenceThemeController.ts', 'result.skippedForCredits > 0', 'result.skippedForCredits < 0', 'tests/hooks/useSentenceThemeController.test.tsx'),

    ('boss-prior-mini-lives', 'convex/challenges.ts', 'miniBossDefeated: goal.miniBossStatus === "defeated"', 'miniBossDefeated: false', 'tests/convex/goalChallengeAcceptance.test.ts'),
    ('boss-completion-kind', 'convex/gameplay.ts', 'if (duel.bossType === "mini") {', 'if (duel.bossType !== "mini") {', 'tests/convex/bossDuelCompletion.test.ts'),
    ('repetition-existing-progress', 'convex/weeklyGoalRepetitions/rules.ts', 'if (existing) continue;', 'if (false) continue;', 'tests/convex/bossDuelCompletion.test.ts'),

    ('theme-list-word-tab', 'app/themes/components/ThemeList.tsx', 'themes.filter((theme) => !isSentenceTheme(theme))', 'themes.filter((theme) => isSentenceTheme(theme))', 'tests/components/ThemeList.test.tsx'),
    ('theme-card-delete-owner', 'app/themes/components/ThemeCardMenu.tsx', '{isOwner && (', '{!isOwner && (', 'tests/components/ThemeList.test.tsx'),
    ('theme-card-open-action', 'app/themes/components/ThemeCard.tsx', 'onClick={() => onOpenTheme(theme)}', 'onClick={() => {}}', 'tests/components/ThemeList.test.tsx'),

    ('trampoline-launch-boundary', 'app/game/sabotage/hooks/useTrampolineOptions.ts', 'if (elapsed < TRAMPOLINE_SHAKE_MS) {', 'if (elapsed <= TRAMPOLINE_SHAKE_MS) {', 'tests/hooks/useSabotagePhysics.test.ts'),
    ('trampoline-gravity', 'app/game/sabotage/hooks/useTrampolineOptions.ts', 'vy += TRAMPOLINE_GRAVITY * simDt;', 'vy -= TRAMPOLINE_GRAVITY * simDt;', 'tests/hooks/useSabotagePhysics.test.ts'),
    ('bounce-left-reflection', 'app/game/sabotage/hooks/useBounceOptions.ts', 'vx = Math.abs(vx);', 'vx = -Math.abs(vx);', 'tests/hooks/useSabotagePhysics.test.ts'),
    ('sabotage-frame-cleanup', 'app/game/sabotage/hooks/useAnimatedOptions.ts', 'cancelAnimationFrame(animationRef.current);', 'void animationRef.current;', 'tests/hooks/useSabotagePhysics.test.ts'),
    ('word-editor-manual-limit', 'app/themes/components/ManualMode.tsx', 'e.target.value.length <= manualMaxLength', 'e.target.value.length < manualMaxLength', 'tests/components/WordEditor.test.tsx'),

    ('tbt-client-timeout-once', 'app/duel/[duelId]/hooks/useTbtQuestionClock.ts', 'remainingMs <= 0 && firedForRef.current !== questionIndex', 'remainingMs <= 0', 'tests/components/TurnByTurnView.test.tsx'),
    ('tbt-viewer-turn-lock', 'app/duel/[duelId]/components/TurnByTurnView.tsx', 'locked={!myTurn}', 'locked={myTurn}', 'tests/components/TurnByTurnView.test.tsx'),
    ('tbt-turn-owner', 'convex/tbtDuel.ts', 'playerRole !== tbtState.turn', 'playerRole === tbtState.turn', 'tests/convex/tbtDuel.test.ts'),
    ('tbt-wrong-tile-marker', 'convex/tbtDuel.ts', 'tbtLastWrongTileIndex: accepted ? undefined : tileIndex', 'tbtLastWrongTileIndex: accepted ? tileIndex : undefined', 'tests/convex/tbtDuel.test.ts'),
    ('nickname-collision-retry', 'convex/users.ts', 'if (!usedDiscriminators.has(candidate)) {', 'if (true) {', 'tests/convex/users.core.test.ts'),

    ('theme-save-failed-preserves-editor', 'app/themes/hooks/useThemeDetailController.ts', 'if (!saved.result.ok) {', 'if (saved.result.ok) {', 'tests/hooks/useThemeDetailController.test.ts'),
    ('theme-save-request-identity', 'app/themes/hooks/useThemeDetailController.ts', '        draft.saveRequestId,', '        "wrong-request",', 'tests/hooks/useThemeDetailController.test.ts'),

    ('friend-remove-confirmation', 'app/notifications/components/FriendListItem.tsx', '    onRemoveFriend();', '    onQuickDuel();', 'tests/components/FriendListItem.test.tsx'),
    ('friend-long-press-boundary', 'app/notifications/components/FriendListItem.tsx', '    }, 500);', '    }, 501);', 'tests/components/FriendListItem.test.tsx'),
    ('friend-removal-goal-cleanup', 'app/notifications/components/FriendsTab.tsx', 'alsoCleanupSharedWeeklyGoals: true', 'alsoCleanupSharedWeeklyGoals: false', 'tests/components/FriendsTab.test.tsx'),
    ('reminder-hours-conversion', 'app/settings/notifications/components/ReminderOffsetInput.tsx', 'newValue * 60', 'newValue', 'tests/components/PreferenceControls.test.tsx'),
    ('experimental-preference-value', 'app/settings/hooks/useExperimentalFeatures.ts', 'await updateShowExperimentalFeatures(nextValue);', 'await updateShowExperimentalFeatures(!nextValue);', 'tests/components/PreferenceControls.test.tsx'),

    ('results-boss-failure-boundary', 'app/game/components/duel/FinalResultsPanel.tsx', 'if (livesRemaining <= 0)\n      return', 'if (livesRemaining < 0)\n      return', 'tests/components/FinalResultsPanel.test.tsx'),
    ('lobby-query-enablement', 'hooks/challengeLobby/useChallengeData.ts', 'shouldLoad ? {} : "skip"', 'shouldLoad ? "skip" : {}', 'tests/hooks/useChallengeLobbyData.test.ts'),
    ('lobby-accepted-navigation', 'hooks/challengeLobby/useChallengeStatusWatcher.ts', 'router.push(`/duel/${challenge.duelId}`)', 'router.push(`/duel/wrong`)', 'tests/hooks/useChallengeLobbyData.test.ts'),
    ('goal-expiry-duplicate', 'convex/weeklyGoals.ts', 'if (matching) {', 'if (false) {', 'tests/convex/goalDateAndExpiry.test.ts'),
    ('tts-lock-expiry-boundary', 'convex/ttsGenerationLocks.ts', 'currentExpiresAt > now', 'currentExpiresAt >= now', 'tests/convex/usersTtsGenerationLock.test.ts'),

    ('duel-page-relay-content', 'app/duel/[duelId]/components/DuelPageContent.tsx', 'duel.duelMode !== "relay" && !duel.duelQuestions?.length', '!duel.duelQuestions?.length', 'tests/components/DuelPage.test.tsx'),
    ('duel-page-viewer-role', 'app/duel/[duelId]/components/DuelPageContent.tsx', 'duelData.viewerRole ?? "challenger"', '"challenger"', 'tests/components/DuelPage.test.tsx'),
    ('theme-curated-meanings', 'convex/themes/mutations.ts', 'sameSpanishPrevious.wordMeanings,', 'round.wordMeanings,', 'tests/convex/themeContentUpdates.test.ts'),
    ('theme-changed-token-free-words', 'convex/themes/mutations.ts', 'return withPlaceholderWordMeanings(round, []);', 'return withPlaceholderWordMeanings(round, normalizedFreeWordPositions);', 'tests/convex/themeContentUpdates.test.ts'),

    ('duel-future-answer-mask', 'convex/duels.ts', 'if (args.questionIndex !== args.duel.currentItemIndex) {', 'if (false) {', 'tests/convex/duels.safeDto.test.ts'),
    ('duel-unpause-peer-confirmation', 'convex/gameplay.ts', 'if (duel.countdownUnpauseRequestedBy === playerRole) {', 'if (duel.countdownUnpauseRequestedBy !== playerRole) {', 'tests/convex/duelGameplay.test.ts'),
    ('goal-retention-practice-cleanup', 'convex/weeklyGoals/cleanup.ts', 'await ctx.db.delete(session._id);', 'await ctx.db.delete(goal._id);', 'tests/convex/weeklyGoals.retention.test.ts'),
    ('challenge-cancel-owner', 'convex/challenges.ts', 'if (!isChallenger) {', 'if (isChallenger) {', 'tests/convex/challenges.test.ts'),

    ('theme-list-friend-permission', 'convex/themes/listQueries.ts', 'if (!friendship) return [];', 'if (false) return [];', 'tests/convex/themeListQueries.test.ts'),
    ('theme-list-archive-selection', 'convex/themes/listQueries.ts', 'args.archivedOnly ? archivedIds.has(theme._id) : !archivedIds.has(theme._id)', 'args.archivedOnly ? !archivedIds.has(theme._id) : archivedIds.has(theme._id)', 'tests/convex/themeListQueries.test.ts'),
    ('goal-viewer-participant-boundary', 'convex/weeklyGoals/queries.ts', 'const isCreator = goal.creatorId === userId;\n  if (!isGoalParticipant(goal, userId)) return null;', 'const isCreator = goal.creatorId === userId;\n  if (false) return null;', 'tests/convex/weeklyGoalQueries.test.ts'),
    ('shared-goal-reverse-duplicate', 'convex/weeklyGoals/createGoal.ts', 'if (visibleUserAsPartner.length > 0) {', 'if (false) {', 'tests/convex/sharedGoalCreation.test.ts'),
    ('reminder-batch-isolation', 'convex/emails/reminderCrons.ts', 'console.error(`Failed to send reminder email: ${context}`, error);', 'throw error;', 'tests/convex/reminderCronBatches.test.ts'),

    ('hint-ui-elimination-completion', 'app/game/components/duel/HintSystemUI.tsx', 'eliminatedOptionsCount >= PVP_HINT_ELIMINATION_PICKS', 'eliminatedOptionsCount > PVP_HINT_ELIMINATION_PICKS', 'tests/components/HintSystemUI.test.tsx'),
    ('hint-ui-request-action', 'app/game/components/duel/HintSystemUI.tsx', 'onClick={onRequestHint}', 'onClick={onAcceptHint}', 'tests/components/HintSystemUI.test.tsx'),

    ('duel-live-answer-disclosure', 'app/duel/[duelId]/hooks/useDuelSessionViewModel.ts', 'const revealed = question.answerRevealedToViewer === true;', 'const revealed = true;', 'tests/components/DuelSession.test.tsx'),
    ('duel-frozen-presentation', 'app/duel/[duelId]/hooks/useDuelSessionViewModel.ts', '    frozenData ??\n    liveWordPresentation', '    null ??\n    liveWordPresentation', 'tests/components/DuelSession.test.tsx'),
    ('duel-sabotage-round-boundary', 'app/duel/[duelId]/hooks/useDuelSessionViewModel.ts', 'theirSabotage.timestamp >= questionStartTime', 'theirSabotage.timestamp > questionStartTime', 'tests/components/DuelSession.test.tsx'),
    ('cross-kind-viewer-score', 'app/duel/[duelId]/components/CrossKindTransitionView.tsx', 'forRole(duel, viewerRole)', 'forRole(duel, "challenger")', 'tests/components/DuelSession.test.tsx'),
    ('cross-kind-prior-answer', 'app/duel/[duelId]/components/CrossKindTransitionView.tsx', 'correctAnswer: question.spanishSentence ?? null', 'correctAnswer: question.englishPrompt ?? null', 'tests/components/DuelSession.test.tsx'),

    ('notification-reminder-inclusive-limit', 'convex/notificationPreferences.ts', 'args.weeklyGoalReminder1OffsetMinutes > WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES', 'args.weeklyGoalReminder1OffsetMinutes >= WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES', 'tests/convex/notificationPreferences.test.ts'),
    ('friend-received-request-duplicate', 'convex/friends.ts', 'if (existingReceivedRequest) {', 'if (false) {', 'tests/convex/friends.lifecycle.test.ts'),
    ('friend-expiry-matching-notification', 'convex/friends.ts', 'if (!expiredPendingRequestIds.has(String(notification.payload.friendRequestId))) continue;', 'if (false) continue;', 'tests/convex/friends.lifecycle.test.ts'),
    ('friend-online-sort', 'convex/friends.ts', 'if (a.isOnline && !b.isOnline) return -1;', 'if (a.isOnline && !b.isOnline) return 1;', 'tests/convex/friends.lifecycle.test.ts'),
    ('theme-tts-stale-refund-owner', 'convex/themes/generateThemeTtsAction.ts', '.filter((result) => rejectedStorageIds.has(result.storageId))', '.filter((result) => !rejectedStorageIds.has(result.storageId))', 'tests/convex/themeTtsGeneration.test.ts'),
    ('theme-tts-release-lock', 'convex/themes/generateThemeTtsAction.ts', 'await ctx.runMutation(internal.ttsGenerationLocks.releaseTtsGenerationLock, {', 'await ctx.runMutation(internal.ttsGenerationLocks.acquireTtsGenerationLock, {', 'tests/convex/themeTtsGeneration.test.ts'),
    ('email-claim-stale-boundary', 'convex/emails/emailNotificationLog.ts', 'existing.claimedAt > now - EMAIL_SEND_CLAIM_STALE_MS', 'existing.claimedAt >= now - EMAIL_SEND_CLAIM_STALE_MS', 'tests/convex/emailLogLifecycle.test.ts'),
    ('email-sent-at', 'convex/emails/emailNotificationLog.ts', 'sentAt: Date.now(),', 'sentAt: 0,', 'tests/convex/emailLogLifecycle.test.ts'),
    ('word-answer-unpublished-feedback', 'lib/duel/wordAnswerDisclosure.ts', 'answers.correctAnswer !== null && answers.hasNoneOption !== null', 'answers.hasNoneOption !== null', 'tests/components/DuelView.pve.test.tsx'),
    ('word-audio-transition-disclosure', 'lib/duel/wordAnswerDisclosure.ts', '(phase === "transition" && hasFrozenRound)', 'hasFrozenRound', 'tests/components/DuelView.pve.test.tsx'),
    ('word-timer-danger-boundary', 'app/duel/[duelId]/components/DuelView.tsx', 'timer.questionTimer <= TIMER_DANGER_THRESHOLD', 'timer.questionTimer < TIMER_DANGER_THRESHOLD', 'tests/components/DuelView.pve.test.tsx'),

    ('meaning-refresh-text-identity', 'convex/themes/sentenceWordMeanings.ts', 'round.englishPrompt === target.englishPrompt', 'true', 'tests/convex/sentenceWordMeanings.test.ts'),
    ('meaning-refresh-skipped-count', 'convex/themes/sentenceWordMeanings.ts', 'args.rounds.length - applyResult.applied', 'args.rounds.length - generated.length', 'tests/convex/sentenceWordMeanings.test.ts'),
    ('theme-metadata-normalization', 'convex/themes/mutations.ts', 'normalizeThemeDescription(\n      updates.description,\n    )', 'updates.description', 'tests/convex/themeMetadataUpdates.test.ts'),
    ('theme-sharing-default', 'convex/themes/mutations.ts', 'friendsCanEdit: args.friendsCanEdit ?? false', 'friendsCanEdit: args.friendsCanEdit ?? true', 'tests/convex/themesCreateTheme.idempotency.test.ts'),
    ('hint-provider-recipient-score', 'convex/rules/duelScoringRules.ts', 'challengerScore: (duel.challengerScore || 0) + HINT_PROVIDER_BONUS', 'challengerScore: (duel.challengerScore || 0) - HINT_PROVIDER_BONUS', 'tests/convex/duelScoringRules.test.ts'),
    ('theme-back-edit-priority', 'app/themes/hooks/useThemesController.ts', 'if (sentenceController.editField) {', 'if (false) {', 'tests/hooks/useThemesController.test.ts'),
    ('theme-content-routing', 'app/themes/hooks/useThemesController.ts', 'if (isSentenceTheme(theme)) {', 'if (!isSentenceTheme(theme)) {', 'tests/hooks/useThemesController.test.ts'),
    ('theme-delete-kind', 'app/themes/hooks/useThemesController.ts', 'selection.type === "theme"', 'selection.type === "word"', 'tests/hooks/useThemesController.test.ts'),
    ('hint-used-pool', 'convex/hintPool.ts', 'if (used.includes(hintType)) {', 'if (false) {', 'tests/convex/hintPool.test.ts'),
    ('relay-stale-assignment', 'convex/relayDuel.ts', 'duel.relayAssignedIndex !== expectedAssignedIndex', 'duel.relayAssignedIndex === expectedAssignedIndex', 'tests/convex/relayDuel.test.ts'),
    ('relay-timeout-boundary', 'convex/relayDuel.ts', 'Date.now() - startedAt < relayAnswerWindowMs(duel)', 'Date.now() - startedAt <= relayAnswerWindowMs(duel)', 'tests/convex/relayDuel.test.ts'),
    ('relay-hard-budget', 'convex/relayDuel.ts', '(duel.relayHardBudget?.[playerRole] ?? 0) <= 0', '(duel.relayHardBudget?.[playerRole] ?? 0) < 0', 'tests/convex/relayDuel.test.ts'),
    ('nickname-maximum-length', 'convex/users.ts', 'nickname.slice(0, NICKNAME_MAX_LENGTH)', 'nickname.slice(0, NICKNAME_MAX_LENGTH - 1)', 'tests/convex/users.core.test.ts'),
    ('sentence-repeat-confirm', 'convex/rules/sentenceGameplayRules.ts', 'if (repeatsFailedConfirmation(current)) {', 'if (false) {', 'tests/convex/sentenceGameplayRules.test.ts'),
    ('sentence-tile-duplicate', 'convex/rules/sentenceGameplayRules.ts', 'return !current.placedTileIndices.includes(tileIndex);', 'return true;', 'tests/convex/sentenceGameplayRules.test.ts'),
    ('sentence-full-length', 'convex/rules/sentenceGameplayRules.ts', 'placedTileIndices.length === correctTokens.length &&', 'true &&', 'tests/convex/sentenceGameplayRules.test.ts'),
    ('sentence-opponent-score', 'convex/rules/sentenceGameplayRules.ts', 'duel.opponentScore + earned', 'duel.opponentScore - earned', 'tests/convex/sentenceGameplayRules.test.ts'),
    ('goal-add-locked', 'convex/weeklyGoals/mutations.ts', 'if (goal.creatorLocked || goal.partnerLocked) {', 'if (false) {', 'tests/convex/weeklyGoals.addTheme.test.ts'),
    ('goal-own-lock-notification', 'convex/weeklyGoals/mutations.ts', 'if (lockedParticipantId !== userId) {', 'if (true) {', 'tests/convex/weeklyGoals.removeTheme.test.ts'),
    ('sentence-free-word-index', 'app/themes/components/SentenceRoundCard.tsx', 'onToggleFreeWord(index, tokenIndex)', 'onToggleFreeWord(index, tokenIndex + 1)', 'tests/components/SentenceThemeDetail.test.tsx'),
    ('theme-tts-stale-selection', 'app/themes/hooks/useThemeTtsController.ts', 'generationContextRef.current += 1;', 'generationContextRef.current += 0;', 'tests/hooks/useThemeTtsController.test.ts'),
    ('coverage-deleted-source', 'quality/metrics.mjs', '...Object.keys(manifest.sourceHashes)', '...[]', 'tests/tooling/qualityMetrics.test.ts'),
    ('tts-cache-lru', 'hooks/useTTS.ts', 'cache.delete(cacheKey);', '// Mutation: leave the cache entry in its prior position.', 'tests/hooks/useTTS.test.ts'),
    ('tts-cache-capacity', 'hooks/useTTS.ts', 'while (cacheRef.current.size > maxCacheSize) {', 'while (cacheRef.current.size >= maxCacheSize) {', 'tests/hooks/useTTS.test.ts'),
    ('repetition-mastery-authority', 'convex/weeklyGoalRepetitions/soloPractice.ts', 'masteredItemIndices.has(index)', 'masteredItemIndices.size === itemCount', 'tests/convex/repetitionSoloPractice.test.ts'),
    ('repetition-mastery-sort', 'convex/weeklyGoalRepetitions/soloPractice.ts', '(a, b) => a - b', '(a, b) => b - a', 'tests/convex/repetitionSoloPractice.test.ts'),
    ('repetition-session-owner', 'convex/weeklyGoalRepetitions/soloPractice.ts', 'session.userId === userId', 'session.userId !== userId', 'tests/convex/repetitionSoloPractice.test.ts'),
    ('wizard-relay-preset', 'app/components/modals/useChallengeWizard.ts', 'duelDifficultyPreset: isRelaySelected ? undefined : selectedDifficulty', 'duelDifficultyPreset: selectedDifficulty', 'tests/hooks/useChallengeWizard.test.ts'),
    ('wizard-tbt-deck-guard', 'app/components/modals/useChallengeWizard.ts', 'if (isTransitioning || disabledModes?.[mode]) return;', 'if (isTransitioning) return;', 'tests/hooks/useChallengeWizard.test.ts'),
    ('wizard-review-theme-label', 'app/components/modals/ChallengeModal.tsx', 'themes?.find((theme) => theme._id === selectedThemeIds[0])?.name ?? "1 theme"', '"1 theme"', 'tests/components/ChallengeModalWizard.test.tsx'),
    ('goal-partner-lock-projection', 'app/goals/components/GoalParticipantsPanel.tsx', 'const creatorLocked = selectedGoal.viewerRole === "creator" ? viewerLocked : partnerLocked;', 'const creatorLocked = viewerLocked;', 'tests/components/GoalPanels.test.tsx'),
    ('goal-toggle-role-projection', 'app/goals/components/GoalThemeList.tsx', 'mode === "solo" || viewerRole === "creator"', 'true', 'tests/components/GoalPanels.test.tsx'),
    ('boss-shared-warmup', 'convex/weeklyGoals/bossWorkflows.ts', 'if (goal.mode !== "solo") {', 'if (false) {', 'tests/convex/bossSoloCompletion.test.ts'),
    ('boss-session-owner', 'convex/weeklyGoals/bossWorkflows.ts', 'if (session.userId !== userId) {', 'if (false) {', 'tests/convex/bossSoloCompletion.test.ts'),
    ('repetition-board-done-order', 'convex/weeklyGoalRepetitions/board.ts', 'b.updatedAt - a.updatedAt', 'a.updatedAt - b.updatedAt', 'tests/convex/repetitionBoard.test.ts'),
    ('credits-charge-direction', 'convex/credits.ts', 'nextLlmCredits -= cost;', 'nextLlmCredits += cost;', 'tests/convex/credits.test.ts'),
    ('session-normal-source-invariant', 'convex/helpers/sessionCreation.ts', 'if (args.weeklyGoalId || args.bossType || args.spacedRepetitionStep !== undefined) {', 'if (false) {', 'tests/convex/sessionCreation.test.ts'),

    ('solo-weekly-empty-ready', 'app/solo/hooks/useSoloSessionSource.ts', 'return sourceState("ready", "", themeCount > 0);', 'return sourceState("ready", "", true);', 'tests/hooks/useSoloSessionSource.test.ts'),
    ('solo-source-missing-theme', 'app/solo/hooks/useSoloSessionSource.ts', 'themeCount !== input.requestedThemeIds.length', 'false', 'tests/hooks/useSoloSessionSource.test.ts'),
    ('transition-stale-zero', 'app/duel/[duelId]/hooks/useCrossKindRoundTransition.ts', 'if (transitionKey !== prevTransitionKeyRef.current) {', 'if (false) {', 'tests/hooks/useCrossKindRoundTransition.test.ts'),
    ('transition-one-skip', 'app/duel/[duelId]/hooks/useCrossKindRoundTransition.ts', 'skipRequestedBy.includes("challenger") && skipRequestedBy.includes("opponent")', 'skipRequestedBy.includes("challenger") || skipRequestedBy.includes("opponent")', 'tests/hooks/useCrossKindRoundTransition.test.ts'),
    ('archive-only-completed', 'convex/weeklyGoals/invitationMutations.ts', 'if (goal.status !== "completed") {', 'if (false) {', 'tests/convex/weeklyGoalArchive.test.ts'),
    ('archive-preserve-existing', 'convex/weeklyGoals/invitationMutations.ts', 'archivedThemeIds: [...currentArchived, ...newlyArchivedThemeIds]', 'archivedThemeIds: [...newlyArchivedThemeIds]', 'tests/convex/weeklyGoalArchive.test.ts'),
    ('hint-resume-time', 'convex/hints.ts', 'duel.questionStartTime + pauseDuration', 'duel.questionStartTime', 'tests/convex/hintsModeGuards.test.ts'),
    ('hint-correct-option', 'convex/hints.ts', 'if (option === currentQuestion.correctOption) {', 'if (false) {', 'tests/convex/hintsModeGuards.test.ts'),
    ('sentence-punctuation-match', 'lib/themes/sentenceValidation.ts', 'correctWordsByPunctuationless.has(normalizedPunctuationless)', 'false', 'tests/lib/themes/validationIssueContracts.test.ts'),
    ('sentence-meaning-count', 'lib/themes/sentenceValidation.ts', 'rawWordMeanings.length !== tokenCount', 'rawWordMeanings.length === tokenCount', 'tests/lib/themes/sentenceValidation.test.ts'),
    ('word-duplicate-detection', 'lib/themes/serverValidation.ts', 'if (existingWrongAnswer) {', 'if (false) {', 'tests/lib/themes/validationIssueContracts.test.ts'),
    ('generation-field-validation', 'lib/themes/api.ts', 'if (!validate(payload.data)) {', 'if (false) {', 'tests/lib/themeApiBoundaries.test.ts'),

    ("sentence-eliminated-disabled", "app/duel/[duelId]/components/SentenceBuildBoard.tsx", 'disabled={locked || isEliminated}', 'disabled={locked}', "tests/components/SentenceBuildBoard.test.tsx"),
    ("sentence-confirm-correctness", "app/duel/[duelId]/components/SentenceBuildBoard.tsx", 'isCorrect: isPlaced && correctness === true', 'isCorrect: isPlaced && correctness === false', "tests/components/SentenceBuildBoard.test.tsx"),
    ("goal-date-server-sync", "app/goals/hooks/useGoalsPageModel.ts", 'previousSource.endDate !== endDate || previousSource.goalId !== goalId', 'previousSource.goalId !== goalId', "tests/hooks/useGoalsPageModel.test.ts"),
    ("admin-preserves-shared-history", "convex/admin.ts", 'if (!isSoloGoal && isCompleted) {', 'if (false) {', "tests/convex/admin.deleteUserFully.test.ts"),
    ("admin-linked-notifications", "convex/admin.ts", 'return referencesDeletedChallenge || referencesDeletedGoal;', 'return referencesDeletedChallenge;', "tests/convex/admin.deleteUserFully.test.ts"),
    ("role-opponent-projection", "lib/duelRole.ts", 'myScore: mine.score, theirScore: theirs.score', 'myScore: theirs.score, theirScore: mine.score', "tests/lib/duelRole.test.ts"),
    ("theme-content-equality", "lib/themes/arrayEquality.ts", 'if (!equal(left[index], right[index])) return false;', 'if (false) return false;', "tests/lib/themeEquality.test.ts"),
    ("confidence-level-range", "lib/soloConfidenceParam.ts", '[0, 1, 2, 3].includes(value)', '[0, 1, 2, 3, 4].includes(value)', "tests/lib/soloConfidenceParam.test.ts"),
    ("goals-existing-theme-filter", "app/goals/hooks/useGoalsPageModel.ts", 'if (existingThemeIds.has(themeId)) continue;', 'if (false) continue;', "tests/hooks/useGoalsPageModel.test.ts"),
    ("preference-preserves-opt-out", "lib/notificationPreferencesDefaults.ts", 'prefs[key] ?? DEFAULT_NOTIFICATION_PREFS[key]', 'prefs[key] || DEFAULT_NOTIFICATION_PREFS[key]', "tests/lib/notificationPreferenceNormalization.test.ts"),
    ("preference-reminder-limit", "lib/notificationPreferencesDefaults.ts", 'value > WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES', 'value >= WEEKLY_GOAL_REMINDER_MAX_OFFSET_MINUTES', "tests/lib/notificationPreferenceNormalization.test.ts"),
    ("coverage-digest-provenance", "quality/metrics.mjs", 'manifest.coverageSha256 === coverageDigest', 'true', "tests/tooling/qualityMetrics.test.ts"),
    ("tts-poll-attempt-limit", "lib/tts/providerAdapters.ts", 'const RESEMBLE_MAX_POLL_ATTEMPTS = 30;', 'const RESEMBLE_MAX_POLL_ATTEMPTS = 29;', "tests/lib/ttsProviderFailures.test.ts"),
    ("tts-overall-deadline", "lib/tts/providerAdapters.ts", 'export const TTS_TIMEOUT_MS = 30_000;', 'export const TTS_TIMEOUT_MS = 60_000;', "tests/lib/ttsProviderFailures.test.ts"),
    ("tts-provider-degradation", "lib/tts/providerAdapters.ts", 'for (const provider of [preferredProvider, fallbackProvider])', 'for (const provider of [preferredProvider])', "tests/lib/ttsProviderFailures.test.ts"),
    ("template-solo-progress", "lib/notificationTemplates.ts", "You're at ${progress} themes. Keep the momentum going.", "You're at <strong>0/0</strong> themes. Keep the momentum going.", "tests/lib/notificationTemplates.test.ts"),
    ("goals-theme-capacity", "app/goals/hooks/useGoalsPageModel.ts", 'if (addedThemeIds.size >= remainingSlots) break;', 'if (false) break;', "tests/hooks/useGoalsPageModel.test.ts"),
    ("goals-solo-create-route", "app/goals/hooks/useGoalsPageModel.ts", 'await createSoloGoal({})', 'await createSharedGoal({ partnerId: selectedPartnerId! })', "tests/hooks/useGoalsPageModel.test.ts"),
    ("duel-correct-score", "convex/rules/duelGameplayRules.ts", 'roleView.myScore + currentQuestion.points', 'roleView.myScore - currentQuestion.points', "tests/convex/duelGameplayRules.test.ts"),
    ("duel-both-answers", "convex/rules/duelGameplayRules.ts", 'duel.challengerAnswered && duel.opponentAnswered', 'duel.challengerAnswered || duel.opponentAnswered', "tests/convex/duelGameplayRules.test.ts"),
    ("duel-final-index", "convex/rules/duelGameplayRules.ts", 'Math.max(0, nextItemIndex - 1)', 'Math.max(0, nextItemIndex)', "tests/convex/duelGameplayRules.test.ts"),
    ("relay-opponent-score", "lib/duel/relayEngine.ts", 'duel.opponentScore + question.points', 'duel.opponentScore - question.points', "tests/lib/duel/relayEngine.test.ts"),
    ("tag-team-shared-score", "lib/duel/tbtEngine.ts", 'patch.opponentScore = duel.opponentScore + 1;', 'patch.opponentScore = duel.opponentScore;', "tests/convex/tbtEngine.test.ts"),
    ("tag-team-last-index", "lib/duel/tbtEngine.ts", 'duel.currentItemIndex + 1 >= total', 'duel.currentItemIndex + 1 > total', "tests/convex/tbtEngine.test.ts"),
    ("editor-feedback-history", "app/themes/hooks/useWordEditor.ts", 'history: overrides?.history ?? state.conversationHistory', 'history: state.conversationHistory', "tests/hooks/useWordEditor.test.ts"),
    ("editor-cancel-session", "app/themes/hooks/useWordEditor.ts", 'const reset = useCallback(() => {\n    editSessionRef.current += 1;', 'const reset = useCallback(() => {', "tests/hooks/useWordEditor.test.ts"),
    ("editor-readonly-permission", "app/themes/hooks/useThemeWordEditController.ts", 'params.selectedTheme.canEdit === false', 'params.selectedTheme.canEdit === true', "tests/hooks/useThemeWordEditController.test.ts"),
    ("editor-credit-boundary", "app/themes/hooks/useThemeWordEditController.ts", 'currentUser.llmCreditsRemaining < cost', 'currentUser.llmCreditsRemaining > cost', "tests/hooks/useThemeWordEditController.test.ts"),
    ("email-recipient-progress", "convex/emails/notificationEmailData.ts", 'args.toUser._id === goal.creatorId ? theme.creatorCompleted : theme.partnerCompleted === true', 'args.toUser._id === goal.creatorId ? theme.partnerCompleted === true : theme.creatorCompleted', "tests/convex/notificationEmailData.test.ts"),
    ("email-solo-shared-trigger", "convex/emails/notificationEmailData.ts", 'if (SHARED_GOAL_TRIGGERS.includes(args.trigger))', 'if (false)', "tests/convex/notificationEmailData.test.ts"),
    ("email-total-progress", "convex/emails/notificationEmailData.ts", 'data.totalCount = goal.themes.length;', 'data.totalCount = 0;', "tests/convex/notificationEmailData.test.ts"),
    ("goal-viewer-lock", "convex/weeklyGoals/readModels.ts", "const viewerLocked = locks[viewerRole];", 'const viewerLocked = locks["creator"];', "tests/convex/weeklyGoalReadModels.test.ts"),
    ("repetition-stale-step", "convex/weeklyGoalRepetitions/attemptMutations.ts", "step !== args.expectedStep", "step === args.expectedStep", "tests/convex/weeklyRepetitionContracts.test.ts"),
    ("repetition-due-boundary", "convex/weeklyGoalRepetitions/attemptMutations.ts", "dueAt > args.now", "dueAt >= args.now", "tests/convex/weeklyRepetitionContracts.test.ts"),
    ("repetition-ignores-content", "convex/weeklyGoalRepetitions/readModel.ts", 'bucket === "ready" && args.content.ok', 'bucket === "ready"', "tests/convex/weeklyRepetitionContracts.test.ts"),
    ("generation-count-upper-boundary", "lib/generate/requestValidation.ts", "value > SENTENCE_OVERGENERATION_MAX", "value >= SENTENCE_OVERGENERATION_MAX", "tests/lib/generate/requestBoundaries.test.ts"),
    ("generation-request-dispatch", "lib/generate/requestValidation.ts", '"sentence-theme": parseSentenceThemeRequest', '"sentence-theme": parseThemeRequest', "tests/lib/generate/requestBoundaries.test.ts"),
    ("generation-theme-price", "app/api/generate/generationService.ts", 'theme: LLM_WORD_THEME_CREDITS', 'theme: LLM_FIELD_REGEN_CREDITS', "tests/api/generationCreditCosts.test.ts"),
    ("tts-await-error-boundary", "app/api/tts/route.ts", "return await generateLiveTtsResponse(text);", "return generateLiveTtsResponse(text);", "tests/api/ttsRoute.credits.test.ts"),
    ("tts-refund-transaction", "app/api/tts/ttsService.ts", "creditTransactionId: transaction.creditTransactionId", 'creditTransactionId: "wrong-transaction"', "tests/api/ttsRoute.credits.test.ts"),
    ("proxy-authentication", "proxy.ts", "if (!authObj.userId)", "if (authObj.userId)", "tests/proxy.test.ts"),
    ("provider-failure-status", "netlify/functions/critical-provider-health.mjs", 'JSON.stringify({ ok: false }), { status: 500 }', 'JSON.stringify({ ok: false }), { status: 200 }', "tests/netlify/providerHealth.test.ts"),
    ("provider-ignore-rejection", "netlify/functions/critical-provider-health.mjs", 'result.status === "rejected"', 'result.status === "fulfilled"', "tests/netlify/providerHealth.test.ts"),
    ("mock-generation-count-boundary", "app/api/mocks/theme-sentences/route.ts", 'body.sentenceCount <= 20', 'body.sentenceCount < 20', "tests/api/mockSentenceGeneration.test.ts"),
    ("skip-completion-race", "app/duel/[duelId]/hooks/useDuelCountdown.ts", 'countdown === null || countdown === 0 || phase !== "transition"', 'countdown === null || phase !== "transition"', "tests/hooks/useDuelTimers.test.ts"),
    ("skip-with-one-participant", "app/duel/[duelId]/hooks/useDuelCountdown.ts", 'includes("challenger") && countdownSkipRequestedBy.includes("opponent")', 'includes("challenger") || countdownSkipRequestedBy.includes("opponent")', "tests/hooks/useDuelTimers.test.ts"),
    ("timeout-repeat-write", "app/duel/[duelId]/hooks/useDuelQuestionTimer.ts", 'remaining <= 0 && !hasTimedOutRef.current', 'remaining <= 0', "tests/hooks/useDuelTimers.test.ts"),
    ("timeout-ignore-answer", "app/duel/[duelId]/hooks/useDuelQuestionTimer.ts", 'if (!myAnswered)', 'if (true)', "tests/hooks/useDuelTimers.test.ts"),
    ("ignore-pause-time", "app/duel/[duelId]/hooks/useDuelQuestionTimer.ts", 'questionTimerPausedAt ?? Date.now()', 'Date.now()', "tests/hooks/useDuelTimers.test.ts"),
    ("shared-goal-missing-partner", "lib/weeklyGoals.ts", "partnerId === undefined || partnerLocked === undefined", "partnerId === undefined && partnerLocked === undefined", "tests/lib/weeklyGoalContracts.test.ts"),
    ("lock-day-boundary", "lib/weeklyGoals.ts", "goal.endDate - now < MIN_GOAL_DURATION_MS", "goal.endDate - now <= MIN_GOAL_DURATION_MS", "tests/lib/weeklyGoalContracts.test.ts"),
    ("grace-delete-boundary", "lib/weeklyGoals.ts", "now < deleteAt", "now <= deleteAt", "tests/lib/weeklyGoalContracts.test.ts"),
    ("shared-lock-activates-early", "lib/weeklyGoals.ts", "if (otherLocked)", "if (!otherLocked)", "tests/lib/weeklyGoalContracts.test.ts"),
    ("duplicate-second-round", "lib/themes/themeUiValidation.ts", "[issue.firstRoundIndex, issue.secondRoundIndex]", "[issue.firstRoundIndex]", "tests/lib/sentenceThemeUiValidation.test.ts"),
    ("duplicate-second-distractor", "lib/themes/themeUiValidation.ts", "[issue.firstDistractorIndex, issue.secondDistractorIndex]", "[issue.firstDistractorIndex]", "tests/lib/sentenceThemeUiValidation.test.ts"),
    ("overwrite-first-error", "lib/themes/themeUiValidation.ts", "if (slot.issueMessage === null)", "if (true)", "tests/lib/sentenceThemeUiValidation.test.ts"),
    ("wrong-spanish-field", "lib/themes/themeUiValidation.ts", 'spanish_empty: "spanish"', 'spanish_empty: "english"', "tests/lib/sentenceThemeUiValidation.test.ts"),
    ("missing-count-highlight", "lib/themes/themeUiValidation.ts", "length: issue.actualCount", "length: 0", "tests/lib/sentenceThemeUiValidation.test.ts"),
    ("unique-silently-first", "tests/convex/testUtils/inMemoryDb.ts", "resultRows.length > 1", "resultRows.length > 999", "tests/testUtils/inMemoryDb.test.ts"),
    ("more-generation-review-count", "app/themes/hooks/useGenerateMore.ts", "count: GENERATE_MORE_PICK_AND_PRUNE_WORD_COUNT,", "count: 9,", "tests/hooks/useGenerateMore.test.ts"),
    ("word-generation-review-route", "app/themes/hooks/useThemeGenerationController.ts", 'themeGenerator.reset();\n        params.setViewMode(VIEW_MODES.PICK_AND_PRUNE_REVIEW);', 'themeGenerator.reset();\n        params.setViewMode(VIEW_MODES.DETAIL);', "tests/hooks/useThemesController.test.ts"),
    ("more-generation-review-route", "app/themes/hooks/useThemeGenerationController.ts", 'setShowGenerateMoreModal(false);\n        params.setViewMode(VIEW_MODES.PICK_AND_PRUNE_REVIEW);', 'setShowGenerateMoreModal(false);\n        params.setViewMode(VIEW_MODES.DETAIL);', "tests/hooks/useThemesController.test.ts"),
    ("editor-complete-response-boundary", "lib/themes/api.ts", 'if (!validate(payload.data)) {', 'if (false) {', "tests/hooks/useWordEditorResponseContract.test.ts"),

]

def main():
    if not os.environ.get('VERIFICATION_SESSION_ROOT'):
        raise SystemExit(subprocess.call(['python3', 'scripts/verification-session.py', 'mutations', *sys.argv[1:]]))
    destination = Path("reports/quality/mutations")
    destination.mkdir(parents=True, exist_ok=True)
    results = json.loads((destination / "results.json").read_text()) if (destination / "results.json").exists() else []
    for name, file, before, after, test in CASES:
        if len(sys.argv) > 1 and name not in sys.argv[1:]:
            continue
        results = [result for result in results if result["name"] != name]
        source = Path(file)
        original = source.read_bytes()
        text = original.decode()
        if text.count(before) != 1:
            raise RuntimeError(f"Mutation {name} requires exactly one matching source span")
        report = destination / f"{name}.json"
        if report.exists():
            report.unlink()
        try:
            source.write_text(text.replace(before, after))
            command = ["npm", "run", "test:run", "--", test, "--reporter=json", f"--outputFile={report}"]
            with (destination / f"{name}.log").open("w") as log:
                run = subprocess.run(command, stdout=log, stderr=subprocess.STDOUT,
                    env={**os.environ, "NODE_OPTIONS": "--no-experimental-webstorage"}, timeout=60)
            evidence = json.loads(report.read_text()) if report.exists() else {}
            failed = [a for suite in evidence.get("testResults", []) for a in suite.get("assertionResults", []) if a["status"] == "failed"]
            # Only ordinary assertion failures count as detected, never import/setup crashes.
            detected = any(any(marker in "\n".join(a.get("failureMessages", [])) for marker in ("AssertionError:", "at Assertion.__VITEST_REJECTS__", "at Assertion.__VITEST_RESOLVES__")) for a in failed)
            outcome = "detected" if detected else "surviving" if run.returncode == 0 else "errored"
            results.append(dict(name=name, file=file, before=before, after=after, test=test,
                outcome=outcome, exitCode=run.returncode, failedAssertions=[a["fullName"] for a in failed],
                originalSha256=hashlib.sha256(original).hexdigest()))
        except subprocess.TimeoutExpired:
            results.append(dict(name=name, file=file, outcome="timed-out"))
        finally:
            source.write_bytes(original)
        results[-1]["restored"] = source.read_bytes() == original
        (destination / "results.json").write_text(json.dumps(results, indent=2) + "\n")
        print(name, results[-1]["outcome"], flush=True)
    return 0 if results and all(r["outcome"] == "detected" and r["restored"] for r in results) else 1

if __name__ == "__main__":
    import signal
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(143))
    raise SystemExit(main())
