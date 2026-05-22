# Reusable UI Components / Shared Hooks Review

Review scope: **Reusable UI Components / Shared Hooks**

Principles reviewed:

- Single Responsibility
- Right Logic In Right Layer
- No Duplication Of Rules
- Testable Business Logic
- Clear Boundaries
- Clear Naming
- Avoid Hidden Side Effects

This review was performed using 7 default worker subagents, one per principle, in pure review mode. No files were changed during the review.

## Must

| Issue | Area |
|---|---|
| `useThemesController` is a god hook: data loading, mutations, routing, modals, TTS, generation, editing, prop assembly | `app/themes/hooks/useThemesController.ts` |
| Solo practice business rules are embedded in React hook instead of testable pure logic | `app/solo/[sessionId]/hooks/useSoloSession.ts` |
| Solo session auto-advance timers are not cleanup-safe | `app/solo/[sessionId]/hooks/useSoloSession.ts` |
| Sabotage effect hook has untracked timers and gameplay phase rules mixed with React effects | `app/duel/[duelId]/hooks/useSabotageEffect.ts` |
| `useChallengeLobby` mixes modal state, Convex calls, routing, toasts, waiting status, and solo launch behavior | `hooks/useChallengeLobby.ts` |
| Theme name normalization is duplicated across UI/hooks despite existing server helper | `ThemeDetail.tsx`, `useThemeActions.ts`, `useThemesController.ts`, `lib/themes/serverValidation.ts` |
| TTS provider type/default/options are duplicated across settings, game hook, preferences, and API | `useTTSProvider.ts`, `TTSProviderSelector.tsx`, `useTTS.ts`, `UserPreferencesProvider.tsx`, `app/api/tts/route.ts` |
| Notification preference normalization is duplicated frontend/backend | `useNotificationSettings.ts`, `convex/notificationPreferences.ts` |
| Visual styling `ThemeProvider` conflicts with product term `Theme` as learning content | `app/components/ThemeProvider.tsx`, `ThemedPage.tsx` |
| Weekly “plan” naming conflicts with product term “weekly goal” | `PlanSwitcher.tsx`, notification hooks/components |
| `useThemeActions.update` hides uppercase normalization side effect | `app/themes/hooks/useThemeActions.ts` |
| Word edit/generation rules are split between `useWordEditor` and `useThemesController` | `useWordEditor.ts`, `useThemesController.ts` |

## Might

| Issue | Area |
|---|---|
| `ThemeDetail` combines header, sharing controls, TTS, word list, validation, actions, and modals | `app/themes/components/ThemeDetail.tsx` |
| `WordCard` mixes rendering, validation, TTS, and edit/delete actions | `ThemeDetail.tsx` |
| `DuelView` combines layout, game display derivation, sabotage UI, timer, hints, answers, and results | `app/duel/[duelId]/components/DuelView.tsx` |
| Answer rendering logic is repeated across normal/bounce/trampoline modes | `DuelView.tsx` |
| `AnswerOptionButton` mixes game-state logic with styling | `AnswerOptionButton.tsx` |
| `ThemeSelector` silently fetches weekly-goal data and renders markers | `app/components/modals/ThemeSelector.tsx` |
| `ChallengeModal` duplicates theme selector logic and weekly-goal marker coupling | `ChallengeModal.tsx` |
| `FriendsTab` owns queries, mutation, toasts, and weekly-goal relationship checks | `FriendsTab.tsx` |
| `AddFriendSection` directly owns search query and send-friend-request mutation | `AddFriendSection.tsx` |
| `NotificationItem` mixes notification domain mapping with rendering | `NotificationItem.tsx` |
| `FriendListItem` mixes row display, context menu, portal, long-press, and remove confirmation | `FriendListItem.tsx` |
| `FriendListItem` long-press timer lacks unmount cleanup | `FriendListItem.tsx` |
| `auth.tsx` contains nav, notifications, and presence side effects, not just auth | `app/components/auth.tsx` |
| `usePresence` name hides recurring backend heartbeat mutation | `hooks/usePresence.ts` |
| `usePresence` uses module-level singleton state | `hooks/usePresence.ts` |
| `useNotificationPanel` globally mutates body scroll state | `useNotificationPanel.ts` |
| `NotificationPanel` click-outside behavior depends on global aria-label query | `NotificationPanel.tsx` |
| `useTTS` mixes provider lookup, cache, fetch, object URLs, audio playback, and toasts | `app/game/hooks/useTTS.ts` |
| `useTTS` uses `wordKey` naming for generic audio playback | `useTTS.ts` |
| Reverse/bounce/trampoline sabotage hooks have some hard-to-test animation/physics logic inside hooks | `app/game/sabotage/hooks/*` |
| Persistent sabotage effect classification is hardcoded in multiple places | `useSabotageEffect.ts`, sabotage options/types |
| `useThemeGenerator` file exports multiple distinct generation hooks | `useThemeGenerator.ts` |
| `useThemeGenerator` returns `null` for multiple failure reasons instead of explicit result | `useThemeGenerator.ts` |
| `useWordEditor` mixes manual edit state, AI generation, regeneration, rejected words, and modal state | `useWordEditor.ts` |
| `GoalThemeSelector` embeds weekly-goal capacity rule in component | `GoalThemeSelector.tsx` |
| `RepetitionBoard` mixes query, navigation, formatting, tab state, and presentation | `RepetitionBoard.tsx` |
| User display-name formatting is inconsistent across shared surfaces | `ChallengeModal.tsx`, `FriendListItem.tsx`, `PlanSwitcher.tsx` |
| Theme modal shell styles are duplicated instead of using `ModalShell` | theme modal components |
| `SoloMode` is duplicated instead of importing shared type | `SoloPracticeModal.tsx`, `lib/soloNavigation.ts` |
| `FriendDuelLauncher` naming says duel but actually opens challenge flow | `FriendDuelLauncher.tsx` |
| `useWeeklyGoalThemeIds` name hides that it only reads visible goals | `hooks/useWeeklyGoalThemeIds.ts` |

## Ignore / Low Priority

| Issue | Reason |
|---|---|
| Field max-length checks duplicated between hook/component/modal | Mostly acceptable layered defense because shared constants are used |
| Solo modal initial theme filtering duplicates a tiny local filter | Low-risk local cleanup only |
| Small primitives like `Avatar`, `BackButton`, `ExitButton`, `FormError`, `MenuButton`, `ModalShell` | Generally clean and focused |
| Settings controls/hooks like nickname, TTS provider selector, notification toggles | Mostly clear and focused |
| Sabotage animation constants largely reuse shared constants | No major duplication beyond persistent-effect classification |
