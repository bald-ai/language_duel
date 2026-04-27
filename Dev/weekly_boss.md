# Weekly Boss

## Why

- **Motivation** — A climactic goal to aim for, not just "do words every day." Gives the week a narrative arc: learn → mini boss → boss.
- **Immersion** — Forces engagement with a large chunk of words at once, creating the feeling of actually knowing something.
- **Spaced repetition** — The boss naturally re-tests words from earlier in the week. Mini boss at midpoint adds a second repetition pass.
- **Pacing discovery** — Might reveal that 1-2 duels per week with a boss is the right cadence, rather than daily grind that burns out.

## Structure

### Weekly Goal Changes

- **Minimum 2 themes** to lock a weekly goal (bosses need enough material to draw from).
- **Editing unlock on theme removal** — If exactly one player has locked and a participant removes a theme before activation, the goal stays in planning, the existing lock is cleared, and the unlocked player gets an in-app notification to review and lock again.
- **Custom end date** — Date picker to set when the goal ends. Midpoint is always auto-calculated as half the total duration rounded down (e.g. 7 days → day 3). The end date can be edited while the goal is still in progress, but not once the big boss becomes available or the end date has been reached.
- **Daily email countdown** — Active weekly goals can send one email per day at the configured Brno-local time with either `X days until Mini Boss` before midpoint or `X days until Boss` after the midpoint has passed.
- **Manual trigger** — Mini boss and big boss unlock from completed-theme counts. No date gate — progression is theme-driven.
- **Boss exclusivity** — Mini boss is available only before all themes are completed. Once all themes are completed, mini boss closes and big boss is the only boss option.
- **Theme completion rule** — A theme counts as completed only when **both players** have it checked off.

### Mini Boss (Midpoint)

- Unlocks when **floor(total themes / 2)** themes are completed by both players. The midpoint date is shown as a reference but does not trigger the unlock.
- Draws from all completed themes available at that point.
- Tests retention before the full weekly goal is complete.

### Big Boss (End)

- Unlocks when **all themes** are completed by both players.
- Draws from **all themes** in the weekly goal.
- **Vision (parked):** a mixed-exercise boss as sketched in `Dev/VARIETY.md` (design notes, not an active backlog). Until that is explicitly un-parked, treat the boss as the same core exercise flow at larger scale; Phase 5 below is the placeholder for mixing formats later.

## Technical Requirements

### Multi-Theme Duels / Solo Challenges

Shipped as a **general** feature (not boss-only): any duel or solo challenge can use one or more themes; words are snapshotted on the challenge as `sessionWords` with `themeId` / `themeName`; theme pickers support multi-select across lobby, solo, and scheduled flows.

### Goal and Boss UI (v1)

End-date control, mini/big boss triggers, progression copy, and boss intro (`app/boss/[goalId]/[bossType]`) are in place for boss v1.

### Schema / Backend (v1)

Weekly goals store `endDate`, `miniBossStatus`, `bossStatus`, and goal lifecycle separate from boss progression. Challenges store `themeIds`, `sessionWords`, optional `weeklyGoalId` and `bossType`. Midpoint stays derived at read time, not stored.

## Recommended V1 Decisions

These choices keep scope tight and give us a shippable version fast:

- **Boss v1 is a goal-specific classic duel** using multiple themes. Both players play it together in real time. A separate solo practice option exists, but practice does not affect boss progression.
- **No fail state in v1.** The boss should feel climactic, not punishing. We can add lives later if the feature already proves fun.
- **Use the existing exercise flow first.** The first release should prove multi-theme + goal progression works before mixing in the full VARIETY.md system.
- **Boss length uses all eligible words.** Mini boss uses every word from completed themes. Big boss uses every word from the weekly goal.
- **Manual trigger only when prerequisites are met.** Players can go early, but only according to the theme-completion rules.
- **Completed theme = both players checked it off.**
- **Mini boss early unlock = `floor(total themes / 2)` completed themes.**
- **Big boss unlock = all themes completed.**
- **Boss retries are unlimited.** Once mini boss or big boss is `available`, players can start and restart it as many times as they want.
- **A boss is defeated only by a perfect run.** For live boss duels, that means both players answer every boss question correctly. The normal duel score can still be shown, but boss completion is based on perfect correctness, not weighted points.
- **End date edits are allowed only while the goal is still in progress.** Once all themes are completed or the end date has been reached, the date is frozen.
- **Midpoint is always derived, never stored.** It equals `floor(duration / 2)` days from start. If the end date changes while still editable, midpoint updates automatically. Once the end date is frozen, midpoint is frozen too.
- **After the end date is reached, unfinished goals stay visible for up to 48 hours, then auto-delete.**
- **Auto-delete removes everything** — the weekly goal container, its theme snapshots, any associated boss session/challenge records, and orphaned snapshot-only TTS files.
- **Weekly goal `completed` means the big boss was defeated.**
- **When a goal is completed, it closes and both players get a celebratory completion notification/message.** The closed goal can then be dismissed from the UI.

## Implementation Plan

### Phases 0–4 (complete)

Implementation history only; no open tasks here.

- **Phase 0** — Boss v1 product rules and unlock copy (see **Recommended V1 Decisions** and **Definition of Done** below).
- **Phase 0.5** — Shared challenge creation helpers (`convex/helpers/challengeCreation.ts` and call sites).
- **Phase 1** — `themeIds`, `sessionWords`, multi-select themes, gameplay reads from `sessionWords`.
- **Phase 2** — Weekly goal `endDate`, boss status fields, expiry/grace, backend unlock rules (`convex/weeklyGoals.ts`).
- **Phase 3** — Goal planning UI (`app/goals/`).
- **Phase 4** — Boss intro, `startBossDuel` / `startBossPractice`, perfect-run completion wiring, notifications.

For the old step-by-step plan that lived here, use `git log` / file history on this path.

### Phase 5 — Layer In Boss Variety

**Depends on:** `Dev/VARIETY.md` staying a **parked reference doc** until product chooses to un-park specific exercise types. This phase is not “implement the whole file”; it is optional follow-up once discrete variety work exists to compose.

Goal: make the boss feel like an event rather than "just a longer quiz."

Scope:

- Introduce exercise selection rules only for exercise types that have already been built and agreed; use `Dev/VARIETY.md` as a menu of ideas, not a mandate to build everything listed.
- Start with low-content-cost additions first:
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

- **Multi-theme sessions are a wide footprint** — shipped, but future changes to `sessionWords`, theme pickers, or challenge creation still need careful regression coverage.
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
- Completing mini boss does not gate big boss availability.
- Completing big boss marks the weekly goal `completed`.
- Theme completion is based on both players marking the theme done.
- Boss sessions use all eligible words with no boss-specific word cap.
- Multi-theme session support includes a defined migration path from old single-theme challenges.
- Unfinished goals remain visible for up to 48 hours after the end date, then the goal and all associated boss sessions are deleted.
- Completed goals send a celebratory completion notification/message and can then be dismissed from the UI.
- The goal page clearly shows progression and next step.
- Lint, typecheck, and relevant tests pass.
