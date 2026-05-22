# PvE Mode — Review Fixes Plan

**Status:** Ready to implement. Decisions locked with user.
**Sources:** Review findings on `Dev/pve-mode-plan.md` · `AGENTS.md`
**Predecessor:** `Dev/pve-mode-plan.md` (this plan addresses gaps and bugs found during review)

This plan turns the review findings into concrete steps. Each step lists the touchpoints, the expected behavior, and the validation gate.

---

## Locked decisions

| # | Issue | Decision |
|---|-------|----------|
| 1 | `+10 Seconds` hint label vs +15s actual effect | Rename label to `+15 Seconds`. Keep the rule (10 + universal 5 = 15). |
| 2 | `tmp/pve-status.html` artifact in working tree | Delete it. |
| 3 | Migration files (`backfillDuelMode.ts`, `backfillHintPoolFields.ts`) and `Legacy*` types | One-time exception: run on dev → verify → run on prod → verify → delete files and `Legacy*` types. |
| 4 | Required-schema deploy ordering | Accept brief crash window. Use Convex `schemaValidation: false` temporarily if the deploy refuses; flip back to true after backfill completes. |
| 5 | DuelView leaks sabotage UI to PvE between questions | Re-gate: branch on `isPve` first, then on phase. |
| 6 | `PVP_HINT_ELIMINATION_PICKS` duplicated in UI | Create `lib/hints/constants.ts`. Import in `convex/` and UI. Remove all hardcoded `2`s. |
| 7 | `DuelView.tsx` at 697 LOC | Defer split to a separate follow-up PR. Not in scope here. |
| 8 | Missing UI validation tests called out in plan | Add the 4 missing tests (PvE has no sabotage panel, PvE has no “Begging for help”, invite card renders mode chip, anagram/letter-count reveal renders under the question, two-client pool sync). |

---

## Implementation order

Recommended order: **1 → 2 → 3 → 4 → 5 → 6 → 7**. Step 7 (migration execution) is the final release gate and only runs after every code change has shipped.

---

## Step 1 — Move `PVP_HINT_ELIMINATION_PICKS` to `lib/hints/`

**Goal:** One source of truth for the PvP hint elimination count. No hardcoded `2` in UI.

### Create
- `lib/hints/constants.ts`
  ```ts
  export const PVP_HINT_ELIMINATION_PICKS = 2;
  ```

### Update imports
- `convex/constants.ts` — remove the local `PVP_HINT_ELIMINATION_PICKS` declaration and re-export from `lib/hints/constants.ts`, or update every Convex consumer to import directly from `lib/hints/constants.ts`. Prefer direct import.
- `convex/hints.ts` — import from `lib/hints/constants.ts`.
- `app/duel/[duelId]/hooks/buildDuelViewProps.ts` — replace hardcoded `2` in `args.eliminatedOptions.length < 2` with the imported constant.
- `app/game/components/duel/HintSystemUI.tsx` — replace hardcoded `2` in the “options eliminated” copy with the imported constant.

### Validation
- `npm run typecheck` passes.
- Grep `rg "\\b2\\b" app/duel app/game/components/duel/HintSystemUI.tsx` shows no remaining hardcoded count for this concept.

---

## Step 2 — Rename `+10 Seconds` hint label to `+15 Seconds`

**Goal:** Label matches actual behavior. No rule change.

### Touches
- `app/duel/[duelId]/components/HintPoolUI.tsx` — change the visible label from `+10 Seconds` to `+15 Seconds` (keep the underlying hint type id unchanged).
- Any test that asserts the visible label string — update to `+15 Seconds`.

### Explicit non-changes
- `lib/hintPool/rules.ts` — leave `resolveEffect("plus_ten_seconds")` returning 15s total.
- `tests/lib/hintPool/rules.test.ts` — keep the `+15` numeric assertion.
- Hint type identifier (e.g. `"plus_ten_seconds"`) stays as-is; this is a label-only change.

### Validation
- `npm run test:run -- tests/components/HintPoolUI.test.tsx tests/lib/hintPool/rules.test.ts` passes.
- Manual smoke: hint button reads `+15 Seconds` in PvE duel.

---

## Step 3 — Fix DuelView sabotage-leak in PvE

**Goal:** Sabotage panel never renders in PvE, regardless of phase.

### Current bug
`app/duel/[duelId]/components/DuelView.tsx:645` ternary:
```tsx
{isPve && phase === "answering" && word !== "done" ? (
  <HintPoolUI ... />
) : (
  <SabotageSystemUI ... />  // ← falls here for PvE between questions
)}
```

### Fix
```tsx
{isPve ? (
  phase === "answering" && word !== "done" ? <HintPoolUI ... /> : null
) : (
  <SabotageSystemUI ... />
)}
```

### Validation
- Add a test under Step 6 that asserts PvE never renders `SabotageSystemUI` in any phase.
- Manual smoke: open a PvE duel, observe that no sabotage panel appears between questions or at end of duel.

---

## Step 4 — Delete `tmp/pve-status.html`

**Goal:** Remove obsolete scratch artifact.

### Action
- `rm tmp/pve-status.html`.
- If the `tmp/` directory becomes empty and is intended to stay personal-only, optionally add `tmp/` to `.gitignore` in a separate commit. Out of scope for this plan unless we discover other files there.

### Validation
- `git status` no longer shows `tmp/pve-status.html`.

---

## Step 5 — Add missing UI validation tests

**Goal:** Cover the four behaviors the plan promised but no test currently asserts.

### New / updated tests

1. **PvE duel has no sabotage panel** — `tests/components/DuelSession.test.tsx` (or a new `tests/components/DuelView.pve.test.tsx`).
   - Render `DuelView` in PvE mode across phases (`"answering"`, between questions, completed).
   - Assert `SabotageSystemUI` test-id is not in the DOM in any phase.

2. **PvE duel has no “Begging for help” button** — same file.
   - Render `DuelView` in PvE mode.
   - Assert no element with the request-hint test id / text exists.

3. **Invite card renders mode chip** — `tests/components/NotificationsTab.test.tsx` or `NotificationPanel.test.tsx`.
   - Render a `challenge_invite` notification with `duelMode: "pve"`.
   - Assert mode chip text is visible.
   - Render again with `duelMode: "pvp"` and assert the corresponding chip.

4. **Anagram / letter-count reveal renders under the question** — `tests/components/DuelSession.test.tsx`.
   - Set `currentQuestionHintReveal = { kind: "anagram", value: "obrne" }` and assert the anagram appears under the prompt.
   - Set `currentQuestionHintReveal = { kind: "letterCount", value: 5 }` and assert the count appears under the prompt.

5. **Two clients see the same pool state** — `tests/components/HintPoolUI.test.tsx` (or duel session test).
   - Render two `HintPoolUI` instances against the same shared state.
   - Fire a hint in one; assert the other instance reflects the same `usedHints` / `usedCount`.
   - If the test framework can’t simulate two subscribers, mock the shared state and verify both renders reflect the same `props`.

### Validation
- `npm run test:run` passes including the new tests.
- New tests fail before the Step 3 fix and pass after — confirms the sabotage-leak test is actually testing.

---

## Step 6 — Pre-deploy validation gate

Per `AGENTS.md`, before any migration runs:

- `npm run lint` clean.
- `npm run typecheck` clean.
- `npm run test:run` clean.
- Coverage threshold (70%) still met for touched files.

If any of these fail, fix before moving to Step 7.

---

## Step 7 — Run migrations, then delete migration residuals

**Goal:** Backfill existing data on dev and prod, then remove all migration code per `AGENTS.md` no-backwards-compatibility rule.

### Pre-flight
- Confirm with Michal before running against prod.
- Have the Convex dashboard / CLI ready to flip `schemaValidation: false` temporarily if the deploy refuses to push the required-field schema. Flip back to `true` after backfill completes.

### Dev sequence
1. Deploy current code to dev (with required schema as-is).
   - If Convex rejects deploy due to existing rows missing required fields, set `schemaValidation: false` in `convex/schema.ts`’s config, redeploy, then re-enable after step 3.
2. Run `internal.migrations.backfillDuelMode.backfillDuelMode` with `dryRun: false`.
3. Run `internal.migrations.backfillHintPoolFields.backfillHintPoolFields` with `dryRun: false`.
4. Verify both mutations report the expected counts and zero remaining rows missing the new fields.
5. Re-enable `schemaValidation: true` if it was disabled. Redeploy and confirm clean.
6. Smoke-test: create a PvP duel, a PvE duel, accept an invite, open a notification. Nothing crashes.

### Prod sequence (only after dev is clean)
- Repeat the dev sequence against prod.

### Residual cleanup (commit after prod backfill succeeds)
- Delete `convex/migrations/backfillDuelMode.ts`.
- Delete `convex/migrations/backfillHintPoolFields.ts`.
- Delete the `convex/migrations/` directory if it becomes empty.
- Delete any test files that exercise these migrations.
- Remove any export references to the migration mutations from `convex/_generated` (these regenerate automatically on the next `convex dev` / `convex deploy`).
- Confirm grep for `Legacy` returns zero hits inside `convex/migrations/` or anywhere else introduced by these migrations.

### Validation after cleanup
- `npm run lint`, `npm run typecheck`, `npm run test:run` all clean.
- `rg "LegacyChallenge|LegacyDuel|LegacyNotification" convex/` returns nothing.

---

## Out of scope (parked for follow-up)

- **DuelView split** (extract `DuelQuestionHeader`, `DuelAnswerGrid`, mode-specific footer). Tracked separately; not in this PR.
- **`tmp/` ignore policy.** Only address if Step 4 reveals other files needing the same treatment.
- **Telemetry / analytics mode dimension.** Same parked status as in the main PvE plan.

---

## Handoff checklist

Before declaring done:
- [ ] Step 1–6 complete; all listed validations pass.
- [ ] Migrations have been run on dev and prod, then deleted (Step 7).
- [ ] `npm run lint` clean.
- [ ] `npm run typecheck` clean.
- [ ] `npm run test:run` clean (full suite, single run).
- [ ] Coverage threshold (70%) still met for touched files.
- [ ] No remaining `Legacy*` types or backfill code in the repo.
- [ ] `tmp/pve-status.html` removed.
