# Vercel React Best Practices Review
Date: 2026-01-31
Scope: Next.js app (`app/`), UI components (`app/components/`), shared code (`hooks/`, `lib/`), backend (`convex/`), API routes.

## Chunk map
- App routes/pages: `app/**/page.tsx`, `app/layout.tsx`, `app/api/**`
- UI components: `app/components/**`
- Shared hooks & libs: `hooks/**`, `lib/**`
- Backend/server logic: `convex/**`

## Findings by chunk (updated 2026-02-02)

### App routes/pages (`app/`)
- `app/duel/[duelId]/page.tsx` — `async-dependencies`: still a duel→theme waterfall. `getTheme` waits on `duelData?.duel?.themeId`. Combine on server or query that returns both.  
- `app/classic-duel/[duelId]/page.tsx` — `async-dependencies`: still a duel→theme waterfall.  
- `app/duel/learn/[duelId]/page.tsx` — `async-dependencies`: still a duel→theme waterfall.  
- `app/goals/page.tsx` — `async-parallel`: still awaits `addTheme` inside a loop; batch with `Promise.all` (keep slot/dup guard).  
- `app/page.tsx` — `bundle-dynamic-imports`: fixed. Modals are `next/dynamic`.  
- `app/themes/page.tsx` — `bundle-dynamic-imports`: fixed. Detail/editor/modals are `next/dynamic` and gated by view mode.  
- `app/goals/page.tsx` — `bundle-dynamic-imports`: fixed. `GoalThemeSelector` is `next/dynamic`.  
- `app/layout.tsx` — `bundle-conditional`: unchanged; still worth scoping providers if feasible.  
- `app/friends/page.tsx` — `bundle-barrel-imports`: still uses `./components` barrel (`SearchBar`, `UserCard`, `RequestsList`, `FriendsList`).  
- `app/settings/page.tsx` — `bundle-barrel-imports`: still uses `./components` barrel.  
- `app/themes/page.tsx` — `bundle-barrel-imports`: still uses `./components` and `./hooks` barrels.  
- `app/duel/[duelId]/page.tsx` — `bundle-barrel-imports`: still uses `./components` and `./hooks` barrels.  
- `app/duel/learn/[duelId]/page.tsx` — `bundle-barrel-imports`: still uses `./components` barrel.  
- `app/solo/[sessionId]/page.tsx` — `bundle-barrel-imports`: still uses `./components` barrel.  
- `app/solo/learn/[sessionId]/page.tsx` — `bundle-barrel-imports`: still uses `./components` barrel.  
- `app/study/page.tsx` — `bundle-barrel-imports`: still uses `./components` barrel.  
- `app/solo/learn/[sessionId]/page.tsx` — `rendering-content-visibility`: still long list of cards; consider `content-visibility` or virtualization (note: `app/study/page.tsx` already uses `react-window`).  

### UI components (`app/components/`)
- `app/components/ThemedPage.tsx` — `rerender-use-ref-transient-values`: fixed. Scroll state moved to refs + rAF/timers; no state churn.  
- `app/components/modals/index.ts` (and usage in `app/notifications/components/FriendsTab.tsx`) — `bundle-barrel-imports`: still applies in `FriendsTab` (imports `UnifiedDuelModal`, `WaitingModal`, `JoiningModal` from barrel).  
- `app/components/modals/DuelModal.tsx`, `app/components/modals/SoloStyleDuelModal.tsx` — `rerender-memo`: still likely; selectors are memoized, but parent state changes still re-render lists.  
- `app/components/modals/ModalShell.tsx`, `app/components/modals/SoloModal.tsx`, `app/components/modals/UnifiedDuelModal.tsx`, `app/components/modals/DuelModal.tsx`, `app/components/modals/ModeSelectionButton.tsx` — `rendering-conditional-render`: many `&&` remain (example in `app/page.tsx` modals).  

### Shared hooks/libs (`hooks/`, `lib/`)
- `lib/themes/index.ts`, `lib/sabotage/index.ts` — `bundle-barrel-imports`: still applies; both are wildcard barrels.  
- `lib/themes/api.ts` — `client-swr-dedup`: still applies (not re-checked in detail; no evidence of SWR cache introduced).  
- `hooks/useSyncUser.ts` — `rerender-dependencies`: fixed. Uses memoized payload + `lastSyncedKeyRef` guard.  
- `hooks/usePresence.ts` — `client-event-listeners`: still applies; each hook use sets up interval + `visibilitychange` listener.  

### Backend/server logic (`convex/`, `app/api/`)
Mapped to Vercel rules as: `async-parallel` / `server-parallel-fetching` for N+1 or serial awaits; `server-serialization` for oversized payloads.

- `convex/themes.ts` — partially fixed. Owner lookups now batched. Still per-friend shared theme fetch (Promise.all), and per-friend theme queries can be heavy; consider denormalization or a shared-themes index. (`async-parallel`, `server-parallel-fetching`)  
- `convex/lobby.ts` — updated: uses `Promise.all` for challenger/opponent on `getDuel` and batches challengers for pending duels. Main N+1 reduced; monitor query counts if pending list grows.  
- `convex/friends.ts` — fixed. Uses batched `loadUsersById` for requests/friends.  
- `convex/weeklyGoals.ts` — fixed. Uses batched `loadUsersByGoalParticipants`.  
- `convex/notifications.ts` — fixed. Sender lookups are batched in `enrichNotificationsWithSender`.  
- `convex/notifications.ts`, `convex/friends.ts` — unbounded collect/scan + in-memory filtering: reduced, but still present in some flows; keep an eye on dataset size.  
- `app/api/generate/route.ts` — check needed. No obvious prompt echoing in responses from a quick scan; verify response payloads if this was a concern.  

## Top priorities (suggested, updated)
1) Fix waterfalls in duel pages (`async-dependencies`) and batch mutations in `app/goals/page.tsx`.
2) Remove barrel imports in hot client paths (`bundle-barrel-imports`), including `app/page.tsx`, `app/themes/page.tsx`, `app/friends/page.tsx`, `app/settings/page.tsx`, `app/duel/*`, `app/solo/*`, `app/study/*`, and `app/notifications/components/FriendsTab.tsx`.
3) Keep pushing Convex N+1 reductions (themes: shared/friend lookups; any remaining in-memory scans).
4) Consider `content-visibility`/virtualization for large list views (solo learn).

