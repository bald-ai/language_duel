# Weekly Boss

## Why

- **Motivation** — A climactic goal to aim for, not just "do words every day." Gives the week a narrative arc: learn → mini boss → boss.
- **Immersion** — Forces engagement with a large chunk of words at once, creating the feeling of actually knowing something.
- **Spaced repetition** — The boss naturally re-tests words from earlier in the week. Mini boss at midpoint adds a second repetition pass.
- **Pacing discovery** — Might reveal that 1-2 duels per week with a boss is the right cadence, rather than daily grind that burns out.

## Structure

### Weekly Goal Changes

- **Minimum 2 themes** to lock a weekly goal (bosses need enough material to draw from).
- **Custom end date** — Date picker to set when the goal ends. Midpoint is always auto-calculated as half the total duration rounded down (e.g. 7 days → day 3). The end date can be edited while the goal is still in progress, but not once the big boss becomes available or the end date has been reached.
- **Manual trigger** — Once enough themes are completed, players can trigger boss/mini boss. No date gate — progression is theme-driven.
- **Progression lock** — Mini boss must be completed before the big boss unlocks.
- **Theme completion rule** — A theme counts as completed only when **both players** have it checked off.

### Mini Boss (Midpoint)

- Unlocks when **floor(total themes / 2)** themes are completed by both players. The midpoint date is shown as a reference but does not trigger the unlock.
- Draws from the completed themes available at that point.
- Lighter than the boss. Tests retention of the first half of the week.

### Big Boss (End)

- Fires at the goal end date or triggered manually (only after mini boss is done).
- Early unlock happens only when **all themes** are completed by both players and mini boss is already completed.
- Draws from **all themes** in the weekly goal.
- Uses the full variety mix from VARIETY.md — random exercise types, directions, sentence exercises, speed rounds, match pairs. The variety IS the boss.

## Technical Requirements

### Multi-Theme Duels / Solo Challenges

The boss requires pulling words from multiple themes into a single session. This doesn't exist yet — current duels are single-theme only.

**This should be built as a general feature**, not boss-specific:
- Any duel or solo challenge can optionally use multiple themes.
- Theme selection UI allows picking 1+ themes.
- A single session can use words from multiple selected themes while keeping each word tied to its original theme.
- Useful outside of goals too — "let's duel on all our animal + food themes at once."

### New UI / Components Needed

- **Date picker** — For setting weekly goal end date.
- **Mini boss trigger button** — Manual "Start Mini Boss" action when its own prerequisites are met.
- **Big boss trigger button** — Manual "Start Big Boss" action when its own prerequisites are met (mini boss done, all themes completed).
- **Boss lobby / intro screen** — Something that feels different from a normal duel. The boss should feel like an event, not just another round.
- **Progress indicator** — Visual showing mini boss → boss progression within the weekly goal.

### Schema / Backend Changes

- Weekly goal needs: end date, mini boss status (locked/available/completed), boss status (locked/available/completed), plus a clear distinction between goal lifecycle and boss progression. Midpoint is derived at read time (`floor(duration / 2)` days from start), not stored.
- Challenge table needs: multi-theme support. Best implementation path is to add `themeIds` and migrate all challenge creation/read paths to use it, while doing a one-time migration/backfill of existing single-theme rows.
- Word loading logic for multiple themes, preserving each word's source theme, and shuffling deterministically.

## Recommended V1 Decisions

These choices keep scope tight and give us a shippable version fast:

- **Boss v1 is a goal-specific classic duel** using multiple themes. Both players play it together in real time. A separate solo practice option exists, but practice does not affect boss progression.
- **No fail state in v1.** The boss should feel climactic, not punishing. We can add lives later if the feature already proves fun.
- **Use the existing exercise flow first.** The first release should prove multi-theme + goal progression works before mixing in the full VARIETY.md system.
- **Adaptive boss length.** Use a capped subset, not every word. Example rule for v1: target 20 words for mini boss, 30 words for big boss, sampled across eligible themes. If fewer words are available than the cap, use all available words.
- **Manual trigger only when prerequisites are met.** Players can go early, but they still cannot skip progression rules.
- **Completed theme = both players checked it off.**
- **Mini boss early unlock = `floor(total themes / 2)` completed themes.**
- **Big boss early unlock = all themes completed + mini boss done.**
- **Boss retries are unlimited.** Once mini boss or big boss is `available`, players can start and restart it as many times as they want.
- **A boss is defeated only by a perfect run.** For live boss duels, that means both players answer every boss question correctly. The normal duel score can still be shown, but boss completion is based on perfect correctness, not weighted points.
- **End date edits are allowed only while the goal is still in progress.** Once all themes are completed or the end date has been reached, the date is frozen.
- **Midpoint is always derived, never stored.** It equals `floor(duration / 2)` days from start. If the end date changes while still editable, midpoint updates automatically. Once the end date is frozen, midpoint is frozen too.
- **After the end date is reached, unfinished goals stay visible for up to 48 hours, then auto-delete.**
- **Auto-delete removes everything** — the weekly goal container and any associated boss session/challenge records.
- **Weekly goal `completed` means the big boss was defeated.**
- **When a goal is completed, it closes and both players get a celebratory completion notification/message.** The closed goal can then be dismissed from the UI.

## Implementation Plan

### Phase 0 — Lock the Product Rules ✅ Done

Goal: remove ambiguity before touching schema or gameplay.

What to decide and document:

- Boss v1 = classic-mode duel launched from weekly goals, with optional solo practice.
- Minimum 2 themes required before a goal can be locked.
- Weekly goal gets an explicit **end date** chosen during setup.
- End date can be edited only while the goal is still in progress. Once all themes are completed or the end date has been reached, it becomes read-only.
- Midpoint is always derived as `floor(duration / 2)` days from start (e.g. 7-day goal → day 3). It is never stored; it moves automatically if the end date is edited, and freezes when the end date freezes.
- A theme counts as completed only when both players have it checked off.
- Mini boss unlocks at midpoint or early once `floor(total themes / 2)` themes are completed.
- Big boss unlocks at end date or early only after mini boss is completed and all themes are completed.
- Once a boss is `available`, players can retry it unlimited times.
- A boss becomes `completed` only on a perfect run.
- For live boss duels, a perfect run means both players answered every boss question correctly. The normal duel score can still be displayed, but it is not the source of truth for boss completion.
- Attempts below a perfect run do not create a new boss state; they simply leave the boss `available` for another retry.
- Weekly goal `completed` means the big boss was defeated.
- If the end date passes without boss completion, keep the goal around for up to 48 hours, then auto-delete the goal and all associated boss session/challenge records.
- If the boss word cap is higher than the available merged word pool, use all available words instead of padding or failing.
- Boss word count is capped and sampled, not "all words always."

Deliverables:

- Update this doc with the final v1 product rules.
- Plain-English unlock rules (backend and UI must use the same logic):

**Mini Boss — when does it become available?**
The mini boss starts locked. It becomes available when `floor(total themes / 2)` themes are completed (both players checked off). The midpoint date is informational only — it does not unlock the mini boss by itself. This guarantees the mini boss always has completed themes to draw words from.

**Big Boss — when does it become available?**
The big boss starts locked. It becomes available when all three of these are true: (1) the mini boss has been completed, (2) all themes in the goal are completed (both players checked off on every theme), and (3) the current date has reached or passed the end date — or all themes are completed (the date gate is waived if themes are done early).

**Manual trigger — when can a player press "Start"?**
A player can start a boss only when that boss's status is `available`. If the status is `locked` or `completed`, the button is disabled. While a boss is `available`, players may retry it as many times as they want.

**Boss completion — what counts as defeating it?**
A boss is defeated only by a perfect run. For live boss duels, that means both players answered every boss question correctly. The normal duel score can still be shown to players, but it does not determine boss completion. Any attempt below a perfect run does not complete the boss and simply leaves it `available` for another retry. We do not need best-score or latest-attempt tracking for v1.

**End date — when can it be edited?**
The end date can be changed only while the goal status is `active` and the big boss status is still `locked`. Once all themes are completed, the end date is reached, or the big boss becomes available — whichever comes first — the end date becomes read-only.

**Midpoint — how is it calculated?**
Midpoint = `floor(duration / 2)` days from the start date (e.g. 7-day goal → day 3). It is never stored. It is derived from the start and end dates at read time. If the end date is edited, midpoint moves automatically. Once the end date is frozen, midpoint is frozen too.

**Goal expiry — what happens when time runs out?**
If the end date passes and the big boss has not been completed, the goal moves to `expired`. It stays visible for 48 hours, then the goal and all associated boss session/challenge records are deleted.

**Goal completion — what happens when the big boss is defeated?**
When the big boss is defeated, the weekly goal moves to `completed` immediately. The goal closes, both players receive a celebratory completion notification/message, and the closed goal can then be dismissed from the UI.

Breakpoint:

- Stop here and sanity-check the rules before schema work starts.
- If the rules still feel fuzzy, do not start Phase 1.

### Phase 0.5 — Extract Shared Challenge Creation Logic ✅ Done

Goal: eliminate duplicated challenge setup code before adding multi-theme support, so Phase 1 changes are centralized and low-risk.

Why now:

- `convex/lobby.ts` (`createDuel` + `acceptDuel`) and `convex/scheduledDuels.ts` (`startScheduledDuel`) currently duplicate challenge setup logic, but at two different lifecycle steps: initial insert and playable-state activation.
- `scheduledDuels.ts` even has a comment: `// Create duel using same logic as lobby.ts createDuel`.
- If we add `themeIds` in Phase 1 without extracting first, we duplicate the same structural changes across insert paths and activation paths, which doubles the surface for bugs.

Scope:

- Extract a shared helper for initial challenge row assembly (e.g. `buildChallengeBase`) that handles:
  - shared challenge fields
  - word order creation
  - mode/default field setup
- Extract a separate shared helper for activation/playable-state setup (e.g. `buildChallengeStartState`) that handles:
  - seed initialization
  - `questionStartTime`
  - mode-based branching (classic vs solo init)
- Refactor `lobby.ts` (`createDuel` + `acceptDuel`) and `scheduledDuels.ts` (`startScheduledDuel`) to use the appropriate shared helper(s).
- No behavior changes — pure refactor.

Breakpoint:

- All existing flows (immediate duel, scheduled duel, solo, classic) still work identically.
- Run lint, typecheck, and existing tests before moving on.

### Phase 1 — Build Multi-Theme Session Foundations ✅ Done

Goal: make "one session from many themes" a real platform feature, because Weekly Boss depends on it.

#### Key decision: denormalized word list

Store a flat `sessionWords` array directly on the challenge row. Each entry carries its word data plus the source `themeId` and `themeName`. This means gameplay reads never need to fetch theme documents — everything needed to run a question is already on the challenge.

Why:
- Gameplay reads are the hot path. Fetching N themes per question adds latency and failure modes.
- Word data is small. Duplicating it on the challenge is cheap.
- The source theme can be renamed or deleted after the session starts without breaking in-progress games.
- Simplifies the word-index model: `wordOrder[i]` indexes into `sessionWords[i]`, same as today but the array is self-contained.

Shape of a session word entry:
```ts
{
  word: string;          // the prompt (e.g. Spanish word)
  answer: string;        // the correct answer
  wrongAnswers: string[];
  themeId: Id<"themes">;
  themeName: string;     // snapshot at session creation time
}
```

Gameplay logic indexes into `sessionWords` the same way it currently indexes into `theme.words`. The only difference is the data lives on the challenge, not on a separate theme document.

#### Scope

- Add `themeIds: v.array(v.id("themes"))` and `sessionWords` to the challenges table.
- `buildChallengeBase` (from Phase 0.5) accepts `themeIds` + builds `sessionWords` from the provided themes.
- Single-theme flows pass `[themeId]` — same code path, one-item list.
- Gameplay reads (`gameplay.ts`, `hints.ts`) switch from `theme.words[index]` to `duel.sessionWords[index]`. They no longer need to fetch the theme document for word data.
- `getDuel` in `lobby.ts` still fetches theme docs for metadata (name, ownership) but not for word content.
- Backfill migration: internal mutation reads all existing challenges, builds `sessionWords` from the theme doc, sets `themeIds: [themeId]`. Run locally during dev, run on production at the end of the project.
- After migration + switchover, remove `themeId` from challenge creation paths. Keep it on the schema as `v.optional` until production migration is confirmed.

`scheduledDuels` table also needs `themeIds`. Scheduled duels don't store words — they just reference which themes to use. Words get snapshot into `sessionWords` when the challenge is actually created (in `startScheduledDuel`).

#### UI changes

- Convert `ThemeSelector` from single-click-to-select to a **checkbox-style multi-select with a Confirm button**.
- Apply the multi-select UI to **all flows**: `SoloModal`, `UnifiedDuelModal` (`CompactThemeSelector`), and `ScheduledDuelPickers` (`CompactThemePicker`).
- During gameplay, only when multiple themes are selected, display the **theme name only** near the word (e.g. above it) so the player knows which theme context the word belongs to. Read `themeName` from `sessionWords[currentIndex]`. Not shown for single-theme sessions.

#### Concrete code areas

- `convex/schema.ts` — add `themeIds`, `sessionWords` to challenges; add `themeIds` to scheduledDuels
- `convex/helpers/challengeCreation.ts` — `buildChallengeBase` accepts `themeIds`, builds `sessionWords`
- `convex/gameplay.ts` — read from `duel.sessionWords` instead of fetching theme
- `convex/hints.ts` — same switch
- `convex/lobby.ts` — pass `themeIds` to `buildChallengeBase`, update `getDuel`
- `convex/scheduledDuels.ts` — pass `themeIds`, update proposals/acceptance
- `app/components/modals/ThemeSelector.tsx` — multi-select
- `app/components/modals/SoloModal.tsx` — `themeIds` instead of `themeId`
- `app/components/modals/UnifiedDuelModal.tsx` — `themeIds` instead of `themeId`
- `app/notifications/components/ScheduledDuelPickers.tsx` — `themeIds` instead of `themeId`
- Migration script (new file)

#### Implementation order

1. Schema: add `themeIds` (required) and `sessionWords` (required) to challenges. Add `themeIds` to scheduledDuels. Keep old `themeId` as `v.optional` during transition.
2. `buildChallengeBase`: accept themes array, build `sessionWords`, set `themeIds`.
3. Update `lobby.ts` and `scheduledDuels.ts` callers to pass themes.
4. Switch gameplay reads (`gameplay.ts`, `hints.ts`) from `theme.words` to `duel.sessionWords`.
5. Write + run backfill migration for existing challenge rows.
6. UI: convert ThemeSelector to multi-select, update SoloModal / UnifiedDuelModal / ScheduledDuelPickers.
7. UI: show `themeName` during multi-theme gameplay.
8. Clean up: remove old `themeId` from creation paths (keep on schema as optional until production migration).

Steps 1–5 are backend, can be verified independently. Steps 6–7 are frontend. Step 8 is cleanup.

#### Breakpoint

- Shipable checkpoint: a normal solo challenge can run from 2+ themes without weekly goals involved.
- Verify:
  - `sessionWords` contains words from all selected themes with correct `themeId` and `themeName`
  - gameplay reads use `sessionWords`, not theme fetches
  - the source theme name displays next to each word during multi-theme gameplay, and this label is not shown for single-theme sessions
  - existing single-theme flows still work (single-item `themeIds` array)
  - backfill migration works on existing challenge rows
- Run lint, typecheck, and focused session/gameplay tests before moving on.

### Phase 2 — Extend Weekly Goal Data and Unlock Logic ✅ Done

Goal: teach weekly goals about time windows and boss progression.

#### Decisions from review

- **No active goals exist**, so no migration needed — schema changes apply to new goals only.
- **`expiresAt` → `endDate`**: Replace the old `expiresAt` field (auto-computed as `lockedAt + 7 days`) with a user-selected `endDate`. Remove `GOAL_DURATION_MS`.
- **48h grace window is derived, not stored.** Grace deadline = `endDate + 48h`. The 48h activates when `endDate` passes and the big boss has not been completed. If the boss is completed before `endDate`, the goal moves to `completed` and the 48h never triggers.
- **No boss timestamps.** Just the status enum (`locked | available | completed`) for both `miniBossStatus` and `bossStatus`. No `availableAt`, `completedAt`, or `triggeredAt`.
- **Minimum 2 themes enforced at lock time.** A player cannot lock a goal that has fewer than 2 themes. Goals start in `editing` with themes added incrementally, so creation itself has no minimum.

#### Schema changes to `weeklyGoals`

- Replace `expiresAt` with `endDate` (user-selected, required once active).
- Add `"expired"` to the status union: `editing | active | expired | completed`.
- Add `miniBossStatus: locked | available | completed` (defaults to `locked`).
- Add `bossStatus: locked | available | completed` (defaults to `locked`).
- Update index from `by_status_expiresAt` to `by_status_endDate`.

#### Backend logic

- Remove `GOAL_DURATION_MS` constant.
- `endDate` is set during goal editing, required before locking.
- Enforce minimum 2 themes at lock time.
- `endDate` is editable only while `status === "active"` and `bossStatus === "locked"`.
- Midpoint = `floor(duration / 2)` days from `lockedAt`, always derived at read time.
- Cron two-pass expiry:
  - Active goals where `endDate < now` and `bossStatus !== "completed"` → mark as `expired`.
  - Expired goals where `endDate + 48h < now` → delete goal and all associated boss session/challenge records.
- Backend query functions:
  - `isMiniBossAvailable` — checks `floor(total themes / 2)` themes completed.
  - `isBigBossAvailable` — checks mini boss completed + all themes completed.
  - `canEditEndDate` — checks `status === "active"` and `bossStatus === "locked"`.
  - `canTriggerBoss(which)` — checks the relevant boss status is `available`.
- All progression checks live on the backend as source of truth.

#### Concrete code areas

- `convex/schema.ts` — replace `expiresAt` with `endDate`, add boss status fields, update index
- `convex/weeklyGoals.ts` — lock validation, end date editing, boss availability queries, expiry logic
- `convex/constants.ts` — remove `GOAL_DURATION_MS`, add `GRACE_PERIOD_MS`
- `app/goals/constants.ts` — update if it references expiry
- notification/reminder logic that currently assumes `expiresAt`

#### Rule split

- Goal lifecycle stays separate from boss lifecycle.
- Weekly goal remains the container.
- Boss progression is a nested state machine inside that container.
- `completed` means the weekly goal itself is finished (big boss defeated), not merely that all themes were checked off.

#### Breakpoint

- Shipable checkpoint: weekly goals can be created with an end date, locked with 2+ themes, and queried with correct mini boss / boss availability states.
- Verify:
  - locking with fewer than 2 themes is rejected
  - invalid dates are rejected cleanly
  - midpoint is calculated correctly
  - boss unlock state changes correctly as themes are completed
  - expired goals are visible for 48h after `endDate`, then deleted
  - `endDate` becomes read-only when `bossStatus` leaves `locked`
- Run lint, typecheck, and weekly goal tests before Phase 3.

### Phase 3 — Add Goal UI for Planning and Progression ✅ Done

Goal: make the new weekly-boss logic visible and understandable in the app.

Scope:

- Add an end-date picker in weekly goal creation/editing.
- Make the end-date picker read-only once all themes are completed or the end date has been reached.
- Update goal header to show the chosen date range.
- Add a clear progression strip:
  - themes in progress
  - mini boss
  - big boss
- Add disabled/enabled manual trigger actions with plain-English reasons.
- Show boss lock state in a way a non-technical user can understand immediately.

New UI pieces:

- Date picker control
- Boss progression indicator
- Boss trigger button
- Status copy for locked / available / completed states

Concrete code areas likely involved:

- `app/goals/page.tsx`
- `app/goals/components/*`

UX requirement:

- The user should always understand "what happens next" without reading docs.

Breakpoint:

- Shipable checkpoint: someone can create a goal, see the dates, understand whether mini boss or boss is locked, and see why.
- Review this phase in the browser before wiring the actual boss launch flow.

### Phase 4 — Launch Mini Boss and Big Boss V1 ✅ Done

Goal: connect weekly goals to actual playable multi-theme sessions.

#### Decisions from review

- **Boss = classic-mode duel.** Both players must be online and play together. This matches the core insight that in-person/co-op play is where the fun lives.
- **Both players must be perfect.** If either player gets a boss question wrong, the attempt fails. The duel completes normally (and can still show the usual score), but the boss stays available for retry.
- **Solo practice option.** Players can practice the boss words solo without affecting boss progression. This lets them prepare before the real attempt.
- **Duel invitation flow.** One player taps "Start Boss" → creates a classic duel invitation for the partner. Partner accepts → duel starts. Same flow as existing immediate duels.

#### Schema changes

- Add `weeklyGoalId: v.optional(v.id("weeklyGoals"))` to challenges table — links a boss duel or practice session back to its goal (used for cleanup).
- Add `bossType: v.optional(v.union(v.literal("mini"), v.literal("big")))` to challenges table — distinguishes real boss attempts from practice. Only set on real boss duels, not practice runs.

#### Backend mutations

- `startBossDuel(goalId, bossType: "mini" | "big")`:
  - Validate the caller is a participant.
  - Validate the relevant boss status is `available` (using `getEffectiveMiniBossStatus` / `getEffectiveBossStatus`).
  - Load all themes from the goal.
  - Build the eligible merged word pool, then sample words: 20 for mini boss, 30 for big boss. If fewer words are available, use all.
  - Create a classic-mode challenge from that sampled boss word set, with `weeklyGoalId` and `bossType` set.
  - Send a duel invitation notification to the partner.
  - Return the challenge ID.

- `startBossPractice(goalId, bossType: "mini" | "big")`:
  - Same word sampling logic.
  - Create a solo-mode challenge with `weeklyGoalId` set (for cleanup) but WITHOUT `bossType` (so it's not treated as a real boss attempt).
  - No notification — it's a solo practice run.
  - Return the challenge ID.

#### Perfect-run detection

When a classic duel completes and has `weeklyGoalId` + `bossType`:
- Check if both players answered every question correctly.
- If yes → patch the goal's `miniBossStatus` or `bossStatus` to `"completed"`.
- If big boss completed → also set goal `status` to `"completed"` and send celebratory notification.
- If no → duel ends normally, boss stays available.

#### Boss intro screen

- New route: `app/boss/[goalId]/[bossType]/page.tsx`.
- Receives both `goalId` and `bossType` (`mini` / `big`) as route params.
- Shows:
  - Boss name: "Mini Boss" or "Big Boss".
  - Theme count and word count.
  - Framing: "Checkpoint" for mini boss, "Final Boss" for big boss.
- Two actions:
  - **"Challenge Partner"** (primary) — calls `startBossDuel`, navigates to the classic duel lobby. No learn phase — classic mode goes straight to questions.
  - **"Practice Solo"** (secondary) — calls `startBossPractice`, navigates into the existing solo flow which already has the learn-first-or-challenge-right-away choice built in. Does not affect boss progression.

#### UI wiring

- Boss card tap → navigate to boss intro screen with `goalId` and `bossType`.
- Boss intro "Challenge Partner" → calls `startBossDuel`, navigates to the duel lobby. Partner receives a duel invitation notification and accepts to join.
- Boss intro "Practice Solo" → calls `startBossPractice`, navigates to the solo session (reuses existing solo flow with learn/challenge choice).
- Partner receives duel notification → accepts → both enter the classic duel.

#### Word sampling

- Mini boss draws from **completed themes only** (both players checked off). The unlock rule guarantees at least 1 completed theme.
- Big boss draws from **all themes** in the goal.
- Mini boss cap: 20 words. Big boss cap: 30 words.
- If the pool is smaller than the cap, use all available words.
- Sampling happens first from the eligible merged word pool. After that, `buildChallengeBase` shuffles the sampled boss word set into final play order.

#### Breakpoint

- Shipable checkpoint: end-to-end mini boss flow works from a real weekly goal.
- Do not start variety work until this feels stable and understandable.
- Run lint, typecheck, and end-to-end manual verification for:
  - mini boss duel launch + partner invitation
  - mini boss completion with a perfect run → goal updated
  - mini boss failure (not perfect) → boss stays available
  - solo practice run → no effect on boss status
  - big boss unlock after mini boss completion + all themes done
  - big boss completion → goal completed + notification

### Phase 5 — Layer In Boss Variety

Goal: make the boss feel like an event rather than "just a longer quiz."

Scope:

- Introduce exercise selection rules from `Dev/VARIETY.md`.
- Start with low-content-cost additions first:
  - Spanish -> English reversal
  - speed round
  - match pairs
- Keep sentence-based rounds behind a separate content readiness check, because they need generation support.
- Add a round composer that mixes exercise types across the merged word pool.

Important sequencing:

- This phase should only happen after boss v1 is already fun enough and technically stable.
- Variety is an enhancement layer, not the foundation.

Breakpoint:

- Shipable checkpoint: boss uses more than one exercise type in a single run.
- Validate whether the added variety actually improves the feeling, instead of just increasing complexity.


## Biggest Risks

- **Multi-theme is the real platform change.** This is the hardest part technically and touches the most existing code.
- **Weekly goal state can get messy fast** if goal lifecycle and boss lifecycle are mixed together without clear rules.
- **Boss variety can explode scope** if we start building new exercise systems before the core boss loop exists.
- **A boss that feels identical to normal study** will not solve the motivation problem, even if the logic works.

## Definition of Done for Boss V1

- A weekly goal requires at least 2 themes.
- Users can choose an end date when creating the goal.
- Users can edit the end date only while the goal is still in progress.
- The app derives midpoint as `floor(duration / 2)` days from start — never stored, always computed.
- Mini boss and big boss have backend-enforced unlock rules.
- A player can manually trigger them only when allowed.
- Available bosses can be retried unlimited times until a perfect run is achieved.
- Mini boss and big boss launch real multi-theme sessions.
- Completing mini boss affects big boss availability.
- Completing big boss marks the weekly goal `completed`.
- Theme completion is based on both players marking the theme done.
- If the merged word pool is smaller than the boss cap, the session uses all available words.
- Multi-theme session support includes a defined migration path from old single-theme challenges.
- Unfinished goals remain visible for up to 48 hours after the end date, then the goal and all associated boss sessions are deleted.
- Completed goals send a celebratory completion notification/message and can then be dismissed from the UI.
- The goal page clearly shows progression and next step.
- Lint, typecheck, and relevant tests pass.
