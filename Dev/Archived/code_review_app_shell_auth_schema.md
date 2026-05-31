# Code Review — Area 15: App shell, auth, user sync & schema

**Date:** 2026-05-22
**Scope:** Top-level `app/` shell, shared shell components, shared modal infra, user/presence
hooks, user/auth Convex modules, `convex/schema.ts`, and shared `lib/` primitives. ~3.0k LOC.
**Verdict:** 🟡 **APPROVE WITH CHANGES**

## Scope reviewed

- **App shell:** `app/HomePageClient.tsx` (499), `app/layout.tsx` (100), `app/page.tsx` (10)
- **Shell components:** `app/components/Avatar.tsx` (77), `MenuButton.tsx` (89),
  `BackButton.tsx` (64), `ThemedPage.tsx` (70), `FormError.tsx` (37), `auth.tsx` (251),
  `convex-provider.tsx` (15), `icons.tsx` (65)
- **Modal infra:** `app/components/modals/ModalShell.tsx` (107), `modalButtonStyles.ts` (42),
  `types.ts` (7)
- **Hooks:** `hooks/useSyncUser.ts` (86), `hooks/usePresence.ts` (59)
- **Convex:** `convex/users.ts` (308), `helpers/auth.ts` (179), `helpers/users.ts` (31),
  `helpers/userSummary.ts` (17), `helpers/permissions.ts` (62)
- **Schema:** `convex/schema.ts` (567)
- **Lib primitives:** `lib/types.ts` (39), `constants.ts` (17), `errors.ts` (11),
  `backendErrorCodes.ts` (62), `stringUtils.ts` (54), `timeUtils.ts` (242), `prng.ts` (77),
  `difficultyUtils.ts` (148), `cleanupExpiry.ts` (38), `cleanupRetention.ts` (43),
  `typeGuards.ts` (3)

**Excluded** (per scope): `AppearanceProvider` / `BackgroundProvider` / `UserPreferencesProvider`
(Area 14); the prototype components/modals (`MemoryGame`, `*Beta`, `ChallengeModal`,
`SoloPracticeModal`, etc.) and the Mock Features / Online Mock menu branches in
`HomePageClient.tsx` (mock wiring — noted as excluded, not deeply flagged); feature Convex
modules (other areas).

No file in this area exceeds the ~700 LOC guideline. `schema.ts` (567) and `auth.tsx` (251)
are the largest; both are flagged below for structural reasons rather than raw size.

---

## 🔴 Blockers

None. There is no file-size explosion and no spaghetti-growth severe enough to block. The items
below are real maintainability problems but each is contained.

---

## 🟡 Medium

### 1. `Avatar.tsx` — the `borderColor` default is a dead, wrong-source fallback (lines 7, 25–27)

```ts
import { cssVarColors as colors } from "@/app/components/themeCssVars";
...
borderColor = colors.neutral.DEFAULT,   // module-level static palette
}: AvatarProps) {
  const colors = useAppearanceColors();  // shadows the import for the rest of the body
```

The default-parameter expression `colors.neutral.DEFAULT` binds to the **module import**
(`cssVarColors`, the static `playful-duo` palette), because the inner `const colors` only exists
after the parameter list. So the default border is hard-wired to one theme and ignores the user's
selected appearance, while every other color in the component (`primary.dark`, `neutral.DEFAULT`
for text) correctly comes from `useAppearanceColors()`. No caller passes `borderColor`
(verified: `FriendFilterModal` and `ProfileCard` are the only consumers, neither sets it), so the
border is *always* the static value. This is exactly the AGENTS "silent default that hides a
broken contract" smell, plus a shadowed-import readability trap.

**Remedy:** drop the `cssVarColors` import entirely; make the prop `borderColor?: string` with no
default, and inside the body do `const effectiveBorder = borderColor ?? colors.neutral.DEFAULT`
using the hook's `colors`. Removes the only use of `themeCssVars` in this file and makes the
border theme-aware.

### 2. Shell buttons hand-roll the gradient/border style that `getButtonStyles` already owns (`MenuButton.tsx` 21–70, `BackButton.tsx` 17–57, `modalButtonStyles.ts`)

There are now **three** independent encodings of "primary gradient button with top/bottom/side
borders + glow":

- `MenuButton` builds eight `var(--color-…)` strings by hand and re-implements hover via
  `onMouseEnter`/`onMouseLeave` inline-style mutation.
- `BackButton` inlines a near-identical static `style` object (different border widths only).
- `modalButtonStyles.getCtaActionStyle` does the same thing *correctly* by calling the canonical
  `getButtonStyles(colors)` from `lib/theme.ts`.

`lib/theme.ts` already exposes `getButtonStyles` returning `{ primary, cta }` with
`gradient/gradientHover/border/glow` — the single source of truth. `MenuButton` and `BackButton`
bypass it and re-derive the same data from CSS vars, so a future palette change to
`getButtonStyles` silently won't reach them, and the JS hover handlers in `MenuButton` duplicate
what a CSS `:hover`/the existing `gradientHover` slot already model.

**Remedy:** route `MenuButton` and `BackButton` through `getButtonStyles(colors)` (the modal
helper is the template), and replace `MenuButton`'s `onMouseEnter/Leave` style mutation with a
CSS hover (the `group` wrapper is already present). Collapses three style encodings to one and
deletes ~15 lines of imperative hover code. This is the highest-value consolidation in the area.

### 3. `HomePageClient.tsx` mixes four concerns and repeats the nav chrome six times

The component is 499 LOC carrying: (a) ~10 inline `*Icon` SVG components (lines 29–111), (b) the
solo deep-link parser + effect (164–205), (c) the auth-flash guard (146–162), and (d) the home
menu + every prototype screen. Critically, the `LeftNavButtons`/`AuthButtons` header block is
copy-pasted verbatim into **six** `if (screen === …) return` branches (lines 221–303) plus the
main return — identical `absolute top-3 left-2 …` / `right-2 …` wrappers each time.

Most of the prototype branches are mock wiring (excluded from deep review), but the *duplication
of the shell header* is structural and affects the real home screen too.

**Remedy (in priority order):**
- Extract a single `<HomeChrome flash={…}>` (or wrap `ThemedPage` so it renders the nav corners)
  and use it in every branch. Removes ~50 lines of copy-paste and the risk of the corners drifting
  apart per screen.
- Move the ~10 inline `*Icon` SVGs to a co-located `homeMenuIcons.tsx` (or fold the shared ones
  into `app/components/icons.tsx`). These are presentation constants, not page logic; they account
  for ~80 of the 499 lines.
- The solo deep-link parsing (164–205) is pure URL→state logic and belongs in a small
  `useSoloDeepLink(searchParams)` hook so the page wires rather than parses. Note the cast on line
  182 (`as Id<"themes">[]`) is then localized.

These three extractions take the real (non-mock) surface of the file well under 250 LOC without
touching prototype behavior.

### 4. `schema.ts` — `difficultyLevelValidator` and `duelDifficultyPresetValidator` are byte-identical and named two ways (lines 47–51, 87–91)

Both are `v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"))`. One is used for a
question's realized `difficulty` (line 119), the other for a duel's chosen `duelDifficultyPreset`
(lines 199, 305, 345). The *concepts* differ slightly, but the *values are the same enum* and
`lib/difficultyUtils.ts` already exports a single `DuelDifficultyPreset = "easy"|"medium"|"hard"`
type plus `lib/types.ts` exports `DifficultyLevel = "easy"|"medium"|"hard"`. So the same three
strings are now modeled by **two validators in schema + two TS aliases in lib**. This is the
naming-consistency-across-the-stack rule firing: one concept, four names.

**Remedy:** keep one validator (e.g. `difficultyLevelValidator`) and have
`duelDifficultyPreset` reference it, or at minimum derive both from one
`const DIFFICULTY_LEVELS = ["easy","medium","hard"] as const`. Likewise collapse
`DifficultyLevel`/`DuelDifficultyPreset` in lib to a single exported type. If "preset" and
"realized difficulty" must stay distinct names for readability, make `duelDifficultyPresetValidator
= difficultyLevelValidator` (an alias) so they cannot drift.

### 5. `schema.ts` — `challenges` and `duels` duplicate a six-field "session source" block (lines 296–316, 321–378)

Both tables independently declare the same cluster: `sourceType`, `weeklyGoalId`, `bossType`,
`spacedRepetitionStep`, `duelDifficultyPreset`, `duelMode` (and `themeIds`). `soloPracticeSessions`
(383–400) repeats most of it again with a *different* `sourceType` union
(`soloPracticeSourceTypeValidator` adds `weekly_goal`, drops `normal`). This is the inline-object
analogue of copy-pasted code: a change to how a "session origin" is described must be made in three
table definitions and kept in sync by hand.

**Remedy:** extract a shared `sessionSourceFields` spread (a plain object of validators) and spread
it into `challenges`, `duels`, and `soloPracticeSessions`, parameterizing only the `sourceType`
union that genuinely differs. Convex supports spreading validator objects into `defineTable`. This
documents "these three tables share an origin model" in one place and removes the silent-drift risk.

### 6. `users.ts` `searchUsers` — bare `20` result cap and a redundant two-stage limit (lines 185, 203)

`ctx.db.query("users").take(MAX_USERS_QUERY)` (=100) is followed by `.slice(0, 20)` after
filtering. The `20` is an unnamed magic number governing search-result size (AGENTS: name
non-obvious repeated numbers). More importantly the flow is "take 100 → filter → keep 20", which
means a user whose match is the 101st row is invisible and the cap interacts with the filter in a
non-obvious way.

**Remedy:** add `MAX_USER_SEARCH_RESULTS = 20` to `convex/constants.ts` and use it for the slice.
(The take-then-filter pattern is acceptable for a prefix search of this scale; only the unnamed
constant is in scope to fix.)

### 7. `modals/types.ts` — `ModalTheme.words: unknown[]` is a typed-as-untyped field used only for `.length` (lines 1–7)

Every consumer (`ChallengeModal:610`, `SoloPracticeModal:195`, `ThemeSelector:121`) reads only
`theme.words.length`. Modeling the field as `unknown[]` to mean "I only care how many" is the
loose-shape smell the rubric calls out: the type lies about what's there and blocks any future
field access without a cast.

**Remedy:** either type it honestly as `words: WordEntry[]` (the canonical type already imported
across the theme code) since callers pass real theme docs, or — if these modals truly only need a
count — replace the field with `wordCount: number` and have the providers compute it. The second is
the cleaner contract: it states the actual dependency and lets the modals stop carrying word
payloads they never read.

### 8. `auth.tsx` (251 LOC) — three near-identical nav-button blocks + duplicated prefetch effects

`LeftNavButtons`, `RightNavButtons`, and `AuthButtons` each repeat the `if (!isSignedIn) return null`
guard, a `useEffect` that calls `router.prefetch(...)` on sign-in, and the same
`<div className="relative"><button className="nav-icon-btn …" …><Icon/></button></div>` shape (one
per nav target). The notification-bell badge (112–125) and the goals/repetition/settings buttons
are structurally one repeated unit.

**Remedy:** extract a small `<NavIconButton icon onClick title testId badge?>` and render the four
targets as data. Consolidate the three `router.prefetch` effects into one (or hoist the route list);
`HomePageClient` *also* prefetches `/themes /goals /settings` (lines 138–143) while `auth.tsx`
prefetches `/goals /repetition` and `/settings` — overlapping, scattered prefetch logic that should
live in one place. Drops the file well under 150 LOC and removes the per-button boilerplate.

---

## 🟢 Minor / nit-level

- `lib/stringUtils.ts` — `normalizeAccents` (36–38) is a pure pass-through to
  `normalizeForComparison` (no options). Every caller in `app/game/levels/*` then chains a
  *redundant* `.toLowerCase()` even though `normalizeForComparison` already lowercases. Consider
  deleting `normalizeAccents` and calling `normalizeForComparison` directly, and drop the dead
  `.toLowerCase()` chains. Behavior-neutral; leave if churn isn't worth it, but it's a genuine
  identity wrapper.
- `lib/types.ts` — `Id`/`WordEntry` are a hand-rolled mirror of the Convex generated `Id`/`Doc`
  types, used widely across `lib/` to keep pure logic free of `convex/_generated` imports. That's a
  defensible layer boundary, but the `Id` brand here (`__tableName`) is structurally distinct from
  the generated brand, so values can't flow between them without help. Worth a one-line comment
  documenting *why* this parallel definition exists, to prevent a future reader "fixing" it.
- `lib/errors.ts` `getErrorMessage` and `lib/backendErrorCodes.ts` `readBackendErrorCode` both
  walk `error.data` defensively but independently (one for `.message`, one for `.code`).
  `getErrorMessage` doesn't reuse `isRecord` from `typeGuards`. Minor: have `getErrorMessage` use
  `isRecord` so the two share the same record-narrowing convention.
- `schema.ts` `notifications` declares five indexes (484–488) with heavily overlapping prefixes
  (`by_type_status`, `by_type`, `by_type_only`, `by_type_status_createdAt`). Worth confirming each
  has a live query; redundant indexes are write-amplification debt. (Query usage is out of this
  area's scope to fully trace — flagging for the notifications-area owner.)
- `ModalShell` uses `z-[70]` while the hand-rolled feature modals reviewed in Area 1 use `z-50`.
  Once those adopt `ModalShell` (Area 1 blocker #5) this resolves; noting the inconsistency so the
  layering value is centralized rather than copied.
- `usePresence.ts` module-level `mountedPresenceOwners` counter (line 9) is a dev-only guard; fine,
  but it's process-global mutable state in a hook module. Acceptable given the single-owner
  contract is enforced by `SignedInPresenceOwner`.

---

## Implementation Plan — approved 2026-05-23

**Decision:** #1 A · #2 A · #3 A · #4 A · #5 A · #6 A · #7 A · #8 A · minors A.
All accepted. Documentation only — implementation not yet authorized.

**Step 1 — Avatar border bug (#1).** Smallest; fixes a real silent-default contract break.
- Drop the `cssVarColors` import from `Avatar.tsx`; make `borderColor?: string` with no default;
  inside the body use `const effectiveBorder = borderColor ?? colors.neutral.DEFAULT` from
  `useAppearanceColors()`. Border becomes theme-aware; removes the shadowed-import trap.

**Step 2 — button-style consolidation (#2).** Highest payoff, low risk.
- Route `MenuButton` (`:21-70`) and `BackButton` (`:17-57`) through `getButtonStyles(colors)` from
  `lib/theme.ts` (the modal helper `getCtaActionStyle` is the template). Replace `MenuButton`'s
  `onMouseEnter/Leave` style mutation with CSS hover (the `group` wrapper already exists). Collapses
  three style encodings to one.

**Step 3 — schema dedup (#4, #5).** Foundation cleanups; do before more tables copy the patterns.
- Keep one difficulty validator; make `duelDifficultyPresetValidator = difficultyLevelValidator`
  (alias) or derive both from `const DIFFICULTY_LEVELS = [...] as const` (`schema.ts:47-51, 87-91`).
  Collapse `DifficultyLevel`/`DuelDifficultyPreset` in lib to one exported type.
- Extract a shared `sessionSourceFields` validator-object spread into `challenges`, `duels`,
  `soloPracticeSessions` (`schema.ts:296-316, 321-378, 383-400`), parameterizing only the differing
  `sourceType` union.

**Step 4 — shell decomposition (#3, #8).** Related; share the `NavIconButton`/chrome work.
- Extract `<HomeChrome flash={…}>` (or have `ThemedPage` render the nav corners) and use it in every
  `HomePageClient` branch; move the ~10 inline `*Icon` SVGs to a co-located `homeMenuIcons.tsx` (or
  fold shared ones into `app/components/icons.tsx`); pull the solo deep-link parser into
  `useSoloDeepLink(searchParams)` (localizes the `as Id<"themes">[]` cast). Real surface drops
  under 250 LOC without touching prototype branches.
- Extract `<NavIconButton icon onClick title testId badge?>` in `auth.tsx`; render the four nav
  targets as data; consolidate the three `router.prefetch` effects (and the overlapping prefetch in
  `HomePageClient:138-143`) into one place. File drops well under 150 LOC.

**Step 5 — contract tightenings (#6, #7).**
- Add `MAX_USER_SEARCH_RESULTS = 20` to `convex/constants.ts`; use it for the `searchUsers` slice
  (`users.ts:185, 203`). Keep the take-then-filter pattern.
- Replace `ModalTheme.words: unknown[]` (`modals/types.ts:1-7`) with `wordCount: number`; have the
  providers compute the count; update the three consumers (`ChallengeModal:610`,
  `SoloPracticeModal:195`, `ThemeSelector:121`) to read `wordCount`.

**Step 6 — minors (as convenient).**
- Delete `normalizeAccents` identity wrapper, call `normalizeForComparison` directly, drop the dead
  `.toLowerCase()` chains in `app/game/levels/*`.
- Add the one-line "why this parallel `Id`/`WordEntry` exists" comment in `lib/types.ts`.
- Have `getErrorMessage` reuse `isRecord` from `typeGuards`.
- Confirm each of the five `notifications` indexes (`schema.ts:484-488`) has a live query
  (coordinate with the notifications-area owner; delete any with no consumer).
- `ModalShell` `z-[70]` vs feature-modal `z-50` resolves once Area 1 blocker #5 lands — noted only.

**Gate at implementation time (docs-only now, so not run yet):** eslint + `npm run typecheck` +
`npm run test:run`.

## Approval bar

Approvable with the above changes. There is **no blocker**: no file over the project guideline, no
spaghetti explosion, no hacky/magical abstraction in the strict sense. What keeps it from a clean
APPROVE is a cluster of consolidations the rubric weights heavily:

- a canonical helper (`getButtonStyles`) bypassed by two of three button implementations (#2),
- duplicated schema models — identical-but-twice-named difficulty validators (#4) and a copy-pasted
  session-source field block across three tables (#5),
- a silent wrong-source default in `Avatar` (#1),
- loose/untyped contracts (`ModalTheme.words: unknown[]` #7) and scattered shell duplication (#3,
  #8).

None individually risks correctness, but together they're exactly the "arranged-but-not-simplified,
duplicate-instead-of-extracted" debt this audit exists to catch. Address #1, #2, #4, #5 at minimum
before sign-off.
