# Weekly Boss

## Why

- **Motivation** — A climactic goal to aim for, not just "do words every day." Gives the week a narrative arc: learn → mini boss → boss.
- **Immersion** — Forces engagement with a large chunk of words at once, creating the feeling of actually knowing something.
- **Spaced repetition** — The boss naturally re-tests words from earlier in the week. Mini boss at midpoint adds a second repetition pass.
- **Pacing discovery** — Might reveal that 1-2 duels per week with a boss is the right cadence, rather than daily grind that burns out.

## Structure

### Weekly Goal Changes

- **Minimum 2 themes** to create a weekly goal (bosses need enough material to draw from).
- **Custom end date** — Date picker to set when the goal ends. Midpoint is always auto-calculated as half the total duration rounded down (e.g. 7 days → day 3). The end date can be edited while the goal is still in progress, but not once the goal is boss-ready or the end date has been reached.
- **Manual trigger** — If both players finish themes ahead of schedule, they can trigger boss/mini boss early instead of waiting for the date.
- **Progression lock** — Mini boss must be completed before the big boss unlocks.
- **Theme completion rule** — A theme counts as completed only when **both players** have it checked off.

### Mini Boss (Midpoint)

- Fires at the halfway date (auto-calculated) or triggered manually.
- Early unlock happens when **floor(total themes / 2)** themes are completed by both players.
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

### Open Questions

- How many words/rounds should the boss be? All words from all themes? A random subset? Scales with theme count — 2 themes might be 20 words, 5 themes might be 50. Need a cap or adaptive length.
- Should boss have lives / fail state, or is it always completable? Fail state adds stakes but might frustrate.
- Should the boss mix exercise types from VARIETY.md, or is that a later enhancement? Could ship v1 as a multi-theme duel with existing levels, then layer variety on top.

## Recommended V1 Decisions

These choices keep scope tight and give us a shippable version fast:

- **Boss v1 is a goal-specific solo challenge** using multiple themes. Both players can do it from the same weekly goal, but they do not need to be online at the same time.
- **No fail state in v1.** The boss should feel climactic, not punishing. We can add lives later if the feature already proves fun.
- **Use the existing exercise flow first.** The first release should prove multi-theme + goal progression works before mixing in the full VARIETY.md system.
- **Adaptive boss length.** Use a capped subset, not every word. Example rule for v1: target 20 words for mini boss, 30 words for big boss, sampled across eligible themes. If fewer words are available than the cap, use all available words.
- **Manual trigger only when prerequisites are met.** Players can go early, but they still cannot skip progression rules.
- **Completed theme = both players checked it off.**
- **Mini boss early unlock = `floor(total themes / 2)` completed themes.**
- **Big boss early unlock = all themes completed + mini boss done.**
- **Boss retries are unlimited.** Once mini boss or big boss is `available`, players can start and restart it as many times as they want.
- **A boss is defeated only by a 100% run.** Any attempt below 100% leaves the boss `available`.
- **End date edits are allowed only while the goal is still in progress.** Once all themes are completed or the end date has been reached, the date is frozen.
- **Midpoint is always derived, never stored.** It equals `floor(duration / 2)` days from start. If the end date changes while still editable, midpoint updates automatically. Once the end date is frozen, midpoint is frozen too.
- **After the end date is reached, unfinished goals stay visible for up to 48 hours, then auto-delete.**
- **Auto-delete removes everything** — the weekly goal container and any associated boss session/challenge records.
- **Weekly goal `completed` means the big boss was defeated.**
- **When a goal is completed, it closes and both players get a celebratory completion notification/message.** The closed goal can then be dismissed from the UI.

## Implementation Plan

### Phase 0 — Lock the Product Rules

Goal: remove ambiguity before touching schema or gameplay.

What to decide and document:

- Boss v1 = solo challenge launched from weekly goals.
- Minimum 2 themes required before a goal can be locked.
- Weekly goal gets an explicit **end date** chosen during setup.
- End date can be edited only while the goal is still in progress. Once all themes are completed or the end date has been reached, it becomes read-only.
- Midpoint is always derived as `floor(duration / 2)` days from start (e.g. 7-day goal → day 3). It is never stored; it moves automatically if the end date is edited, and freezes when the end date freezes.
- A theme counts as completed only when both players have it checked off.
- Mini boss unlocks at midpoint or early once `floor(total themes / 2)` themes are completed.
- Big boss unlocks at end date or early only after mini boss is completed and all themes are completed.
- Once a boss is `available`, players can retry it unlimited times.
- A boss becomes `completed` only when an attempt scores 100%.
- Attempts below 100% do not create a new boss state; they simply leave the boss `available` for another retry.
- Weekly goal `completed` means the big boss was defeated.
- If the end date passes without boss completion, keep the goal around for up to 48 hours, then auto-delete the goal and all associated boss session/challenge records.
- If the boss word cap is higher than the available merged word pool, use all available words instead of padding or failing.
- Boss word count is capped and sampled, not "all words always."

Deliverables:

- Update this doc with the final v1 product rules.
- Plain-English unlock rules (backend and UI must use the same logic):

**Mini Boss — when does it become available?**
The mini boss starts locked. It becomes available when either of these is true: (a) the current date has reached or passed the midpoint date, or (b) at least `floor(total themes / 2)` themes are completed (both players checked off).

**Big Boss — when does it become available?**
The big boss starts locked. It becomes available when all three of these are true: (1) the mini boss has been completed, (2) all themes in the goal are completed (both players checked off on every theme), and (3) the current date has reached or passed the end date — or all themes are completed (the date gate is waived if themes are done early).

**Manual trigger — when can a player press "Start"?**
A player can start a boss only when that boss's status is `available`. If the status is `locked` or `completed`, the button is disabled. While a boss is `available`, players may retry it as many times as they want.

**Boss completion — what counts as defeating it?**
A boss is defeated only by a 100% run. Any attempt below 100% does not complete the boss and simply leaves it `available` for another retry. We do not need best-score or latest-attempt tracking for v1.

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

### Phase 0.5 — Extract Shared Challenge Creation Logic

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

### Phase 1 — Build Multi-Theme Session Foundations

Goal: make "one session from many themes" a real platform feature, because Weekly Boss depends on it.

Scope:

- Add multi-theme support to duel/challenge session data.
- Allow a session to store `themeIds` and use words from multiple themes in one playable session.
- Treat `themeIds` as the new source of truth for sessions. Existing single-theme challenge rows should be backfilled to `themeIds: [themeId]` in a one-time migration script. Note: the migration script must also be run on production at the end of the project.
- Create shared backend logic to:
  - load words from multiple themes
  - keep every word tied to its source theme (no deduplication)
  - shuffle in a deterministic way
  - return a display label for the session
- Update single-theme creation paths to use the same code path with a one-item theme list.

UI changes:

- Convert `ThemeSelector` from single-click-to-select to a **checkbox-style multi-select with a Confirm button**.
- Apply the multi-select UI to **all flows**: `SoloModal`, `UnifiedDuelModal` (`CompactThemeSelector`), and `ScheduledDuelPickers` (`CompactThemePicker`).
- During gameplay, only when multiple themes are selected, display the **theme name only** near the word (e.g. above it) so the player knows which theme context the word belongs to. This is required in Phase 1.

Concrete code areas likely involved:

- `convex/schema.ts`
- shared challenge creation helper (from Phase 0.5)
- gameplay reads that currently fetch `duel.themeId`
- shared session/word-pool helpers in `convex/helpers/*`
- `app/components/modals/ThemeSelector.tsx`
- `app/components/modals/SoloModal.tsx`
- `app/components/modals/UnifiedDuelModal.tsx` (CompactThemeSelector)
- `app/notifications/components/ScheduledDuelPickers.tsx` (CompactThemePicker)

Recommended implementation shape:

- Do not make Weekly Boss-specific hacks.
- Introduce a general "session themes" model, then have duels, solo runs, and bosses consume it.
- Each word remains attached to its source `themeId` so the UI can show the source theme name during gameplay for multi-theme sessions. Gameplay logic does not need to branch on source theme.
- Make the migration explicit, not implicit: backfill old rows first, then switch reads/writes, then remove the old single-theme assumption from app code.

Breakpoint:

- Shipable checkpoint: a normal solo challenge can run from 2+ themes without weekly goals involved.
- Verify:
  - words from all selected themes are included with their original source theme preserved
  - the source theme name displays next to each word during multi-theme gameplay, and this label is not shown for single-theme sessions
  - existing single-theme flows still work
- Run lint, typecheck, and focused session/gameplay tests before moving on.

### Phase 2 — Extend Weekly Goal Data and Unlock Logic

Goal: teach weekly goals about time windows and boss progression.

Scope:

- Extend weekly goal data with:
  - lifecycle status that clearly distinguishes `editing`, `active`, `expired`, and `completed`
  - `endDate`
  - `miniBossStatus`
  - `bossStatus`
  - optional timestamps for when each became available/completed/triggered
- Support boss attempts/retries without introducing extra boss statuses beyond `locked`, `available`, and `completed`.
- Add support for a short post-end grace window before cleanup so expired unfinished goals are still visible for up to 48 hours. After the grace window, delete the goal and all associated boss session/challenge records.
- Replace the fixed 7-day assumption with a user-selected end date.
- Enforce minimum 2 themes before lock/activation.
- Add backend functions that answer:
  - is mini boss available?
  - is big boss available?
  - can manual trigger be used right now?
  - can the end date still be edited right now?
- Keep all progression checks on the backend as source of truth.

Concrete code areas likely involved:

- `convex/schema.ts`
- `convex/weeklyGoals.ts`
- `app/goals/constants.ts`
- `app/goals/page.tsx`
- notification/reminder logic that currently assumes `expiresAt`

Recommended rule split:

- Goal lifecycle stays separate from boss lifecycle.
- Weekly goal remains the container.
- Boss progression becomes a nested state machine inside that container.
- `completed` should mean the weekly goal itself is finished, not merely that all themes were checked off. Theme completion and boss completion remain separate pieces of state.
- For v1, attempt history only needs to support retries and final completion. No best-score or latest-attempt UX is required.

Breakpoint:

- Shipable checkpoint: weekly goals can be created with an end date, locked with 2+ themes, and queried with correct mini boss / boss availability states.
- Verify:
  - invalid dates are rejected cleanly
  - midpoint is calculated correctly
  - boss unlock state changes correctly as themes are completed
- Run lint, typecheck, and weekly goal tests before Phase 3.

### Phase 3 — Add Goal UI for Planning and Progression

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

### Phase 4 — Launch Mini Boss and Big Boss V1

Goal: connect weekly goals to actual playable multi-theme sessions.

Scope:

- Add boss-launch backend mutations:
  - start mini boss
  - start big boss
- Add retry support for available bosses. A sub-100% result should leave the boss retryable instead of creating a terminal failure state.
- Enforce prerequisites in those mutations.
- Create a boss intro/lobby screen that feels distinct from a normal duel.
- Start a multi-theme solo challenge from the weekly goal using the Phase 1 session foundation.
- Persist completion back onto the weekly goal so progression unlocks the next step.

Recommended v1 flow:

- Player opens weekly goal.
- If mini boss is available, tap `Start Mini Boss`.
- App opens boss intro screen with theme count, word count, and "this is a checkpoint" framing.
- If the attempt scores below 100%, the boss stays available and can be restarted.
- Completing mini boss with a 100% run updates the goal and unlocks big boss when timing/prereqs are met.
- Big boss uses the same core engine with a larger word cap.
- Completing big boss with a 100% run marks the weekly goal `completed`, closes it, and sends the celebratory completion notification/message.
- If the merged word pool is smaller than the configured cap, the boss simply uses the full pool.

Concrete code areas likely involved:

- `convex/weeklyGoals.ts`
- duel/solo launch entry points
- new boss-specific screen under `app/`

Breakpoint:

- Shipable checkpoint: end-to-end mini boss flow works from a real weekly goal.
- Do not start variety work until this feels stable and understandable.
- Run lint, typecheck, and end-to-end manual verification for:
  - mini boss launch
  - mini boss completion
  - big boss unlock after prerequisites

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
- Available bosses can be retried unlimited times until a 100% run is achieved.
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
