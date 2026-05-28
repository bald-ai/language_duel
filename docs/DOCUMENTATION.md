Disclaimer: This is an indie app currently with no users.

# Language Duel Documentation

## What This App Is

Language Duel is a collaborative language-learning app built around shared practice, structured play, and reusable study content. Users create and study themes, run solo practice, play duels with another person, set weekly goals together, receive notifications and reminders, and use TTS audio to hear answers.

The product name makes it sound more competitive than it currently feels in practice. The app has competitive mechanics, but the broader experience is closer to learning together with game-like structure than to trying to beat another person at all costs.

## Current Product Thesis

"Duel" is legacy naming and no longer fully describes the app. The current best interpretation is collaborative language practice with playful structure, pacing, and shared motivation.

Side-by-side real-life use is an important mental model for this product. A good way to think about it is that the mechanics create rhythm for two people learning together, even when the UI still uses more competitive language.

The direction is still evolving. AI should treat this thesis as the current best description, not as a finished product definition.

## Core User Experiences

- Manage themes: A user creates, edits, generates, shares, archives, and sometimes collaborates on themes. Themes are the core content unit that feeds study, solo practice, duels, and weekly goals.
- Generate themes: A user can generate a normal theme directly, or use Pick & Prune to over-generate words first and then keep only the useful entries.
- Solo practice: A user practices against the app without needing another player. The Learn + Test path also covers untimed study with hints and TTS before practice play.
- Start or join a duel: Two users accept a challenge and practice together. In practice this can be synchronous in-app play or a structure that supports learning together in real life.
- Duel modes: New challenges choose `PvP`, `PvE`, or `Relay`. PvP is the competitive mode with sabotages and request-hint mechanics. PvE is the cooperative mode with a shared hint pool. Relay is the turn-based hand-off mode where one player picks a word from the remaining pool and the other player answers it, then roles swap.
- Weekly goals: A user can create a solo goal, or two users can create a shared goal. Goals collect themes, lock in a snapshot, and track completion toward boss-style milestone moments.

## System Map

- `app/` contains the Next.js user-facing routes, pages, and feature UI.
- `convex/` contains the backend logic, schema, queries, mutations, actions, cron jobs, and feature rules.
- Clerk handles authentication and user identity.
- Notifications, scheduled reminders/emails, and TTS support are cross-cutting systems used by several features rather than isolated add-ons.

## Data Model Overview

- `users`: user identity, profile, credits, TTS preferences, theme presentation preferences, archived themes, and presence-related state.
- `themes`: user-created word collections with metadata, sharing state, edit permissions, and stored words.
- `friendRequests`: pending or resolved requests that let users connect before collaborating directly.
- `friends`: accepted user-to-user relationships used across duels, goals, and shared content flows.
- `challenges`: pending person-to-person duel invites, including participants, chosen themes, and optional weekly-goal linkage.
- `duels`: accepted two-person gameplay sessions, including participants, chosen themes, generated session words, game state, and optional weekly-goal linkage.
- `soloPracticeSessions`: single-player practice sessions, including chosen themes, generated session words, and optional weekly-goal linkage.
- `weeklyGoals`: solo or shared goals that track chosen themes, participant lock state, lifecycle state, completion progress, and boss readiness.
- `notifications`: in-app event records for friend requests, challenges, duel activity, and weekly-goal events.
- `notificationPreferences`: per-user settings controlling which notification and reminder events should fire.
- `emailNotificationLog`: idempotency and audit support for sent email notifications and reminders.

Important relationships:

- Users own themes and can also see or edit some themes through sharing rules.
- Users connect through friend requests and `friends`, then collaborate through challenges, duels, and weekly goals.
- Challenges reference users and themes, and accepted challenges create duels. Some challenges and duels are created in the context of a weekly goal.
- Notifications and reminder systems reflect activity from friend, challenge, duel, and weekly-goal flows instead of being standalone features.

Theme generation lifecycle:

- Standard generation creates an unsaved private theme draft from a theme name, optional custom prompt, word type, and requested word count.
- Pick & Prune is a review-first generation flow. For a new theme it requests `20` generated words, shows them in a review screen, lets the user remove and restore entries, and only creates the unsaved theme draft from the kept words.
- Pick & Prune also exists when adding generated words to an existing theme. In that case it over-generates using the existing random-generation maximum, opens the same review screen, and appends only the kept words to the current local theme words.
- Removed Pick & Prune words are not deleted from a saved theme because the review happens before the new generated words are saved. The removed list is just a temporary review bucket.
- Continuing Pick & Prune requires at least one kept word. Discarding a new-theme Pick & Prune review drops the generated list and returns to the theme list; discarding an existing-theme review returns to the theme detail without appending anything.
- Generated content is validated through the shared theme-generation API and semantic validation rules before it reaches the review or draft flow.

Duel mode lifecycle:

- `duelMode` is required on challenge creation and is copied from the pending `challenges` record into the accepted `duels` record.
- The mode is shown on challenge notifications so the accepting player can see whether the invite is `PvP`, `PvE`, or `Relay`.
- The mode picker appears on normal challenge creation, weekly-goal boss duel creation, and spaced-repetition duel creation.
- `PvP` keeps the competitive tools: sabotages, request-hint, accept-hint, and option elimination. Those actions are allowed only in `PvP`.
- `PvE` removes sabotages and request-help UI. Instead, both players see the same hint pool during the answering phase.
- The PvE hint pool has four one-use hint types: `50/50`, `+15 Seconds`, `Anagram`, and `Letter Count`.
- A PvE hint is shared team state: either player can fire it, it affects both players, there is no consent step, and only one hint can be fired per question.
- Every PvE hint gives a universal timer bump; `+15 Seconds` is the bigger timer hint because it includes the universal bump plus its own extra time.
- PvE is designed around two players sitting together and talking in real life. Do not add request pings, consent prompts, or extra notification noise unless that product assumption changes.
- Sentence rounds in PvE are per-player boards in v1, not a shared cooperative tile board. Players share the duel/timer context, but each player submits their own sentence result.
- `Relay` is the third mode: turn-based, no sabotages, no shared hint pool, no per-turn difficulty preset. The picker hands a single word to the rival, the rival answers it, then the rival becomes the next picker. See the Relay duel lifecycle below for details.

Relay duel lifecycle:

- Relay is word-only in v1. The challenge modal disables Relay when any selected theme is a sentence theme, `createChallenge` rejects Relay + sentence themes, and duel session creation rejects any old pending Relay invite that would build sentence items.
- Relay has three phases tracked on the duel record: `pick`, `answer`, and `feedback`. Only `answer` is timed.
- The challenger always picks first. After every answered word (correct, wrong, or timed out) the answerer becomes the next picker, so turns alternate by outcome of play rather than by a fixed schedule.
- The pick phase shows the picker the remaining word pool (resolved and currently-assigned positions are excluded) plus a per-player hard-upgrade budget. The non-picker sees a waiting screen.
- Each player gets `ceil(poolSize / 10)` hard-upgrade tokens at duel creation (`RELAY_HARD_BUDGET_DIVISOR = 10`). Using a token swaps the served question for the pre-built "hard" variant of that word. Tokens are independent per player and do not refund on wrong answers or timeouts.
- Relay questions are six-option, uniform-medium-difficulty by default; the difficulty preset selector is hidden on Relay and the backend ignores any preset that gets sent. The hard upgrade is the only per-turn difficulty lever.
- The answer phase has a fixed `RELAY_ANSWER_TIMEOUT_SECONDS = 21` countdown. A Convex scheduled function is the source of truth for timeouts; the client timer is just display.
- Timeout counts the word as wrong (no score) and resolves + hands off in a single step — Relay never parks in `feedback` after a timeout, because the answerer is likely gone.
- Scoring is a flat `RELAY_QUESTION_POINTS = 1` per correct answer credited to the answerer. There is no per-word point variation and no streak bonus.
- The duel completes when every position in `wordOrder` has been resolved and no word is currently assigned (`isRelayFinished`). The final-results panel then replaces the picker/answer UI.
- Server enforcement lives in `convex/relayDuel.ts` (`relayPick`, `relayAnswer`, `relayAdvance`, `relayTimeout`) and the pure rules in `lib/duel/relayEngine.ts`. UI lives in `app/duel/[duelId]/components/RelayDuelView.tsx`.

Weekly goal lifecycle:

- Stored lifecycle values are `draft`, `locked`, `grace_period`, and `completed`.
- `lock_proposed` is derived, not stored: the goal is still `draft`, at least one participant lock flag is true, and not all required participants have locked.
- Theme progress can be marked during planning, including `draft` and derived `lock_proposed`; boss access still starts only after both participants lock.
- Weekly-goal solo practice uses live original themes before full lock. After full lock, it uses the weekly-goal snapshots, so later edits to original themes do not affect snapshot practice.
- Mini boss and big boss status values are `unavailable`, `ready`, and `defeated`.
- Completed goals are retained in the database but hidden from the active weekly-goal list.
- Completed weekly goals feed Spaced Repetition under `/repetition`. SR progress is personal per user, uses the locked weekly-goal snapshots only, and can be advanced by solo completion or by a successful SR duel when that participant's own repetition step is ready.
- Declined draft goals are deleted.
- Goal lifecycle `completed` and big boss status `defeated` intentionally use different words so the final goal state and final boss outcome are not confused.

## Entry Points For AI Work

- Start in [`convex/schema.ts`](/Users/michalkrsik/coding_projects/language_duel/convex/schema.ts) when you need the core data shape and the main domain entities.
- Start in [`app/`](/Users/michalkrsik/coding_projects/language_duel/app) when the work is about user-facing routes, screens, or UI behavior.
- Start in [`convex/`](/Users/michalkrsik/coding_projects/language_duel/convex) when the work is about backend rules, persistence, notifications, reminders, or feature flows.
- Start in [`hooks/`](/Users/michalkrsik/coding_projects/language_duel/hooks) when the work is about client-side orchestration such as duel lobby behavior or user syncing.
- Start in [`lib/`](/Users/michalkrsik/coding_projects/language_duel/lib) when the work is about shared pure logic, validation, scoring, theme helpers, or other reusable domain utilities.

## Domain Terms

- Theme: the core content unit, made of words and answers plus metadata like description, word type, sharing, and editability.
- Pick & Prune: a generation review flow where the app intentionally creates more candidate words than needed, then the user removes weak entries before saving or appending the kept words.
- Padded handle: the canonical concrete user label, formatted like `Alex#0123`. Generic status copy can still use product words like "Someone" when no user label is available.
- Adjective themes use Spanish masculine singular/base-form adjectives, without articles or irregular markers.
- Adverb themes use Spanish adverbs in canonical form, preferring the -mente form when derivable; pure adverbs (bien, siempre, aquí, muy) stay as-is. Wrong answers may include at most one bare-adjective distractor (for example, "rápido" as a distractor for "rápidamente").
- Duel: a structured two-person practice session. The name sounds more competitive than the broader product intent.
- Challenge: a proposal sent to another person to start a duel.
- PvP: competitive duel mode with sabotages and request-hint mechanics.
- PvE: cooperative duel mode with a shared hint pool and no sabotage/request-help mechanics.
- Relay: turn-based duel mode. The picker hands a single word from the remaining pool to the rival, the rival answers it, then the rival becomes the next picker. Six-option questions, uniform medium difficulty, with a per-player hard-upgrade token budget.
- Hard upgrade (Relay): a token the picker can spend when handing over a word to swap the served question for the pre-built hard variant of that word. Per-player budget is `ceil(poolSize / 10)`.
- Shared hint pool: the PvE team hint budget. It belongs to the duel, not to one player.
- Solo practice: a single-player learning flow without another player.
- Weekly goal: a solo or shared study plan, built from selected themes and tracked toward completion.
- Boss: a milestone challenge generated from weekly-goal progress, used to turn shared progress into a more game-like event.
- TTS: text-to-speech audio attached to theme answers and used to support studying and challenge flows.

## App-Specific Gotchas

- Theme access is not just public versus private. Themes can be private or shared, and shared themes can separately allow or forbid friend editing.
- "Duel" does not always mean head-to-head competition. Many flows use duel mechanics as structure for collaborative practice.
- Challenge invites, accepted duels, and solo-practice sessions are separate records with separate state shapes.
- Mode-specific duel actions are enforced at the Convex mutation boundary through `assertDuelMode`; UI hiding is only for clarity.
- PvE mode is not just PvP with sabotages hidden. PvE has different interaction rules, a shared hint pool, and a co-located-player product assumption.
- Relay mode is not a PvP/PvE variant. It has its own phase machine (`pick`/`answer`/`feedback`), its own server mutations in `convex/relayDuel.ts`, and ignores the difficulty preset because difficulty is controlled per-turn via the hard-upgrade token instead.
- Pick & Prune review state is temporary client-side state. Saved theme data only receives the words the user keeps.
- Weekly goals, boss challenges, notifications, and reminders are connected. Changes in one area can affect behavior in the others.
- Themes are reused across study, solo practice, duels, and weekly goals, so content changes can have effects in multiple surfaces.

## Risks And Active Decisions

- Product positioning is still unsettled. The current experience is more collaborative than the name "Language Duel" suggests.
- Naming tension matters: some code and UI language still lean competitive, while the broader product thesis is moving toward learning together.
- AI should be careful not to over-optimize for one play style. The app supports in-app play, solo play, and side-by-side real-life learning rhythms.
- Sabotage design principle: a sabotage must **hinder, not deny**. Sending a sabotage does not pause or add time to the question clock, so the target's timer keeps running. The shipped sabotages (sticky, ping-pong, trampoline, reverse) only add friction — the target can still answer immediately. A "math gate" sabotage (a full-screen overlay that blocked the answers until the target solved a few math problems) was prototyped and then removed: sent late, it could run the target's clock out entirely and force an auto-timeout, making it categorically more powerful than every other sabotage. Do not add hard-blocking sabotages unless they also protect the target's ability to answer (e.g. pausing the timer while the block is up).

## How AI Should Maintain This Doc

- Treat this file as the primary big-picture orientation doc for AI work in this repo.
- Suggest updates when user-visible behavior, architecture, data-model shape, or important product decisions change.
- Ask the user before editing this file. Do not silently rewrite it during unrelated work.
- Keep it compact and high-signal. If information is already clear from code or tests, this file should usually point to the concept rather than restate implementation detail.
