# Weekly Boss

## Why

- **Motivation** — A climactic goal to aim for, not just "do words every day." Gives the week a narrative arc: learn → mini boss → boss.
- **Immersion** — Forces engagement with a large chunk of words at once, creating the feeling of actually knowing something.
- **Spaced repetition** — The boss naturally re-tests words from earlier in the week. Mini boss at midpoint adds a second repetition pass.
- **Pacing discovery** — Might reveal that 1-2 duels per week with a boss is the right cadence, rather than daily grind that burns out.

## Structure

### Weekly Goal Changes

- **Minimum 2 themes** to create a weekly goal (bosses need enough material to draw from).
- **Custom end date** — Date picker to set when the goal ends. Midpoint auto-calculated from start + end.
- **Manual trigger** — If both players finish themes ahead of schedule, they can trigger boss/mini boss early instead of waiting for the date.
- **Progression lock** — Mini boss must be completed before the big boss unlocks.

### Mini Boss (Midpoint)

- Fires at the halfway date (auto-calculated) or triggered manually.
- Draws from **50% of themes** (rounded down) — the ones completed so far.
- Lighter than the boss. Tests retention of the first half of the week.

### Big Boss (End)

- Fires at the goal end date or triggered manually (only after mini boss is done).
- Draws from **all themes** in the weekly goal.
- Uses the full variety mix from VARIETY.md — random exercise types, directions, sentence exercises, speed rounds, match pairs. The variety IS the boss.

## Technical Requirements

### Multi-Theme Duels / Solo Challenges

The boss requires pulling words from multiple themes into a single session. This doesn't exist yet — current duels are single-theme only.

**This should be built as a general feature**, not boss-specific:
- Any duel or solo challenge can optionally use multiple themes.
- Theme selection UI allows picking 1+ themes.
- Word pool is merged from all selected themes.
- Useful outside of goals too — "let's duel on all our animal + food themes at once."

### New UI / Components Needed

- **Date picker** — For setting weekly goal end date.
- **Boss trigger button** — Manual "Start Boss" action when ahead of schedule. Disabled until prerequisites met (mini boss done, themes completed).
- **Boss lobby / intro screen** — Something that feels different from a normal duel. The boss should feel like an event, not just another round.
- **Progress indicator** — Visual showing mini boss → boss progression within the weekly goal.

### Schema / Backend Changes

- Weekly goal needs: end date, midpoint date, mini boss status (locked/available/completed), boss status (locked/available/completed).
- Challenge table needs: optional array of theme IDs instead of single themeId (or a new field for multi-theme).
- Word pool generation logic for merging multiple themes, deduplicating, and shuffling.

### Open Questions

- How many words/rounds should the boss be? All words from all themes? A random subset? Scales with theme count — 2 themes might be 20 words, 5 themes might be 50. Need a cap or adaptive length.
- Should boss have lives / fail state, or is it always completable? Fail state adds stakes but might frustrate.
- Should the boss mix exercise types from VARIETY.md, or is that a later enhancement? Could ship v1 as a multi-theme duel with existing levels, then layer variety on top.
- Does each player do the boss independently (solo), or is it always a co-op/duel? Both options seem valid.
