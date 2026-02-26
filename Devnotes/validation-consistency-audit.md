# Validation Consistency Audit (Living)

Last updated: 2026-02-16  
Scope status: Complete boundary pass for current snapshot

## Context

Goal: evaluate how consistently we validate data across frontend and backend, and whether validation is diligent enough without overengineering.

This document is intentionally living. New findings should be appended in the iteration log and reflected in the matrix/findings sections.

## Coverage Checklist

- API routes reviewed: `2/2`
  - `app/api/generate/route.ts`
  - `app/api/tts/route.ts`
- Convex handler modules reviewed: `16/16`
  - `convex/admin.ts`
  - `convex/emails/actions.ts`
  - `convex/emails/notificationEmails.ts`
  - `convex/emails/reminderCrons.ts`
  - `convex/friends.ts`
  - `convex/gameplay.ts`
  - `convex/hints.ts`
  - `convex/lobby.ts`
  - `convex/notificationPreferences.ts`
  - `convex/notifications.ts`
  - `convex/sabotage.ts`
  - `convex/scheduledDuels.ts`
  - `convex/themes.ts`
  - `convex/userPreferences.ts`
  - `convex/users.ts`
  - `convex/weeklyGoals.ts`
- Frontend text/number/select input controls reviewed: `16/16`
- Validation-relevant tests reviewed: `41` files
- Extra review method: 3 explorer sub-agents (backend, frontend, tests/docs) + manual verification

## Executive Verdict

Overall: **mostly diligent**, with strong auth and boundary checks in Convex and good targeted frontend guards.  
Main inconsistency: **theme generation/editing path and `/api/generate` payload validation are significantly weaker server-side than frontend assumptions**.

Diligence level:

- Good: auth checks, permission checks, many business-rule checks, notification offset bounds, scheduled-time checks, response-shape parsing in client API layer.
- Weak spots: server request validation for `/api/generate`, theme data invariants at persistence boundary, and some frontend keyboard/submit path mismatches.

## Validation Matrix

| Domain | Frontend validation | Backend validation | Consistency |
|---|---|---|---|
| Nickname | Regex + min/max in `app/settings/hooks/useNicknameUpdate.ts:19-29`; input `maxLength` in `app/settings/components/NicknameEditor.tsx:78` | Re-validates regex + min/max in `convex/users.ts:163-170` | Mostly consistent |
| Notification offsets | Numeric `min/max` in `app/settings/notifications/components/ReminderOffsetInput.tsx:47-51` | Hard min/max enforcement in `convex/notificationPreferences.ts:70-87` | Consistent |
| Scheduled duel time | UI offers future slots via `lib/timeUtils.ts:16-33` | Enforces future time in `convex/scheduledDuels.ts:188-191` and `:414-417` | Consistent |
| TTS request body | Minimal client-side precheck in `app/game/hooks/useTTS.ts:64-69` | Type/trim/max checks in `app/api/tts/route.ts:312-329` | Good defense-in-depth |
| Theme generation request (`/api/generate`) | UI has length constraints in `app/themes/components/GenerateThemeModal.tsx:125-159` and `app/themes/components/WordEditor.tsx:166-185` | Only `type` checked in `app/api/generate/route.ts:189-198`; other fields trusted | Inconsistent |
| Theme persistence (`createTheme`/`updateTheme`) | UI checks duplicates before save in `app/themes/hooks/useThemesController.ts:445-464` | `v.string`/`v.array` shape only in `convex/themes.ts:470-515`; no business bounds | Inconsistent |
| Color/background preferences | UI selector options constrained in settings components | Backend whitelist checks in `convex/userPreferences.ts:49-74` | Mostly consistent (see low findings) |
| Duel/hint gameplay | UI mostly constrained by flow | Strong auth/state checks in `convex/gameplay.ts`, `convex/hints.ts`, `convex/lobby.ts` | Strong |

## Findings (Severity Ordered)

### [High] `/api/generate` trusts malformed request bodies and can crash on bad shapes

- `request.json()` is cast to `GenerateRequest` without runtime schema validation (`app/api/generate/route.ts:187`).
- `buildMessages` does `(history || []).map(...)` (`app/api/generate/route.ts:98-101`), which throws if `history` is non-array.
- Prompt builders call `.join` on `existingWords`/`rejectedWords` (`lib/generate/prompts.ts:184-186`, `:355`, and other join usage), which throws when payload shape is wrong.
- `generate-random-words` uses `Math.floor(count)` without type guard (`app/api/generate/route.ts:369-372`), so non-number input can become `NaN` and break downstream.

Impact: malformed or hostile payloads can produce 500s and bypass frontend constraints.

### [High] Theme write boundary does not enforce core data invariants

- Theme word validator is shape-only (`wrongAnswers: v.array(v.string())`) in `convex/themes.ts:13-18` and `convex/schema.ts:8-13`.
- `createTheme`/`updateTheme` accept unconstrained strings and arrays (`convex/themes.ts:470-567`).
- No server-side constraints for:
  - theme name length
  - description/prompt length
  - word count bounds
  - wrong answer count bounds
  - non-empty normalized strings

Impact: direct API callers can persist data the UI does not expect.

### [High] Nickname Enter submit can trigger unexpected discriminator changes

- Button disables unchanged values (`hasChanged`) in `app/settings/components/NicknameEditor.tsx:46-47` and `:117`.
- Form submit handler still calls `onUpdate(nickname.trim())` on Enter with no `hasChanged` guard (`app/settings/components/NicknameEditor.tsx:34-44`).
- Backend always generates a new discriminator on update (`convex/users.ts:173-180`), even for same nickname.

Impact: pressing Enter in unchanged nickname field can still rotate discriminator.

### [Medium] Level 2/3 keyboard Enter path bypasses trimmed non-empty button guard

- Enter path submits directly (`app/game/levels/Level2TypingInput.tsx:295`, `app/game/levels/Level3Input.tsx:112`).
- Submit buttons are disabled on `!inputValue.trim()` (`Level2TypingInput.tsx:313`, `Level3Input.tsx:208`).
- `handleSubmit` compares raw input (accent-normalized only), not trimmed (`Level2TypingInput.tsx:59-67`, `Level3Input.tsx:59-73`).

Impact: whitespace/trailing-space input behavior differs by interaction path.

### [Medium] Theme editor field limits are uneven

- `customInstructions` is capped at 250 (`app/themes/components/WordEditor.tsx:166-185`).
- `userFeedback` has no max length (`app/themes/components/WordEditor.tsx:260-272`).
- Manual input field has no max length (`app/themes/components/WordEditor.tsx:315-327`).
- `AddWordModal` has no max length (`app/themes/components/AddWordModal.tsx:69-88`).

Impact: inconsistent UX and no predictable upper bound for prompt-bound text outside some paths.

### [Low] Enum strategy is mixed (`v.union(v.literal(...))` vs `v.string()+manual check`)

- Runtime checks used for enum-like fields in:
  - `convex/sabotage.ts:55-67`
  - `convex/hints.ts:260-272`
  - `convex/hints.ts:375-389`
- Some paths do not validate allowed literals at all (`acceptSoloHintL2` stores `hintType` directly in `convex/hints.ts:372-389`).

Impact: harder to reason about invariants; easier to regress.

### [Low] Background hydration accepts unvalidated local value

- `BackgroundProvider` hydrates raw `localStorage` value (`app/components/BackgroundProvider.tsx:31-35`) without whitelist check.
- Backend enforces whitelist in `convex/userPreferences.ts:72-74`.

Impact: local invalid value can lead to inconsistent client state until server preference overwrites it.

## What Is Strong Today

- Convex boundary coverage is broad (args validators present across all reviewed handlers).
- Permission/auth checks are generally explicit and well-placed in backend handlers.
- `/api/tts` has clear request validation and error mapping (`app/api/tts/route.ts:312-329`).
- Client parsing for AI API responses is defensive (`lib/themes/api.ts` envelope and shape guards).
- Several domains correctly mirror frontend/backend constraints (nickname, reminder offsets, scheduled duel time).

## Test and Documentation Gaps

### Missing/weak tests

- No request-level invalid-payload tests for `/api/generate`.
- No request-level tests for `/api/tts` validation boundaries.
- No tests for theme persistence bounds in `createTheme`/`updateTheme`.
- No tests for keyboard submit mismatch in `Level2TypingInput`/`Level3Input`.
- No tests for nickname Enter-submit unchanged behavior.
- No tests for `lib/themes/validators.ts` duplicate/matching helpers.

### Documentation gap

- `DOCUMENTATION.md` has no explicit validation policy/contract section.

## Recommended Priority Plan

1. Add runtime request schema validation for `/api/generate` (all variants).
2. Enforce theme invariants at Convex write boundary (`createTheme`/`updateTheme` + shared validator constants).
3. Fix submit-path consistency in `NicknameEditor`, `Level2TypingInput`, and `Level3Input`.
4. Standardize enum validation strategy (prefer schema-level unions where practical).
5. Add focused tests for all items in “Missing/weak tests”.
6. Add a concise “Validation Contract” section to `DOCUMENTATION.md`.

## Iteration Log

### Iteration 1 (2026-02-16)

- Completed full boundary audit and evidence collection.
- Identified primary inconsistency cluster around theme generation/edit flow and server boundary enforcement.
- Added severity-ranked findings and priority plan.

### Iteration 2 (2026-02-16)

- Added sub-agent cross-check findings.
- Confirmed high-severity nickname Enter-submit side effect path.
- Confirmed keyboard path mismatch in Level 2/3 typing inputs.
- Confirmed local background hydration whitelist mismatch.

---

Owner note: keep updating this file as fixes land. When a finding is fixed, move it to a “Resolved” section with PR/date and test references.
