# Clean-Code Review Audit — 2026-05-15

## What this file is

A point-in-time audit of the 4 existing clean-code review docs in `Dev/`, checking how much of each review's "Must" items has actually been fixed vs. how much still applies. Run by 2 independent code-review subagents (gpt-55-high + opus-47-high) per area, then aggregated. Both agents reached the same conclusions on every item — strong agreement.

**Source review docs audited:**
- `Dev/weekly-goals-boss-repetition-clean-code-review.md`
- `Dev/themes-theme-editing-theme-access-clean-code-review.md`
- `Dev/ai-generation-tts-external-apis-clean-code-review.md`
- `Dev/reusable-ui-components-shared-hooks-review.md`

**Note:** These are the 4 areas that already had review files. The other 4 areas (Game/Solo/Duel Runtime, Notifications/Email/Preferences, Friends/Challenges/User Relationships, Shared Pure Logic/Utilities) have no `.md` review yet and were NOT audited here.

**Repo HEAD at audit time:** `227e861`.

---

## Area 1: Weekly Goals / Boss / Repetition

| # | Issue | Status |
|---:|---|---:|
| 1 | `weeklyGoals.ts` doing too much (1,647 LOC) | STILL APPLIES |
| 2 | `lockGoal` mixes rules/persistence/snapshots/notifs/emails | STILL APPLIES |
| 3 | `completeWeeklyGoalBoss` hides big-boss lifecycle effects | STILL APPLIES |
| 4 | Opening `/goals` page mutates+deletes backend data | STILL APPLIES |
| 5 | Theme completion rule only in UI, not enforced server-side | STILL APPLIES |
| 6 | Snapshot loader silently falls back to live themes | STILL APPLIES |
| 7 | Gameplay layer still calls boss/SR completion mutators | PARTIAL |
| 8 | SR still uses `bossLivesTotal/Remaining` + `getBossMissPatch` | STILL APPLIES |
| 9 | Challenge/duel optional-field combos are unsafe | STILL APPLIES |
| 10 | `weeklyGoalRepetitions.ts` over-broad (681 LOC) | STILL APPLIES |
| 11 | Repetition readiness modeling | PARTIAL |
| 12 | Old `weekly_plan` naming | FIXED |
| 13 | `bossStatus` really means Big Boss | STILL APPLIES |
| 14 | Friend removal deletes weekly goal data | STILL APPLIES |
| 15 | `MAX_THEMES_PER_GOAL` duplicated | STILL APPLIES |

**Highest-leverage next steps:** Split `lockGoal` + `completeWeeklyGoalBoss` (#2, #3). Rename `bossLives*` → neutral `lives*` + discriminated source contracts (#8, #9). Move goal-page cleanup off page-load (#4) and enforce server-side completion rule (#5).

---

## Area 2: Themes / Theme Editing / Theme Access

| # | Issue | Status |
|---:|---|---:|
| 1 | Theme edit permission too broad (no friendship check) | STILL APPLIES |
| 2 | TTS reuses same weak edit permission | STILL APPLIES |
| 3 | `duplicateTheme` bypasses access checks | STILL APPLIES |
| 4 | `getTtsStorageUrl` has no theme access boundary | STILL APPLIES |
| 5 | `useThemesController` too broad (~1100 LOC) | PARTIAL |
| 6 | `convex/themes.ts` is a god module | PARTIAL |
| 7 | List vs detail theme access can drift | STILL APPLIES |
| 8 | Theme word-count validation duplicated | STILL APPLIES |

**Security-flavored.** Must #1–4 are real access/auth correctness issues:
- Any authenticated user can edit/TTS-spend on a "shared" theme without being a friend (#1, #2).
- Any authenticated user can `duplicateTheme` of any theme by ID (#3).
- Any authenticated user can resolve any TTS storage URL by ID (#4).

**Highest-leverage next steps:** Tighten edit/TTS permission to require a real friendship lookup (#1, #2). Gate `duplicateTheme` and `getTtsStorageUrl` through `loadThemeWithViewerAccess` (#3, #4).

---

## Area 3: AI Generation / TTS / External APIs

| # | Issue | Status |
|---:|---|---:|
| 1 | TTS storage URL auth too weak | STILL APPLIES |
| 2 | Stored theme TTS ignores user provider preference | STILL APPLIES |
| 3 | Credit check/consume not atomic | STILL APPLIES |
| 4 | `/api/generate/route.ts` does too much (783 LOC) | STILL APPLIES |
| 5 | `/api/tts/route.ts` does too much (460 LOC) | STILL APPLIES |
| 6 | `generateThemeTTS` hides many side effects | STILL APPLIES |
| 7 | Theme TTS racing on shared themes (user-scoped lock) | STILL APPLIES |
| 8 | Prompts leaked in all client responses | STILL APPLIES |
| 9 | Word-type rules are prompt-only, not validated | STILL APPLIES |
| 10 | Resemble implemented twice with divergent configs | STILL APPLIES |
| 11 | `updateTheme` deletes storage as hidden side effect | STILL APPLIES |
| 12 | `getOrCreateResemblePreset` hidden side effects | STILL APPLIES |

**Worst-cleaned area — all 12 Must items still apply.** Recent commit `192b20c` added semantic validation but did not touch the structural problems.

**Highest-leverage next steps:** Atomic credits (reserve/finalize/refund) + auth on storage URL (#1, #3). Theme-scoped TTS lock + provider preference unification (#2, #7). Decompose mega-routes + share one Resemble adapter (#4, #5, #6, #10).

---

## Area 4: Reusable UI Components / Shared Hooks

| # | Issue | Status |
|---:|---|---:|
| 1 | `useThemesController` god hook (1,102 LOC) | STILL APPLIES |
| 2 | Solo practice rules embedded in React hook | STILL APPLIES |
| 3 | Solo auto-advance timers not cleanup-safe | STILL APPLIES |
| 4 | Sabotage hook timers + phase rules mixed | PARTIAL |
| 5 | `useChallengeLobby` multi-responsibility | PARTIAL |
| 6 | Theme name normalization duplicated (toUpperCase) | STILL APPLIES |
| 7 | TTS provider type/default duplicated 5+ places | STILL APPLIES |
| 8 | Notification prefs normalization duplicated | FIXED |
| 9 | `ThemeProvider` (visual) collides with product Theme | PARTIAL |
| 10 | Weekly "plan" naming conflicts | FIXED |
| 11 | `useThemeActions.update` hides uppercase side effect | STILL APPLIES |
| 12 | Word edit/generation rules split between two hooks | STILL APPLIES |

**Cheapest wins live here.** Many small, low-risk cleanups.

**Highest-leverage next steps:** Delete all client-side `.toUpperCase()` on theme names — server `normalizeThemeName` is the single rule (#6, #11). Extract `lib/solo/*` pure rules + wrap solo `setTimeout`s with cleanup (#2, #3). Single shared `lib/ttsProvider.ts` (#7).

---

## What's actually fixed across all 4 areas

Only 3 things are fully fixed:
1. Weekly "plan" → "weekly goal" naming.
2. Notification preferences normalization (now shared lib).
3. User display-name formatting (`formatVisibleUser` shared across surfaces).

Everything else is either PARTIAL or STILL APPLIES.

---

## Recommended order if attacking these

By ROI:
1. **Themes Must #1–4** (security correctness) — small surface, big impact.
2. **AI/TTS Must #1 + #8** (storage URL auth + stop leaking prompts) — same idea, security-driven.
3. **Reusable UI Must #6 + #11** (delete client `.toUpperCase()`) — single trivial cleanup closes 2 items.
4. **Weekly Goals Must #2, #3, #8, #9** — biggest structural cleanup, unblocks the rest.

By area total workload (heaviest first):
1. AI/TTS (12/12 still apply).
2. Weekly Goals (huge structural refactor).
3. Themes (security + medium structural).
4. Reusable UI (many small wins).
