# Code Review — Area 13: TTS pipeline

**Date:** 2026-05-22
**Scope:** TTS provider adapters + live TTS API route + theme TTS generation pipeline +
generation locking + playback hooks. ~1.2k LOC.
**Verdict:** 🟡 **APPROVE WITH CHANGES**

## Scope reviewed

- **`lib/tts/`:** `providerAdapters.ts` (307 LOC), `providers.ts` (33 LOC)
- **`lib/themes/tts.ts`** (111 LOC)
- **`app/api/tts/`:** `route.ts` (34 LOC), `ttsService.ts` (110 LOC)
- **`convex/ttsGenerationLocks.ts`** (63 LOC)
- **`convex/themes/generateThemeTtsAction.ts`** (207 LOC), **`convex/themes/ttsPipeline.ts`** (125 LOC)
- **`convex/helpers/themeTtsStorage.ts`** (120 LOC)
- **Hooks:** `app/game/hooks/useTTS.ts` (162 LOC), `app/themes/hooks/useThemeTtsController.ts`
  (91 LOC), `app/duel/[duelId]/hooks/useDuelAudio.ts` (17 LOC)

Cross-file boundaries traced (read but owned by other areas): `convex/themes.ts`
(API surface), `convex/themes/mutations.ts` `handleApplyGeneratedThemeTts`,
`convex/themes/cleanupHelpers.ts`, `tests/lib/themesTts.test.ts`,
`app/settings/hooks/useTTSProvider.ts`.

No file exceeds the 700 LOC guideline. The largest, `providerAdapters.ts` (307), is justified
by two genuinely different provider protocols; size is not the issue here. The issues are
**duplicated apply-logic across the lib/convex boundary**, a **test-only generic abstraction**,
and **layering/wrapper smells in the playback hooks**.

---

## 🔴 Blockers

### 1. `applyGeneratedTtsToWords` (`lib/themes/tts.ts:75-107`) is a dead, test-only fork of production logic

The canonical apply-the-generated-IDs algorithm runs in **two places that have diverged**:

- `lib/themes/tts.ts:75` `applyGeneratedTtsToWords` — pure, generic, **fully unit-tested**
  (`tests/lib/themesTts.test.ts:67-142`), and **imported by zero production modules**
  (grep: only the test file references it).
- `convex/themes/mutations.ts:233-276` `handleApplyGeneratedThemeTts` — the version that
  actually runs in the pipeline (called via `internal.themes.applyGeneratedThemeTts` from
  `generateThemeTtsAction.ts:116`). It hand-rolls the same loop (`wordIndex` in range +
  `sourceWord`/`sourceAnswer` match → apply, else skip).

This is exactly the "tested wrapper that production doesn't use" anti-pattern, and worse: the
two copies are **not even behaviorally equivalent**. The convex version additionally:
1. skips when `currentWord.ttsStorageId` is already set (lib version overwrites it), and
2. accumulates `rejectedStorageIds` so the action can clean up orphaned files
   (`generateThemeTtsAction.ts:121-123`).

So the green test suite is asserting the behavior of code that never executes, while the real
mutation's extra guard and rejected-IDs contract are untested. This is a maintenance trap: a
future edit to the real rule will leave the test passing against the wrong implementation.

**Remedy (code judo):** make `lib/themes/tts.ts` the single source of truth and call it from
the mutation. Extend `applyGeneratedTtsToWords` to return rejected IDs and to skip
already-populated slots (the two behaviors production needs), then rewrite
`handleApplyGeneratedThemeTts` as: load theme → `applyGeneratedTtsToWords(theme.words, generated)`
→ `patch` if `applied > 0` → return `{ applied, skipped, rejectedStorageIds }`. Deletes ~25
lines of duplicated branching from `mutations.ts`, and the existing unit test now covers the
real path. If for some reason the mutation cannot import from `lib/`, then delete
`applyGeneratedTtsToWords` + its test entirely — keeping a tested-but-unused divergent copy is
strictly worse than no copy.

### 2. Parallel `ThemeWordWithTts` / `GeneratedWordTtsResult` type families in `lib/themes/tts.ts` and `convex/themes/ttsPipeline.ts`

The same domain concepts are declared twice with different shapes:

- `lib/themes/tts.ts:1-19`: generic `ThemeWordWithTts<TStorageId extends string>`,
  `GeneratedWordTtsResult<TStorageId>`, `ApplyGeneratedTtsResult<TWord>`.
- `convex/themes/ttsPipeline.ts:5-21`: concrete `ThemeWordWithTts` (`ttsStorageId?: Id<"_storage">`),
  `ThemeTtsTarget`, `GeneratedWordTtsResult` (`storageId: Id<"_storage">`).

The convex copy is the one the whole server uses (`mutations.ts`, `queries.ts`,
`archiveDuplicate.ts`, `cleanupHelpers.ts`, `generateThemeTtsAction.ts` all import
`ThemeWordWithTts` from `./ttsPipeline`). The generic lib copy exists almost entirely to let the
dead `applyGeneratedTtsToWords` (#1) be unit-tested against `string` instead of `Id<"_storage">`.
The `<TStorageId extends string = string>` / `NonNullable<TWord["ttsStorageId"]>` machinery
(`lib/themes/tts.ts:77`) is generic indirection bought solely to dodge the `Id` brand in tests.

**Remedy:** once #1 collapses the apply logic, the generics lose their only reason to exist.
Keep `ThemeWordWithTts` defined **once**. The clean ownership is: the structural word shape
lives in `lib/themes/tts.ts` as a plain (non-generic) type parameterized only where it must
cross the `Id` boundary; `convex/themes/ttsPipeline.ts` re-exports/extends it for the
`Id<"_storage">` specialization rather than re-declaring it. Drop `ApplyGeneratedTtsResult` and
the generic `GeneratedWordTtsResult` from lib. This removes a whole second vocabulary for the
same nouns — directly the AGENTS.md "naming across the entire stack is non-negotiable" rule.

---

## 🟡 Medium

### 3. `useTTS` is a shared hook parked in a feature folder (`app/game/hooks/`)

`useTTS` (`app/game/hooks/useTTS.ts`) is the canonical TTS playback engine consumed by **three
unrelated features**: themes (`useThemeTtsController.ts:6`), solo learn
(`app/solo/learn/[sessionId]/page.tsx:24`), and duel (via `useDuelAudio.ts:4`). "game" does not
own this concept. Per the layering rule (hooks orchestrate; shared logic belongs in a shared
location), a hook used by themes/solo/duel should not live under `app/game/`.

**Remedy:** move to a feature-neutral location — e.g. `hooks/useTTS.ts` (a top-level `hooks/`
dir already exists per the scope grep) or `lib/tts/`-adjacent `app/components/`/shared hooks
folder, matching wherever other cross-feature hooks live. Update the three importers. Pure
relocation, no behavior change, but it stops "game" from looking like the owner of playback.

### 4. `useDuelAudio` (`app/duel/[duelId]/hooks/useDuelAudio.ts`) is a 17-line identity wrapper

The entire hook renames `isPlaying → isPlayingAudio` and wraps `playTTS(key, text, {storageId,
themeId})` as `playAudio(key, text, storageId?, themeId?)` — i.e. it converts the options object
back into positional params and renames two fields. It adds indirection without buying anything;
the only caller is `useDuelActions.ts:51`.

**Remedy:** delete the file and call `useTTS()` directly in `useDuelActions`, destructuring
`{ isPlaying: isPlayingAudio, playTTS }` if the local names matter. If a positional `playAudio`
signature is genuinely preferred at the call site, that adapter is one inline `useCallback` in
`useDuelActions`, not a separate hook file. (Compare the example review's stance on thin
wrappers / identity abstractions.)

### 5. AbortController + `TTS_TIMEOUT_MS` timeout boilerplate is duplicated across the live and stored paths

The "create an `AbortController`, `setTimeout(abort, TTS_TIMEOUT_MS)`, run, `clearTimeout` in
`finally`" dance appears verbatim in two places:

- `app/api/tts/ttsService.ts:68-89` (live path), and
- `convex/themes/ttsPipeline.ts:79-90` `generateThemeTtsAudio` (stored path).

Both wrap the *same* `generateTtsAudioWithFallback` and use the *same* `TTS_TIMEOUT_MS`
constant. The stored path then re-wraps via the callback in `generateThemeTtsAction.ts:60-67`,
adding a layer of "callback that forwards `signal` into `generateTtsAudioWithFallback`" purely
to satisfy `generateThemeTtsAudio`'s injected-`generateAudio` parameter — even though there is
only ever one real implementation injected.

**Remedy:** give `generateTtsAudioWithFallback` (or a small `withTtsTimeout(fn)` helper in
`lib/tts/`) ownership of the timeout, so both call sites become a single `await
generateTtsAudioWithFallback({ text, preferredProvider })`. That deletes the duplicated
controller/timeout blocks and lets `generateThemeTtsAudio` drop its `generateAudio` injection
param + the wrapper closure in the action (`generateThemeTtsAction.ts:60-67` collapses to a
direct call). Net: one timeout policy, one fewer indirection layer.

### 6. `getResembleApiKey` / `getElevenLabsApiKey` are copy-pasted (`providerAdapters.ts:46-58`)

The two key-readers are byte-for-byte identical except the env var name. `getResembleApiKey` is
exported only because `ensureRemoteResemblePreset`/`generateResembleTtsAudio` also need it; the
ElevenLabs twin is private. Minor, but it's literal copy-paste in the focus file.

**Remedy:** `const readApiKey = (envVar: string): string | null => { const v =
process.env[envVar]?.trim(); return v ? v : null; }` and call with the two var names.
Collapses 13 lines to ~4.

### 7. Resemble response-shape probing (`item || data || <self>`) reads like compat-fallback and should be one explicit parse

`createResembleClip` (`:158`), `waitForResembleAudio` (`:186`), `ensureRemoteResemblePreset`
(`:87-93`, `:115`) each defensively reach into `data.item || data.data || data` and, for the
preset list, `Array.isArray(listData) | listData.data | listData.items`. This is three different
ad-hoc shape guesses against one vendor API scattered across three functions — the kind of
"silent default that papers over an unclear contract" the AGENTS.md fallback rule targets (this
is a data-shape guess, **not** the allowed provider-A→B degradation).

**Remedy:** define the expected Resemble response types once and a single
`extractResembleEntity(data)` / `extractResemblePresetList(data)` parser used by all three call
sites, returning a typed result or throwing a clear error. Replaces scattered `||` chains with
one explicit boundary. (Lower priority than #1/#2, but it lives in the special-focus file.)

---

## 🟢 Minor / nit-level

- **`useTTS` `revokeOnCleanup` flag is effectively always-true for live URLs and always-false
  for storage URLs** (`useTTS.ts:82`, `:104`). It's correct and worth keeping (storage URLs are
  remote and must not be revoked), but a one-line comment at the type
  (`{ url: string; revokeOnCleanup: boolean }`, `:20`) stating "storage URLs are remote, never
  object-URLs" would make the invariant obvious. Leave the logic as-is.
- **`TtsProviderAdapter` type (`providerAdapters.ts:39-44`) is fine** — this *is* a clean adapter
  interface (id + contentType + isConfigured + generateAudio), not over-engineering. The
  provider A→B loop in `generateTtsAudioWithFallback:290-304` is the legitimate degradation chain
  AGENTS.md explicitly allows; no change requested. Noting it here so it's on record as reviewed
  and intentionally not flagged.
- **`buildThemeTtsNoopResult` + the two inline result literals** (`generateThemeTtsAction.ts:39-54`,
  `:173-182`, `:187-196`) construct the 8-field `GenerateThemeTtsResult` three times. The two
  inline literals could route through a small builder seeded from `plan`, but the field sets
  differ enough that it's borderline; fine to leave unless #1's refactor touches this file
  anyway.
- **`ttsGenerationLocks` is sound.** The lock is per-user (token + expiry on the user doc,
  `schema.ts:241-242`), acquire is a compare-and-set with a clamped TTL
  (`ttsGenerationLocks.ts:22-30`), release is token-matched and idempotent. Per-user (not
  per-theme) serialization is a deliberate, reasonable choice given credits are per-user. The
  `crypto.randomUUID` availability check (`generateThemeTtsAction.ts:31-37`) is a genuine runtime
  capability guard (Convex runtime), not a forbidden fallback. No change requested. The
  orchestration in `generateThemeTtsForCurrentUser` already runs targets concurrently via
  `Promise.allSettled` (`generateThemeTtsAction.ts:94`), so there is **no** unnecessary
  sequential-orchestration smell here.
- **`TTS_GENERATION_LOCK_MS` is declared twice** with the same value:
  `generateThemeTtsAction.ts:18` and `ttsGenerationLocks.ts:4` (`TTS_GENERATION_LOCK_MAX_MS`).
  They mean slightly different things (requested vs. clamp ceiling) so it's defensible, but a
  shared `convex/constants.ts` entry would keep them honest if one ever changes.

---

## Recommended ordering

1. **#1** — collapse the apply-logic duplication into the canonical lib helper (biggest
   correctness/maintenance win; aligns tests with the real path).
2. **#2** — unify the `ThemeWordWithTts` / generated-result type families (falls out naturally
   once #1 is done).
3. **#5** — hoist the timeout policy into `lib/tts/`, drop the `generateAudio` injection layer.
4. **#3 / #4** — relocate `useTTS`, delete `useDuelAudio`.
5. **#6 / #7** — provider-file dedup + Resemble shape parsing.
6. Minor items opportunistically.

## Approval bar

Approvable after #1 and #2. The pipeline orchestration, provider adapter interface, and locking
are genuinely well-built — this is **not** a 🔴. But it cannot ship clean while:

- a fully-tested helper (`applyGeneratedTtsToWords`) has **no production caller** and has
  **diverged** from the mutation that actually runs (#1), and
- the core domain types are declared in two incompatible vocabularies across the lib/convex
  boundary (#2), violating the cross-stack naming rule.

Those two are structural debt with a clear deletion path, so they gate approval. #3–#7 are
strongly recommended but would not, alone, block.
