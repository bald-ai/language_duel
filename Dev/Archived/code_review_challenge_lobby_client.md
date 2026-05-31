# Code Review — Area 7: Challenge lobby (client orchestration)

**Date:** 2026-05-22
**Scope:** Challenge-lobby client state machine + lobby modals (create challenge / respond to
pending / waiting-for-opponent / mode + theme selection). ~1.49k LOC.
**Verdict:** 🟡 **APPROVE WITH CHANGES**

## Scope reviewed

- **Orchestration hooks:** `hooks/useChallengeLobby.ts` (135), `hooks/challengeLobby/types.ts`
  (12), `hooks/challengeLobby/useChallengeActions.ts` (114),
  `hooks/challengeLobby/useChallengeData.ts` (35), `hooks/challengeLobby/useChallengeModals.ts`
  (31), `hooks/challengeLobby/useChallengeStatusWatcher.ts` (39)
- **Pure logic:** `lib/challengeLobby/isSelfDuelSelection.ts` (9)
- **Modals/components:** `app/components/modals/ChallengeModal.tsx` (707),
  `ModeSelectionButton.tsx` (102), `DuelModePicker.tsx` (34), `ThemeSelector.tsx` (165),
  `JoiningModal.tsx` (19), `WaitingModal.tsx` (38), `challengeOptions.ts` (50)

Cross-file consumers traced (read for boundary impact, **not** in scope to change):
`app/HomePageClient.tsx`, `app/notifications/components/FriendDuelLauncher.tsx`,
`app/components/modals/SoloPracticeModal.tsx`, `tests/hooks/useChallengeActions.test.tsx`,
`tests/components/{ChallengeModalMeRow,DuelModePickerSurfaces,WeeklyGoalThemeMarkerSurfaces}.test.tsx`.

Excluded per assignment: `ModalShell.tsx`, `modalButtonStyles.ts`, `types.ts` (Area 15);
`SoloPracticeModal.tsx` (Area 8); `convex/challenges.*` (Area 6).

**Note on the special-focus brief.** The brief asks about "join by code". There is **no
join-by-code path** in this area — no code-entry UI, mutation, or state anywhere in scope
(`grep` for `joinByCode|challengeCode|inviteCode|enterCode` returns only `app/mock-online/`,
which is mock and out of scope). The real lobby state machine is **create-challenge →
waiting**, plus an embedded **respond-to-pending** surface and a **self-duel** shortcut. The
review below audits what actually exists.

---

## Headline assessment

The state machine itself is **good** and is the strongest part of this area. `ModalState`
(`hooks/challengeLobby/types.ts:5`) is a real discriminated string union — `"none" |
"soloPractice" | "challenge" | "waiting"` — not the scattered-booleans anti-pattern the brief
worried about. `useChallengeModals` derives the three `show*` flags from that one variable
(lines 22–24), so the four modal states are genuinely mutually exclusive by construction. That
is the right model and should be preserved.

The problems are: (1) `ChallengeModal.tsx` sits **exactly at** the 707-LOC guideline and is
three unrelated surfaces glued together; (2) a layer of **dead re-export / dead-field
indirection** in the hook split that buys nothing; and (3) two **two-color-system / dead-prop**
hygiene issues. None is a structural emergency, but the file-size + dead-surface combination
is over the approval bar.

---

## 🔴 Blockers

### 1. `ChallengeModal.tsx` (707 LOC) is at the project guideline and is two products in one file

The file is right on the ~700 LOC line and packs **three independent surfaces** plus three
selectors and an icon into one module:

- `ChallengeRespondSurface` (lines 185–277, ~90 LOC) — an **incoming-challenge inbox**
  (accept/decline pending challenges). This has nothing to do with *creating* a challenge.
- `ChallengeCreateSurface` (lines 297–367) — the actual create flow (opponent / theme /
  difficulty / mode).
- `OpponentSelector` (377–512, ~135 LOC), `CompactThemeSelector` (522–643, ~120 LOC),
  `DifficultySelector` (650–707, ~58 LOC) — three list-pickers each re-deriving its own
  styles.

A modal titled "Create Challenge" rendering an inbox of *other people's* invites above the
create form is a cohesion smell, not just a size smell. The respond-surface is also a **second
implementation** of incoming-challenge accept/decline: `NotificationsTab.tsx` already has a
notification-based accept/decline path (`actions.acceptChallenge(notificationId)`), so the same
product concept ("respond to a challenge") now has two UIs wired to two different backend entry
points (`challengeId` vs `notificationId`).

**Remedy:** extract the three sub-surfaces into sibling files —
`ChallengeRespondSurface.tsx`, `OpponentSelector.tsx`, `CompactThemeSelector.tsx` (and
optionally `DifficultySelector.tsx`). That alone drops `ChallengeModal.tsx` to ~250 LOC and
leaves it as a thin shell that composes them. While doing so, decide whether the respond-inbox
belongs in a *create* modal at all; if the answer is "it's a deliberate convenience surface,"
keep it but name the modal honestly. Do **not** leave it at 707 LOC with five components
inline.

### 2. The hook-split re-exports (`useChallengeLobby.ts:16–20`) are dead indirection — delete them

Lines 16–20 re-export `CreateChallengeOptions`, `ModalState`, and all four sub-hooks
(`useChallengeActions`, `useChallengeData`, `useChallengeModals`, `useChallengeStatusWatcher`)
through the barrel. **Nothing imports any of them through this barrel.** Verified:

- `ChallengeModal.tsx:22` imports `CreateChallengeOptions` from
  `@/hooks/challengeLobby/types` (the source), not the barrel.
- `tests/hooks/useChallengeActions.test.tsx:40` imports `useChallengeActions` from
  `@/hooks/challengeLobby/useChallengeActions` (the source), not the barrel.
- `useChallengeData`, `useChallengeModals`, `useChallengeStatusWatcher` have **zero** importers
  anywhere outside `useChallengeLobby.ts` itself.

These five lines are pure re-export noise that imply a public sub-hook API that no one
consumes, and they tempt future code to bypass `useChallengeLobby` (the only intended entry
point). The four sub-hooks are private implementation details of one composing hook.

**Remedy:** delete lines 16–20 entirely. Keep only the *value* `import`s the hook body needs
(lines 9–14). The single public surface is `useChallengeLobby()`.

### 3. `pendingCount` is dead from `useChallengeData` through the public hook return — delete the whole field

`useChallengeData` computes `pendingCount: pendingChallenges?.length || 0`
(`useChallengeData.ts:32`); `useChallengeLobby` re-returns it (`useChallengeLobby.ts:107`).
**No consumer reads `lobby.pendingCount`** (`grep` across `app/` returns nothing). It is a
fabricated public field that survives only because the return object is hand-maintained.

**Remedy:** delete `pendingCount` from both `useChallengeData`'s return and
`useChallengeLobby`'s return. (Note also `|| 0` would be the wrong idiom even if it were used —
`?? 0` — but the fix is deletion.) This is the same class of issue flagged as "vestigial public
surface" in the Area 1 review (#9) and should be held to the same bar.

---

## 🟡 Medium

### 4. `ModeSelectionButton.tsx` mixes two color systems in one component (static `cssVarColors` + live `useAppearanceColors`)

`ModeSelectionButton.tsx:6` imports `cssVarColors as colors` at module scope and builds
`toneMap` from it (lines 18–22). Inside the component, line 32 declares
`const colors = useAppearanceColors()`, **shadowing** the import. The result: within one
rendered button, `tone.DEFAULT` / `tone.light` (selected background, title color) come from
**static CSS-var strings**, while `colors.background` / `colors.text` / `colors.neutral` come
from the **live appearance hook**. Two color systems, half live, half static, in the same
element. This is exactly the dual-color-system defect blocked in the Area 1 review (#6).

**Remedy:** drop the `cssVarColors` import and build the tone lookup from the live `colors`
inside the component:

```ts
const tone = { primary: colors.primary, secondary: colors.secondary, cta: colors.cta }[selectedTone];
```

so every color in the button comes from one source. (`ModeTone` includes `"cta"` but
`DUEL_MODE_OPTIONS` only ever passes `"primary" | "secondary"` — the `cta` branch is unused;
consider narrowing `selectedTone` to the two modes that exist, per the no-dead-branch rule.)

### 5. `CompactThemeSelector` (inside `ChallengeModal`) duplicates the shared `ThemeSelector` theme-list rendering

`CompactThemeSelector` (`ChallengeModal.tsx:522–643`) and the shared `ThemeSelector.tsx`
render the **same** thing: loading state, empty state with a "create theme" CTA, a scrollable
list of theme rows (name + word count + `WeeklyGoalThemeMarker` + selection checkmark), and a
"Selected: …" footer. Both pull `useWeeklyGoalThemeIds()`, both inline the identical checkmark
`<svg>` (`M16.707 5.293…`), both maintain toggle semantics. The differences are cosmetic
(`max-h-40` vs `space-y-3`, rounded-xl vs rounded-2xl, footer summary vs none). `ThemeSelector`
already supports controlled selection (`draftThemeIds` / `onDraftThemeIdsChange`),
`hideConfirmButton`, and `hideCreateThemeButton` — i.e. it was *built* to be embedded.

**Remedy:** render the canonical `ThemeSelector` inside `ChallengeModal` (controlled, with
`hideConfirmButton`) instead of the bespoke `CompactThemeSelector`, or, if the compact visual
is required, add a `variant`/`compact` prop to `ThemeSelector` and converge. Deletes ~120 LOC
of duplicated picker and one of the duplicated checkmark SVGs. This directly serves Blocker #1.

### 6. Local `User` / `Viewer` / `PendingChallenge` shapes in `ChallengeModal` are ad-hoc duplicates of canonical types

`ChallengeModal.tsx:36–53` hand-declares `User`, `Viewer` (byte-identical to `User`), and
`PendingChallenge`. `User`/`Viewer` are exactly the field set `formatVisibleUser` consumes
(`VisibleUser` in `lib/userDisplay.ts:1`), and the hook already shapes `viewer` and `users` in
`useChallengeData.ts`. Two identical interfaces (`User` === `Viewer`) is a tell that the
boundary type is missing, not that two types exist.

**Remedy:** collapse `Viewer` into `User` (or define one `LobbyUser` and reuse it for both
`users[]` and `viewer`). Source the field shape from the hook's exported return type or
`VisibleUser` rather than re-typing it in the component, so the modal can't silently drift from
what `useChallengeData` actually provides.

### 7. The two consumers duplicate the entire lobby-modal render block verbatim

`HomePageClient.tsx:460–496` and `FriendDuelLauncher.tsx:21–46` render the **same**
`ChallengeModal` + `WaitingModal` + `JoiningModal` trio with the **same** ~13-prop threading
and the **same** `key={initialChallengeOpponentId ?? "challenge-modal"}` remount trick. The
remount is the *only* thing that resets `ChallengeModal`'s internal `useState`
(`selectedOpponentId`, `selectedThemeIds`, `selectedDifficulty`, `selectedMode`) — an implicit
contract that both call sites must remember to honor.

**Remedy:** since `useChallengeLobby` already owns all the state, expose a single
`<ChallengeLobbyModals />` component (co-located with the hook) that calls the hook and renders
all three modals, so both consumers drop to one element. (`HomePageClient` is Area-adjacent and
`FriendDuelLauncher` is in `notifications/`, so this is a recommendation that *originates* in
this area — the wrapper belongs next to the hook — but touches files outside scope; flagging,
not mandating an edit here.)

---

## 🟢 Minor / nit-level

- `useChallengeData.ts:10–20`: the `viewer` triple-state ladder (`undefined → undefined`,
  `null → null`, else project four fields) is correct but verbose. A small
  `pickVisibleUser(currentUser)` helper, or simply returning the four fields with the loading
  states handled by the caller, would read better. Low value; leave unless touched.
- `ChallengeModal.tsx:90–91`: the comment "Intentionally unread when isSelfSelected; backend
  forces SELF_DUEL_FORCED_MODE" is good and accurate (the Mode picker is hidden for self-duel
  at line 353). Keep the comment; it documents a real invariant. (Confirms `selectedMode`
  isn't dead — it's used for the non-self path at line 107.)
- `isSelfDuelSelection.ts` (9 LOC) is a legitimately pure, testable, reused helper (imported by
  both the hook and the modal). Correct layer, correct size. No change.
- `ChallengeModal.tsx:97` uses `|| []` for `selectedThemes`; `?? []` is the more precise idiom
  since the left side is an array-or-undefined. Trivial.
- The checkmark `<svg>` (`M16.707 5.293…`) is inlined in 5 files repo-wide
  (`ThemeSelector`, `ChallengeModal`, plus three `goals/` components). A shared `<CheckmarkIcon>`
  would help, but most instances are outside this area — note for a cross-area cleanup, don't
  block here.

---

## Implementation Plan — approved 2026-05-22

**Decision:** #1 A · #2 A · #3 A · #4 A · #5 A · #6 A · #7 A · minors A. All findings accepted
as recommended. This is a refactor/de-duplication pass — **not** a behavior change. The
`ModalState` discriminated-union state machine is preserved exactly as-is (it is the model the
rubric wants). Two items reach outside this area and carry sign-off notes: #5 touches the shared
`ThemeSelector`, and #7 touches `HomePageClient` + `FriendDuelLauncher` (do last).

Before any handoff: run eslint + `npm run typecheck` + `npm run test:run`. Pinned test surface to
keep green / update in the same change: `tests/hooks/useChallengeActions.test.tsx`,
`tests/components/{ChallengeModalMeRow,DuelModePickerSurfaces,WeeklyGoalThemeMarkerSurfaces}.test.tsx`.

Ordered so each step shrinks the blast radius of the next:

### Step 1 — Delete dead surface (#2, #3) — zero-risk, immediate
- **#2** Delete the re-export lines `useChallengeLobby.ts:16–20` (the four sub-hooks +
  `CreateChallengeOptions` + `ModalState`). Keep only the value `import`s the hook body needs
  (lines 9–14). `useChallengeLobby()` is the single public entry point; the four sub-hooks stay
  private implementation details.
- **#3** Delete `pendingCount` from `useChallengeData.ts:32` (its return) and from
  `useChallengeLobby.ts:107` (the re-return). No consumer reads `lobby.pendingCount`.

### Step 2 — Unify `ModeSelectionButton` color system (#4) — small, correctness-adjacent
- Drop the `cssVarColors as colors` module-scope import (`ModeSelectionButton.tsx:6`) and build
  the tone lookup from the live `useAppearanceColors()` inside the component, so every color in
  the button comes from one source. Same defect class blocked in Area 1 (#6).
- Narrow `selectedTone` to the two tones actually passed by `DUEL_MODE_OPTIONS`
  (`primary | secondary`); remove the dead `cta` branch.

### Step 3 — Converge `CompactThemeSelector` onto shared `ThemeSelector` (#5) — biggest LOC delete, feeds Step 4
- Replace the bespoke `CompactThemeSelector` (`ChallengeModal.tsx:522–643`) with the canonical
  `ThemeSelector` rendered controlled (`draftThemeIds` / `onDraftThemeIdsChange`,
  `hideConfirmButton`). If the compact visual is required, add a `variant`/`compact` prop to
  `ThemeSelector` and converge rather than fork. Deletes ~120 LOC + one duplicated checkmark SVG.
- **Cross-area note:** this edits the shared `ThemeSelector.tsx`. Confirm no other consumer
  regresses (it already supports controlled selection — it was built to be embedded).

### Step 4 — Decompose `ChallengeModal.tsx` (#1) — lands the file well under guideline once Step 3 is done
- Extract the remaining surfaces into sibling files: `ChallengeRespondSurface.tsx` and
  `OpponentSelector.tsx` (and optionally `DifficultySelector.tsx`). **There is no
  `CompactThemeSelector.tsx` to extract** — Step 3 already replaced it with the controlled shared
  `ThemeSelector`, which `ChallengeModal` now renders directly. `ChallengeModal.tsx` becomes a thin
  shell (~250 LOC) that composes them.
- While extracting the respond-inbox: it is a second accept/decline UI (notifications already has
  one wired to `notificationId` vs this one's `challengeId`). Keep it as a deliberate convenience
  surface but name the modal honestly; flag the two-entry-points overlap for the Area 11
  cross-check (notifications) — do not unify backend paths here.

### Step 5 — Collapse local types (#6)
- Merge `Viewer` into `User` (they are byte-identical) — define one `LobbyUser` reused for both
  `users[]` and `viewer` — and source the field shape from `useChallengeData`'s exported return
  type or `VisibleUser` (`lib/userDisplay.ts:1`) rather than re-typing it in the component.

### Step 6 — Shared `<ChallengeLobbyModals/>` wrapper (#7) — cross-area, do last, with owner sign-off
- Expose one `<ChallengeLobbyModals />` component co-located with `useChallengeLobby` that calls
  the hook and renders the `ChallengeModal` + `WaitingModal` + `JoiningModal` trio (including the
  `key={…}` remount-reset contract). Both consumers — `HomePageClient.tsx:460–496` and
  `FriendDuelLauncher.tsx:21–46` — collapse to a single element.
- **Cross-area note:** `HomePageClient` is Area 15, `FriendDuelLauncher` is Area 11. The wrapper
  *originates* here (belongs next to the hook) but touches those files; coordinate before editing.

### Minors (fold into the steps that touch each file)
- `?? []` for `selectedThemes` (`ChallengeModal.tsx:97`) and `?? 0` idiom where applicable.
- Optional `pickVisibleUser(currentUser)` helper for the `viewer` ladder
  (`useChallengeData.ts:10–20`) — low value, only if touched.
- Keep the accurate self-duel comment (`ChallengeModal.tsx:90–91`) and `isSelfDuelSelection.ts`
  (correct layer/size) as-is.
- Shared `<CheckmarkIcon>` (inlined in 5 files repo-wide) is **deferred** to a cross-area cleanup
  — do not block or do it here.

## Approval bar

Not blocking on the *state machine* — `ModalState` is a clean discriminated union and is the
model the rubric wants; preserve it. Blocking-to-medium issues that must be addressed before
this clears:

- `ChallengeModal.tsx` at the 707-LOC guideline with a clear three-surface decomposition (#1),
- dead barrel re-exports implying an unused sub-hook API (#2),
- a fabricated unused public field `pendingCount` (#3),
- a dual-color-system component (#4) and a ~120-LOC duplicate of the canonical `ThemeSelector`
  (#5).

Once the dead indirection is deleted, the modal is decomposed onto the shared theme selector,
and the color system is unified, this area is in good shape — the underlying orchestration is
sound.
