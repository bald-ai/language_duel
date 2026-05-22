# Clean Code Review Cleanup Plan

## Goal

Clean up the remaining review findings in the same direction as recent repo work:

- clear backend boundaries
- one source of truth for product rules
- no broad "view implies edit" permissions
- no hidden durable side effects
- no loose optional field combinations that later code has to guess about
- backend-owned truth for gameplay/progress that matters
- focused modules over large mixed-purpose helpers

This plan starts with Must findings, then folds in only cheap adjacent Might cleanup when it supports the same boundary.

## Scope Honesty

Not every item below is pure code cleanup. Each item is tagged so reviewers (and future-AI) can tell what kind of change it is:

- **[cleanup]** — pure code-cleanliness change. No user-visible behavior change.
- **[security]** — closes a real access/auth/anti-cheat hole. Behavior changes for malicious or accidental misuse.
- **[reliability]** — fixes a correctness/duplication/loss bug. Behavior changes in failure modes only.
- **[product]** — changes intentional product behavior. Not in this plan; see explicit "Out of scope" note below.

**Out of scope for this plan (intentionally removed):**

- Friend-bounded normal challenges. Restricting normal challenges to accepted friends is a product policy decision, not cleanup. Track it separately as a product/ADR decision if you decide to keep it. Note: current uncommitted `convex/challenges.ts` already enforces this. If you want to drop it, revert the `areUsersFriendsInDb` check in `createChallenge` separately from this plan.

## Inferred Decisions

### Shared Pure Logic / Utilities

1. **[security]** Stored theme TTS generation uses real edit permission.
   - Pick: owner, or actual friend/editor when the theme is shared and `friendsCanEdit` is enabled.
   - Do not let challenge/duel/solo/weekly-goal view access mutate theme TTS (TTS spends credits — this is also a billing fix).
   - Acceptance: a viewer who only sees a shared theme via a duel/challenge cannot trigger TTS generation; covered by a test that constructs that exact viewer relationship.

2. **[cleanup]** Theme word-count validation has one backend validation path.
   - Use shared theme-word validation as the source of truth.
   - Acceptance: a single function in `lib/` is called from server `themes` write paths and from UI; no parallel branch checks word counts.

3. **[cleanup]** Weekly-goal timing constants flow from `lib` to Convex, not from Convex to `lib`.
   - Shared helpers import directly from shared modules.
   - Acceptance: no `lib/*` file imports from `convex/*`.

4. **[cleanup]** Cross-layer product limits live in shared modules.
   - UI and backend import the same weekly-goal min/max and similar product rules.
   - Acceptance: grep for the raw numeric limits returns only the shared module declaration.

5. **[reliability]** Notification preference reads produce safe values.
   - Invalid stored reminder offsets default back to safe defaults before reminder planning.
   - Acceptance: a preferences row with an out-of-range offset does not crash reminder planning; test asserts the safe-default fallback.

6. **[cleanup]** Time helpers accept optional `now` / `nowTimestamp`.
   - Keep UI convenience defaults, but allow deterministic callers/tests.
   - Acceptance: every helper used in time-sensitive tests is callable with an injected `now`; existing call sites unchanged.

7. **[cleanup]** Spaced repetition step number and interval are derived from array position.
   - Do not store duplicate `step` / `intervalDays` truth in completed steps.
   - Acceptance: schema no longer carries `step`/`intervalDays` on completed entries; UI/server derive both from index.

8. **[cleanup]** Theme validation uses shared low-level duplicate/match rules.
   - Server and UI can keep different output shapes.
   - Acceptance: the dup/match comparator is one function; server and UI wrap it.

9. **[cleanup]** Error handling has one shared backend-error reader.
   - Surfaces can format `{ code, message }` differently.
   - Acceptance: all `ConvexError` consumers go through the shared reader; no ad-hoc `error.data?.code` reads remain.

### Notifications / Email / Preferences

1. **[reliability]** Email send idempotency uses explicit state.
   - Prefer `pending -> sent -> failed` or a separate claim table.
   - Durable "sent" state is written only after provider success.
   - Failed/pending-stale sends must be retryable, not silently lost.
   - Acceptance: a provider failure leaves the row in a retryable state (not `sent`); a retried send that succeeds does not double-deliver; tests cover both paths.

2. **[cleanup]** Notification preference updates patch explicit fields.
   - Do not send/replace the full settings row for one toggle.
   - Backend should accept partial updates or field-specific mutations.
   - Acceptance: a single-toggle UI action sends only that field; concurrent toggles of different fields do not clobber each other (test asserts).

3. **[cleanup]** Email trigger inputs are strict per trigger.
   - Challenge email requires `challengeId`.
   - Duel email requires `duelId`.
   - Weekly-goal email requires `weeklyGoalId`.
   - Reminder dedupe fields are validated before rendering/logging.
   - Missing required context is an error, not generic fallback email content.
   - Acceptance: missing required ID throws at the trigger boundary, never produces a degraded/generic email body.

4. **[cleanup]** Cheap adjacent cleanup:
   - Derive trigger names from shared definitions where practical.
   - Split email data builders by trigger family if it makes strict contracts easier.
   - Keep existing pure reminder planners.

### Friends / Challenges / User Relationships

1. **[cleanup]** Expired challenge cleanup uses challenges as the source of truth.
   - Query pending challenges by `status` / `createdAt`.
   - Notifications are downstream records, not the lifecycle owner.
   - Acceptance: deleting all challenge-related notifications still expires challenges correctly; the cron no longer reads notifications to find expired challenges.

2. **[security]** User discovery is handle-oriented, not broad email search.
   - Prefer exact padded-handle or stricter username search.
   - Do not allow broad two-character email-fragment discovery.
   - Acceptance: a 2-character query against a substring of someone else's email returns no results; exact handle/username still works.

3. **[cleanup]** Cheap adjacent cleanup:
   - Add a small relationship-policy helper for "are these users friends?" (used by theme TTS edit policy and elsewhere).
   - Share public user summary shaping so identity display does not drift.
   - Unify challenge acceptance boundary checks where convenient.

### Game / Solo / Duel Runtime

1. **[security]** Duel clients never receive answer keys before allowed feedback/results.
   - `getDuel` returns viewer-safe question DTOs.
   - Server remains authoritative for scoring.
   - Correct answer can be revealed only after answer lock / feedback / results.
   - Acceptance: a query-payload snapshot test asserts `correctOption` is absent until reveal conditions are met for each role.

2. **[security]** Spaced-repetition solo completion is server-owned.
   - Durable repetition progress cannot advance just because local React state says complete.
   - Either persist solo answer/progress events server-side, or create a server-owned attempt state for repetition sessions.
   - Completion mutation validates that server-owned state before advancing repetition.
   - Acceptance: calling the completion mutation without matching server-owned progress is rejected; covered by a test.

3. **[cleanup]** Gameplay final-answer flow does not directly hide boss/repetition side effects.
   - Gameplay produces an explicit completion result.
   - Boss completion and repetition completion are separate named commands.
   - Tests cover each workflow separately.
   - Acceptance: there is no single mutation whose name says "answer" but whose body also completes a boss; each lifecycle has its own named entry point.

4. **[cleanup]** Session source contracts are discriminated.
   - `normal`, `boss`, and `spaced_repetition` attempts have explicit valid shapes.
   - Invalid combinations like `sourceType: "normal"` with boss fields are rejected at creation.
   - Acceptance: the API/input validator type is a discriminated union (not an object of optionals); each invalid combination has a test that asserts rejection.

5. **[cleanup]** Solo practice active runtime moves into shared/testable logic.
   - Extract the active solo state machine from React into pure logic.
   - Inject RNG/seed.
   - React renders state and dispatches actions; it does not own the business rules.
   - Acceptance: the reducer is fully testable without React; existing solo behavior is preserved (snapshot/parity test against the old hook).

6. **[cleanup]** Cheap adjacent cleanup:
   - Treat dead/future runtime helpers as remove-or-quarantine, not active code.
   - Centralize scoring constants when touching scoring.
   - Make solo timers lifecycle-safe as part of the reducer/state-machine move.

## Execution Order

### Phase 1 - Shared Rules Foundation

Purpose: remove duplicated low-level rules before feature fixes build on them.

1. Fix shared import direction for weekly-goal timing.
2. Move weekly-goal product limits into shared constants.
3. Centralize theme word-count validation.
4. Make notification preference read-normalization safe for invalid stored offsets.
5. Add optional `now` parameters to time helpers touched by reminder/game tests.
6. Add shared backend-error reader.
7. Change spaced repetition completed-step shape to derive step/interval from position.
8. Share theme duplicate/match validation primitives.

Pre-mortem:
- SR completed-step shape change (#7) is a schema-shape change. Existing rows with `step`/`intervalDays` must be tolerated on read (treat as derived-from-index) until they age out, OR a one-shot migration. Do not silently drop the stored values without a read path.
- Shared import direction (#1) can surface circular import errors first; fix by moving the constants down to `lib/` and re-exporting from `convex/` if needed.

Validation:
- targeted shared/lib tests
- affected Convex tests
- typecheck

### Phase 2 - Permission And Relationship Boundaries

Purpose: make "who can do what" explicit.

1. Replace stored TTS permission with a backend edit policy. **[security]**
2. Add relationship policy helpers. **[cleanup]**
3. Tighten user search to handle-oriented discovery. **[security]**
4. Move expired challenge cleanup to challenge records. **[cleanup]**

Pre-mortem:
- TTS edit policy (#1) will reject viewers who previously could trigger TTS on shared themes. Confirm the UI handles the rejection cleanly (no broken loading state). Add a test that asserts the rejection error code reaches the client.
- Expired challenge cleanup move (#4) means any code that depended on the notification-driven cleanup side effect must be checked. Search for callers/tests of the old notification-based query path.
- User-search tightening (#3) can break existing tests that assume substring email matching. Update those tests rather than weaken the new behavior.

Validation:
- theme access tests
- friends/challenges tests
- notification challenge cleanup tests
- typecheck

### Phase 3 - Notification And Email Reliability

Purpose: stop email logs and preferences from lying.

1. Replace "claim row with `sentAt`" with explicit email send state or separate claim. **[reliability]**
2. Make sent log durable only after provider success. **[reliability]**
3. Make stale pending/failed sends retryable. **[reliability]**
4. Change notification preference save mutation to patch explicit fields. **[cleanup]**
5. Add per-trigger email input contracts. **[cleanup]**
6. Split email data builders only as much as needed to support strict contracts. **[cleanup]**

Pre-mortem:
- Send-state machine change (#1) risks double-sends during the cutover. Acceptable mitigation: deploy state-machine read path first (tolerate both shapes), then writer flip. Otherwise, run a one-shot backfill that turns existing `sentAt` rows into `state: sent`.
- Per-trigger contracts (#5) will turn previously silent "fallback email body" cases into hard errors. Audit existing callers to ensure the required IDs are always present before merging — otherwise reminders break in prod.

Validation:
- notification preference tests
- notification email idempotency tests
- reminder cron tests
- template tests
- typecheck

### Phase 4 - Duel Runtime Security

Purpose: stop clients from seeing or controlling authoritative duel answers.

1. Introduce viewer-safe duel DTO from `getDuel`. **[security]**
2. Hide `correctOption` until answer feedback/results are allowed. **[security]**
3. Update `DuelSession` to consume DTOs, not raw duel questions. **[cleanup]**
4. Keep server-side answer scoring authoritative. **[security]**
5. Add tests proving query payload does not expose answer keys early. **[security]**

Pre-mortem:
- If `DuelSession` or any child component reads `correctOption` before reveal (e.g. to pre-style buttons), the UI will break silently. Grep for `correctOption` in `app/duel/**` before merge; replace with the reveal-gated `answerRevealedToViewer` field added by the DTO.
- The TTS storage id is also stripped pre-reveal; confirm audio playback is not pre-fetched on questions the viewer has not reached.

Validation:
- duel query/DTO tests
- duel scoring tests
- DuelSession tests
- typecheck

### Phase 5 - Session Source Contracts And Lifecycle Commands

Purpose: stop optional fields from acting like a hidden state machine.

Current status: partially implemented. The input validators were added, but explicit lifecycle commands and split boss/repetition completion mutations are still parked.

Already implemented:

1. Add input validation for session source combinations:
   - normal
   - boss
   - spaced repetition
2. Update challenge/session builders to reject invalid combinations.

Still to implement:

1. Make the discriminated contract explicit at the input type/API boundary, not only inside validator helpers. **[cleanup]**
2. Make gameplay completion return explicit lifecycle intent instead of hiding follow-up side effects inside the final-answer flow. **[cleanup]**
3. Move boss completion and repetition completion behind clear named commands/mutations. **[cleanup]**
4. Split tests so normal, boss, and spaced-repetition creation/completion each prove their own lifecycle path. **[cleanup]**

Pre-mortem:
- Splitting boss/repetition completion into named commands is a call-site migration. All existing callers of the combined entry point must be updated in the same commit, or the old entry must remain as a thin shim that throws if the discriminator is missing. Do not leave the old entry point silently accepting both shapes.
- Discriminated input types may break existing client call sites that pass a generic object. Update the call sites in the same commit; do not loosen the type to keep them compiling.

Validation:
- session creation tests
- gameplay rule tests
- weekly-goal boss tests
- weekly-goal repetition tests
- typecheck

### Phase 6 - Solo Practice Server Truth

Purpose: make durable solo/repetition progress real backend state.

Current status: partially implemented. Server-owned mastery was added, but the React state-machine extraction, injected RNG, and timer lifecycle work are still parked.

Already implemented:

1. Persist server-owned solo mastery/progress state for repetition completion.
2. Make `completeRepetitionSoloPractice` validate server-owned progress before advancing repetition.
3. Remove perfect-stats-from-word-count behavior from repetition solo completion.

Still to implement:

1. Fix the client/server race so the final mastery write cannot arrive after completion and leave repetition unadvanced. **[reliability]**
2. Extract active solo runtime state machine into shared pure logic. **[cleanup]**
3. Add injected RNG/seed for deterministic tests. **[cleanup]**
4. Make solo auto-advance timer behavior lifecycle-safe through the reducer/controller boundary. **[cleanup]**
5. Update solo page/hook tests around the reducer boundary and server-owned completion flow. **[cleanup]**

Pre-mortem:
- The reducer extraction is the largest single change in this plan. Strong recommendation: land it behind a parity test that runs the existing hook and the new reducer against the same input sequence and asserts identical state transitions. Without that, regressions in solo flow are almost certain.
- Injected RNG must default to `Math.random` for prod; tests pass a seeded RNG. Do not let the seed leak into prod via accidental default.
- Timer lifecycle: every `setTimeout` must be cleared in the reducer/controller teardown. Add a test that mounts and unmounts a solo session mid-question and asserts no pending timers (use fake timers and assert queue is empty).
- Client/server race (#1): the fix likely needs the completion mutation to wait on (or absorb) in-flight mastery writes. Avoid "just retry on the client" — the durable fix is server-side ordering.

Validation:
- solo runtime reducer tests
- solo repetition completion tests
- solo page/hook tests
- typecheck

## What Not To Do

- Do not keep compatibility branches for old and new data shapes unless a migration requires a short explicit transition.
- Do not "fix" this by adding more frontend checks while backend remains loose.
- Do not make view access imply edit access.
- Do not let notification rows own challenge lifecycle.
- Do not keep answer keys in client query payloads and rely on UI honesty.
- Do not silently accept invalid session source combinations.

## Suggested Commit Shape

Smaller, reviewable commits over shotgun batches. Each commit should compile and pass its own tests independently.

1. Shared constants / validators / error readers (Phase 1).
2. Theme TTS edit policy + relationship policy (Phase 2 #1–2).
3. User discovery tightening + expired-challenge cleanup source (Phase 2 #3–4).
4. Email send state + retryable failures (Phase 3 #1–3).
5. Preference partial updates + per-trigger email contracts (Phase 3 #4–6).
6. Duel safe DTO / answer-key hiding (Phase 4).
7. Session source contracts at API boundary + explicit completion commands (Phase 5 still-to-implement).
8. Solo runtime reducer extraction + RNG injection + timer lifecycle (Phase 6 still-to-implement #2–4).
9. Client/server race fix for repetition completion (Phase 6 still-to-implement #1).

Each commit should have targeted tests. Run full `npm run typecheck`, `npm run test:run`, and lint before final handoff after code changes.
