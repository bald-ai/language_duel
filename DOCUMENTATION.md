Disclaimer: This is an indie app currently with no users.

# Language Duel Documentation

## What This App Is

Language Duel is a collaborative language-learning app built around shared practice, structured play, and reusable study content. Users create and study themes, run solo challenges, play duels with another person, set weekly goals together, receive notifications and reminders, and use TTS audio to hear answers.

The product name makes it sound more competitive than it currently feels in practice. The app has competitive mechanics, but the broader experience is closer to learning together with game-like structure than to trying to beat another person at all costs.

## Current Product Thesis

"Duel" is legacy naming and no longer fully describes the app. The current best interpretation is collaborative language practice with playful structure, pacing, and shared motivation.

Side-by-side real-life use is an important mental model for this product. A good way to think about it is that the mechanics create rhythm for two people learning together, even when the UI still uses more competitive language.

The direction is still evolving. AI should treat this thesis as the current best description, not as a finished product definition.

## Core User Experiences

- Study a theme: A user opens a theme and works through its words with hints and TTS support. This is the most direct learning flow and the simplest path from content to practice.
- Manage themes: A user creates, edits, generates, shares, archives, and sometimes collaborates on themes. Themes are the core content unit that feeds study, solo challenge, duels, and weekly goals.
- Solo challenge: A user practices against the app using duel-style structure without needing another player. This keeps the game layer available even when learning alone.
- Start or join a duel: Two users use shared challenge structure to practice together in either classic or solo-style modes. In practice this can be synchronous in-app play or a structure that supports learning together in real life.
- Weekly goals: Two users create a shared plan, add themes, lock it in, and work toward completion together. Goal progress can unlock boss-style challenge moments that turn shared study progress into a milestone event.

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
- `challenges`: the main duel records, including participants, chosen themes, generated session words, mode-specific game state, and optional weekly-goal linkage.
- `weeklyGoals`: shared plans between two users that track chosen themes, participant lock flags, lifecycle state, completion progress, and boss readiness.
- `notifications`: in-app event records for friend requests, duel activity, scheduled duels, and weekly-goal events.
- `notificationPreferences`: per-user settings controlling which notification and reminder events should fire.
- `emailNotificationLog`: idempotency and audit support for sent email notifications and reminders.
- `scheduledDuels`: future duel proposals with participants, timing, mode, readiness state, and optional started-duel linkage.

Important relationships:

- Users own themes and can also see or edit some themes through sharing rules.
- Users connect through friend requests and `friends`, then collaborate through duels, scheduled duels, and weekly goals.
- Challenges reference users and themes, and some challenges are created in the context of a weekly goal.
- Notifications and reminder systems reflect activity from friend, duel, scheduled duel, and weekly-goal flows instead of being standalone features.

Weekly goal lifecycle:

- Stored lifecycle values are `draft`, `locked`, `grace_period`, and `completed`.
- `lock_proposed` is derived, not stored: the goal is still `draft`, at least one participant lock flag is true, and not all required participants have locked.
- Theme progress can be marked during planning, including `draft` and derived `lock_proposed`; boss access still starts only after both participants lock.
- Boss status values are `unavailable`, `ready`, and `defeated`.
- Completed goals are retained in the database but hidden from the active weekly-goal list.
- Declined draft goals are deleted.
- Goal lifecycle `completed` and boss status `defeated` intentionally use different words so the final goal state and boss outcome are not confused.

## Entry Points For AI Work

- Start in [`convex/schema.ts`](/Users/michalkrsik/coding_projects/language_duel/convex/schema.ts) when you need the core data shape and the main domain entities.
- Start in [`app/`](/Users/michalkrsik/coding_projects/language_duel/app) when the work is about user-facing routes, screens, or UI behavior.
- Start in [`convex/`](/Users/michalkrsik/coding_projects/language_duel/convex) when the work is about backend rules, persistence, notifications, reminders, or feature flows.
- Start in [`hooks/`](/Users/michalkrsik/coding_projects/language_duel/hooks) when the work is about client-side orchestration such as duel lobby behavior or user syncing.
- Start in [`lib/`](/Users/michalkrsik/coding_projects/language_duel/lib) when the work is about shared pure logic, validation, scoring, theme helpers, or other reusable domain utilities.

## Domain Terms

- Theme: the core content unit, made of words and answers plus metadata like description, word type, sharing, and editability.
- Duel: a structured two-person practice session. The name sounds more competitive than the broader product intent.
- Solo challenge: a duel-style learning flow without another player.
- Weekly goal: a shared study plan between two users, built from selected themes and tracked toward completion.
- Boss: a milestone challenge generated from weekly-goal progress, used to turn shared progress into a more game-like event.
- Scheduled duel: a duel proposal for a future time, including readiness tracking before the actual challenge starts.
- TTS: text-to-speech audio attached to theme answers and used to support studying and challenge flows.

## App-Specific Gotchas

- Theme access is not just public versus private. Themes can be private or shared, and shared themes can separately allow or forbid friend editing.
- "Duel" does not always mean head-to-head competition. Many flows use duel mechanics as structure for collaborative practice.
- There are multiple challenge modes, especially classic and solo-style, and they do not share the same state shape or UX expectations.
- Weekly goals, boss challenges, notifications, and reminders are connected. Changes in one area can affect behavior in the others.
- Scheduled duels are their own system, not just delayed normal duels. They have proposal, counter-proposal, readiness, and start-transition behavior.
- Themes are reused across study, solo challenge, duels, and weekly goals, so content changes can have effects in multiple surfaces.

## Risks And Active Decisions

- Product positioning is still unsettled. The current experience is more collaborative than the name "Language Duel" suggests.
- Naming tension matters: some code and UI language still lean competitive, while the broader product thesis is moving toward learning together.
- AI should be careful not to over-optimize for one play style. The app supports in-app play, solo play, and side-by-side real-life learning rhythms.

## How AI Should Maintain This Doc

- Treat this file as the primary big-picture orientation doc for AI work in this repo.
- Suggest updates when user-visible behavior, architecture, data-model shape, or important product decisions change.
- Ask the user before editing this file. Do not silently rewrite it during unrelated work.
- Keep it compact and high-signal. If information is already clear from code or tests, this file should usually point to the concept rather than restate implementation detail.
