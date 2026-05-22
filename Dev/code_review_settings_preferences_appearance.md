# Code Review — Area 14: Settings, preferences & appearance

**Date:** 2026-05-22
**Scope:** `app/settings/` (recursive) + the three preference providers, `usePersistedPreference`,
`themeCssVars`, color/display libs, and the preferences/credits server modules. ~2.18k LOC.
**Verdict:** 🟡 **APPROVE WITH CHANGES**

## Scope reviewed

- **Providers / persistence:** `app/components/AppearanceProvider.tsx` (117),
  `app/components/BackgroundProvider.tsx` (61), `app/components/UserPreferencesProvider.tsx` (55),
  `app/components/usePersistedPreference.ts` (78), `app/components/themeCssVars.ts` (57)
- **Settings page + components:** `app/settings/page.tsx` (153), `app/settings/constants.ts` (6),
  `components/ProfileCard.tsx` (56), `components/CreditsPanel.tsx` (91),
  `components/NicknameEditor.tsx` (127), `components/ColorSetSelector.tsx` (94),
  `components/BackgroundSelector.tsx` (116), `components/TTSProviderSelector.tsx` (92)
- **Settings hooks:** `hooks/useNicknameUpdate.ts` (69), `hooks/useTTSProvider.ts` (46)
- **Notifications subtree:** `notifications/page.tsx` (149), `components/CategoryToggle.tsx` (59),
  `components/NotificationToggle.tsx` (52), `components/ReminderOffsetInput.tsx` (79),
  `hooks/useNotificationSettings.ts` (51)
- **Lib:** `lib/colorUtils.ts` (282), `lib/userDisplay.ts` (58), `lib/displayFormat.ts` (33),
  `lib/credits/constants.ts` (11), `lib/preferences/backgrounds.ts` (9)
- **Convex:** `convex/userPreferences.ts` (90), `convex/credits.ts` (90)

No file is over the 700 LOC guideline; the largest is `lib/colorUtils.ts` at 282 LOC. The structural
problems here are not size — they are **fallback/test-escape-hatch branches in production hook code**,
a **persistence-hook param that does nothing**, and **silent defaults that contradict an already-strict
server contract**. There is real "code judo" available: the special-focus question about a
"context-provider explosion" is largely a *false alarm* (the three providers are correctly factored),
but `usePersistedPreference` itself can shed a parameter and `themeCssVars.ts` is a hand-maintained
mirror that should be derived.

Cross-area note: `lib/theme.ts` (the only consumer of `colorUtils.ts`'s `derive*` functions and the
home of `getThemeColors` / `applyThemeCssVariables`) is **Area 1**, so it is out of scope here, but
several findings below land on the *boundary* between `colorUtils.ts`/`themeCssVars.ts` and that file.

---

## 🔴 Blockers

### 1. `AppearanceProvider` bakes a test-only "fallback" branch into production hook code (`AppearanceProvider.tsx:32-34, 95-103, 105-117`)

This is a direct AGENTS.md "No fallback code" violation, and the name says so out loud:

```ts
declare global {
  var __LANGUAGE_DUEL_ALLOW_THEME_TEST_FALLBACK__: boolean | undefined;
}
// ...
export function useAppearanceColors() {
  const context = useContext(ColorSetContext);
  if (!context) {
    if (globalThis.__LANGUAGE_DUEL_ALLOW_THEME_TEST_FALLBACK__) {
      return cssVarColors;          // silent default that hides "no provider"
    }
    throw new Error("useAppearanceColors must be used within AppearanceProvider");
  }
  return context.colors;
}
```

The only writers of this global are `tests/setup.ts:13` (sets it `true`) and one assertion in
`tests/components/AppearanceProvider.test.tsx:21-22` (flips it `false` to prove the throw still
works). So production ships a `var` global + two branches whose sole purpose is to let
**unwrapped test renders** silently receive `cssVarColors` instead of throwing. This is exactly the
"silent default that hides a broken contract / test-only branch in a production path" the rule names.

**Remedy:** delete the global declaration and both `if (globalThis.__…__)` branches. The hooks then
do the clean thing: throw when used outside the provider, always. In tests, wrap the component under
test in `<AppearanceProvider>` (the file's own second test already does exactly this at lines 33-36),
or provide a tiny test-only `ColorSetContext.Provider` wrapper in test utilities — the escape hatch
does not belong in the shipped hook. This also removes one of the two reasons `themeCssVars.ts` is
imported into the provider.

### 2. `CreditsPanel` defaults credit counts that the server contract guarantees are always present (`CreditsPanel.tsx:11-22`, `ProfileCard.tsx:50-53`)

`CreditsPanel` declares both props optional and papers over absence:

```ts
type CreditsPanelProps = {
  llmCreditsRemaining?: number;
  ttsGenerationsRemaining?: number;
};
const llmRemaining = llmCreditsRemaining ?? LLM_MONTHLY_CREDITS;
const ttsRemaining = ttsGenerationsRemaining ?? TTS_MONTHLY_GENERATIONS;
```

But the only caller is `ProfileCard`, which passes `user.llmCreditsRemaining` /
`user.ttsGenerationsRemaining` from `CurrentUser`, and that type declares both as **non-optional
`number`** (`convex/users.ts:43-44`), populated unconditionally by `normalizeCreditState` in
`getCurrentUser` (`convex/users.ts:58, 68-69`). So the values are *never* `undefined`, the `?` and the
`??` are dead, and worse: if a real bug ever zeroed the server value, this panel would silently show a
**full 500/500** instead of the truth. That is precisely the "silent default that hides a broken
contract" pattern AGENTS.md forbids — and it duplicates the `LLM_MONTHLY_CREDITS` /
`TTS_MONTHLY_GENERATIONS` reset constants into the *view* layer, where they have no business living.

**Remedy:** make the props required `number`, drop both `?? …` fallbacks, and remove the
`LLM_MONTHLY_CREDITS` / `TTS_MONTHLY_GENERATIONS` imports from `CreditsPanel`. The component then
renders exactly what the server computed.

### 3. `usePersistedPreference`'s `applyValue` parameter is inert and `AppearanceProvider` feeds it a no-op (`usePersistedPreference.ts:11, 30-37`; `AppearanceProvider.tsx:36-38, 49`)

`applyAndStore` calls `applyValue?.(nextValue)` and **discards the return value**
(`usePersistedPreference.ts:32`). `applyValue` is only ever invoked with values that already passed
`isValid` (lines 43, 52, 67 all gate on `isValid` first). So:

- `BackgroundProvider` passes no `applyValue` at all — fine, because nothing is needed.
- `AppearanceProvider` passes `applyValue: normalizeThemeName`, where
  `normalizeThemeName = (n) => isThemeName(n) ? n : DEFAULT_THEME_NAME` (`AppearanceProvider.tsx:36-38`).
  Since the input is *already* a valid theme name, the ternary's false branch is unreachable, the
  function returns the input unchanged, and that return is **thrown away** by `applyAndStore`.

So `applyValue` is a hook parameter with **zero meaningful callers** and `normalizeThemeName` is
entirely vestigial. This is the "thin abstraction / pass-through that adds indirection without buying
clarity" the rubric calls out.

**Remedy:** delete the `applyValue` option from `PersistedPreferenceOptions`, delete the
`applyValue?.(nextValue)` line, and delete `normalizeThemeName` from `AppearanceProvider`. Net: one
fewer hook param, one fewer dead helper, and `AppearanceProvider`'s `usePersistedPreference` call drops
a line. (CSS variables are already applied by the dedicated `useEffect` at lines 59-61 — `applyValue`
was never doing that job anyway.)

---

## 🟡 Medium

### 4. `themeCssVars.ts` is a hand-maintained mirror of `applyThemeCssVariables` and must be kept in lockstep by eye (`themeCssVars.ts:3-55`)

`cssVarColors` is a 50-line literal that re-types the *entire* `ThemeColors` shape as
`var(--color-…)` strings. Every key here must exactly match the CSS custom properties that
`applyThemeCssVariables` writes in `lib/theme.ts:323-353`. There is no shared key list, so adding a
new color shade means editing **two** files in two layers and hoping they agree; drift produces a
silent `var(--color-…)` that resolves to nothing. Two tells that this is already fragile:
`primary.darkest` maps to `var(--color-primary-dark)` (no `--color-primary-darkest` var exists) and
`text.inverse` maps to `var(--color-background)` — i.e. the mirror is *already* approximating because
not every derived shade is emitted as a CSS var.

**Remedy:** derive the var-name from the color path with one helper, or generate `cssVarColors` from
the same key manifest that drives `applyThemeCssVariables`, so the two cannot diverge. At minimum,
co-locate the canonical list of emitted CSS-var names and build both the writer and this reader from
it. (`lib/theme.ts` is Area 1; flag for coordinated change.)

### 5. `BackgroundSelector` re-declares the background catalog the canonical module already owns (`BackgroundSelector.tsx:7-13` vs `lib/preferences/backgrounds.ts:1-5`)

`lib/preferences/backgrounds.ts` is the source of truth (`VALID_BACKGROUNDS`, `DEFAULT_BACKGROUND`,
`isValidBackground`, `BackgroundFilename`). `BackgroundSelector` ignores it and hardcodes a parallel
`BACKGROUND_OPTIONS` array with the *same* filenames plus labels — so the set of valid backgrounds now
lives in two places, and adding a third background means editing both (and remembering that the
validator/`DEFAULT_BACKGROUND` won't include it otherwise). The display labels ("Castle Lights",
"Mystic Forest") are the only new information.

**Remedy:** move the `{ filename, label }` catalog into `lib/preferences/backgrounds.ts` (e.g.
`BACKGROUND_OPTIONS` next to `VALID_BACKGROUNDS`, with `VALID_BACKGROUNDS`/`DEFAULT_BACKGROUND` derived
from it), and import it in the selector. One source of truth; the component keeps only rendering.

### 6. `BackgroundSelector`'s `selectedBackground: string | null` + inline default re-implements what the provider already guarantees (`BackgroundSelector.tsx:15-28`, `page.tsx:114-118`)

The prop is typed `string | null` and the component re-derives
`const activeBackground = selectedBackground || BACKGROUND_OPTIONS[0].filename`. But its only caller
passes `background` from `useBackground()`, which is a non-null `BackgroundFilename` that already
defaults to `DEFAULT_BACKGROUND` inside `usePersistedPreference`. So the `| null` and the `||`-default
are dead, and they widen the type away from the precise `BackgroundFilename` the rest of the chain
uses. Contrast `ColorSetSelector`, which correctly consumes the typed value straight from
`useColorSet()` with no defaulting.

**Remedy:** type the prop `selectedBackground: BackgroundFilename`, delete the `|| BACKGROUND_OPTIONS[0]`
default, and use it directly. (Pairs naturally with #5.)

### 7. The three `userPreferences` mutations are the same 4-step shape copy-pasted (`convex/userPreferences.ts:31-90`)

`updateColorSet`, `updateBackground`, `updateTtsProvider` each do: `getAuthenticatedUser` →
optionally validate-or-`ConvexError` → `ctx.db.patch(user._id, { <field>: value })` →
`return { <field>: value }`. The validation lives *inside* each handler even though `colorSet`/
`background` are `v.string()` precisely so the handler can re-check with `isThemeName`/
`isValidBackground` (whereas `ttsProvider` validates at the arg layer via `ttsProviderValidator` and
has no handler check). The result is three near-identical bodies with one structural inconsistency
(where validation happens).

**Remedy (light touch):** make this uniform rather than abstracted-away. Prefer pushing the
value-validation to the **arg validator** for all three so the handlers collapse to
`patch + return` — i.e. give color-set and background the same treatment `ttsProvider` already gets
(a Convex validator that only accepts valid values), removing the in-handler `isThemeName`/
`isValidBackground` `ConvexError` blocks. That deletes two `ConvexError` branches and makes all three
handlers identical and trivial. Do **not** introduce a generic `updatePreferenceField` wrapper — that
would be a thin indirection over `ctx.db.patch` and obscure the per-field contract.

> **Special-focus answers (non-findings, recorded deliberately):**
> - **"Provider explosion / unify the three providers?"** No. `UserPreferencesProvider` owns the
>   server round-trip (one query + three mutations), and `AppearanceProvider` / `BackgroundProvider`
>   are thin feature contexts that *consume* it through the shared `usePersistedPreference`. There is
>   **no duplicated persistence logic** — both delegate to the same hook. Merging them would couple
>   color-set and background state for no benefit. Leave as three.
> - **"Shared user-doc-patch pattern across `userPreferences.ts` vs `credits.ts`?"** The
>   `getAuthenticatedUser → ctx.db.patch(user._id, …)` shape is the idiomatic Convex pattern and
>   appears identically at 8 sites repo-wide (`users.ts`, `credits.ts`, `themes/mutations.ts`,
>   `weeklyGoals/mutations.ts`). A `patchUser` helper would be an identity wrapper over `ctx.db.patch`.
>   Do **not** abstract it. (`credits.ts`'s body is genuinely different logic — credit math + reset —
>   and shares nothing with preferences beyond the patch call.)

---

## 🟢 Minor / nit-level

- **`lib/colorUtils.ts` magic numbers are unnamed but acceptable.** The HSL nudges
  (`l + 10`, `l - 15`, `s + 5`, `s * 0.5`, hue `+ 180`, `darkest l - 25`, the `rgba(…, 0.4)` /
  `0.5` glow alphas, the dark/light text hexes `#F4F3F0`/`#A09C8E`/`#1A1A1A`/`#666666`, the
  `l < 50` dark threshold) are each used once, inside a clearly-named `derive*` function, to tune a
  visual feel — this is the "trivial UI/derivation math may stay inline" carve-out. Worth a single
  one-line comment block documenting that these are tuned offsets (the `// Shift hue by ~60 degrees`
  comment at line 230 is in fact *wrong* — the code does `+ 180`, a complement, not 60°). Fix that
  comment.
- **`useTTSProvider` exports an unused `isLoading` (`useTTSProvider.ts:20, 43`).** No consumer reads
  it (the selector destructures only `provider`/`setProvider`/`isUpdating`). Delete `isLoading` and
  its computation. (`BackgroundProvider` likewise still surfaces `isLoading`, but `page.tsx:24`
  *does* consume it as `isBackgroundLoading` → keep that one.)
- **`useNicknameUpdate` exports `validateNickname` with no external caller (`useNicknameUpdate.ts:21, 67`).**
  Used only internally by `updateNickname`. Drop it from the return object unless a caller is planned.
- **`usePersistedPreference` returns `hasHydrated` (line 77) that no caller reads.** Drop it from the
  returned object (keep the internal state).
- **`NicknameEditor` discriminator guard is defensive against an impossible value
  (`NicknameEditor.tsx:95`).** `currentDiscriminator && nickname.trim()` treats `0` as falsy, but
  discriminators are generated in `[DISCRIMINATOR_MIN=1000, DISCRIMINATOR_MAX=9999]`
  (`convex/constants.ts:96-99`), so `0` cannot occur. Harmless; a stricter
  `typeof currentDiscriminator === "number"` check would read as intentional. Same observation applies
  to `formatPaddedHandle`'s `padStart(4, "0")` in `lib/userDisplay.ts:20`, which can never actually pad
  given the 4-digit range — fine to leave as future-proofing, but it's dead today.
- **`useNotificationSettings` exports `error` + `clearError` (lines 48-49) that the page never reads.**
  The page surfaces failures via the hook's own `toast.error`. The `error` state and `clearError` are
  dead public surface — trim, or wire them in. Also `clearError: () => setError(null)` is rebuilt every
  render (not `useCallback`'d like the others) — inconsistent; either memoize or delete.
- **`CreditsPanel` repeats the same 4-line inline font style object twice (lines 50-54, 75-79):**
  `{ fontFamily: "Outfit, system-ui, sans-serif", fontWeight: 500, fontStyle: "normal" }`. Hoist to a
  module-level `const` once.
- **`TTSProviderSelector.tsx` is indented with a different width than the rest of the file/codebase**
  (8-space JSX block starting line 19). Cosmetic, but it stands out against `ColorSetSelector`'s
  near-identical structure. Reformat to match.
- **`ColorSetSelector` and `TTSProviderSelector` are the same "section header + active-highlighted
  option list" shell** (compare `ColorSetSelector.tsx:14-91` with `TTSProviderSelector.tsx:20-90`:
  identical section/border/`{primary}26` active-bg/`primary.dark` idle-border/"Active" badge). Not
  worth a forced abstraction today, but if a third selector of this shape appears, extract a
  `<PreferenceOptionList>` shell. Note for later, don't act now.

---

## Recommended ordering

1. Delete the test-fallback global + branches (#1) — clearest AGENTS.md violation, removes prod/test
   coupling.
2. Make credit props required and drop the view-layer constants (#2).
3. Drop the inert `applyValue` param + `normalizeThemeName` (#3) — pure deletion, no behavior change.
4. Consolidate the background catalog and tighten the selector's types (#5, #6) together.
5. Uniform preference-mutation validation via arg validators (#7).
6. `themeCssVars` lockstep fix (#4) — coordinate with Area 1.
7. Minor dead-export / cosmetic cleanups in any order; fix the wrong `~60 degrees` comment.

## Approval bar

Approvable **with changes**, not as-is. Nothing here is a size/decomposition failure, and the
provider layering is sound (the "provider explosion" concern is explicitly *not* a finding). What
blocks a clean approve:

- a **test-only fallback escape hatch shipped in production hook code** (#1), which the AGENTS.md
  "No fallback code" rule names directly;
- **silent defaults that contradict an enforced server contract** and leak reset constants into the
  view layer (#2);
- a **persistence-hook parameter that does nothing**, fed an inert no-op helper (#3).

These three are concrete, low-risk deletions. The medium items (mirror drift in `themeCssVars`,
duplicated background catalog, copy-pasted mutation bodies) are real maintainability debt but
localized. Clear #1–#3, fold in #5–#7, and this area is in good shape.
