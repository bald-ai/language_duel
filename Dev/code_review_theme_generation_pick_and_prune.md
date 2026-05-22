# Code Review — Area 3: Theme generation & Pick-and-Prune

**Date:** 2026-05-22
**Scope:** `/api/generate` route + service + adapter, `lib/generate/*`, and the
generation/Pick-and-Prune UI + hooks under `app/themes/`. ~2.9k LOC reviewed.
**Verdict:** 🔴 **BLOCK**

## Scope reviewed

Real LOC (`wc -l`):

- **API:** `app/api/generate/route.ts` (26), `generationService.ts` (**492**),
  `openaiAdapter.ts` (88), `responses.ts` (51)
- **lib/generate:** `requestValidation.ts` (421), `prompts.ts` (338),
  `semanticValidation.ts` (244), `schemas.ts` (113), `constants.ts` (5)
- **Components:** `GenerateThemeModal.tsx` (316), `PickAndPruneReview.tsx` (302),
  `GenerateMoreModal.tsx` (146), `DiscardPickAndPruneModal.tsx` (75)
- **Hooks:** `useThemeGenerationController.ts` (295), `useThemeGenerator.ts` (189),
  `usePickAndPrune.ts` (188), `useGenerateMore.ts` (93)

Cross-file boundaries traced (not deep-reviewed): `lib/themes/api.ts` (Area 2 client
wrappers), `lib/themes/wordTypes.ts`, `lib/themes/serverValidation.ts`,
`app/components/modals/ModalShell.tsx`, `app/themes/page.tsx`, `app/themes/constants.ts`.

Excluded per area split: `useWordEditor`/`useThemeWordEditController` (Area 1, consumers of
the `field`/`regenerate-for-word` paths — confirmed live callers, not dead branches),
`serverValidation.ts` internals (Area 2), TTS (Area 13).

---

## 🔴 Blockers

### 1. `generationService.ts` (492 LOC) is five copy-pasted generate→validate→retry→validate→charge pipelines

This is the dominant structural problem in the area. Each request `type` (`theme` 114–169,
`field` 171–276, `regenerate-for-word` 278–344, `add-word` 346–414, `generate-more-words`
416–489) is its own ~70–100 LOC `if` block, and all five blocks are the **same pipeline**:

```
build prompt → callOpenAIJson(messages, schema)
  → validate
  → if issues: callOpenAIJson(buildRetryMessages(...)) → validate again
  → if issues: return validationFailureResponse(502)
  → consumeCreditsOrReturnFailure → generationSuccessResponse
```

The validate-once / retry / validate-again / 502 / charge / succeed tail is duplicated
**verbatim** five times (e.g. 158–168 ≡ 266–275 ≡ 334–343 ≡ 397–406 ≡ 479–488). The
`add-word` and `regenerate-for-word` blocks (346–414, 278–344) are nearly character-identical
— same schema, same `answerAndWrongs` parse type, same `wordLabel`, same userMessage, same
`validateGeneratedWordEntry({ word: newWord, answer, wrongAnswers }, …)` call — they differ
only in which prompt builder is called and that `add-word` does an extra pre-flight duplicate
check (98–110).

**Remedy (code judo — collapse to one engine).** Define a per-type *spec* and run a single
generic pipeline:

```ts
type GenerationSpec<TParsed> = {
  systemPrompt: string;
  userMessage: string;
  history?: HistoryMessage[];
  schemaName: string;
  schema: JsonSchema;
  validate: (parsed: TParsed) => string[];
  toResponseData: (parsed: TParsed) => unknown; // identity for most
  retryInstruction: string;
};

async function runGeneration<T>(openai, spec: GenerationSpec<T>) {
  let parsed = await callOpenAIJson<T>(openai, spec);
  let issues = spec.validate(parsed);
  if (issues.length) {
    parsed = await callOpenAIJson<T>(openai, { ...spec, messages: buildRetryMessages({…, parsed, validationIssues: issues}) });
    issues = spec.validate(parsed);
  }
  return { parsed, issues };
}
```

`handleGenerateRequest` becomes: resolve credit cost → `ensureLlmCreditsAvailable` →
`switch (body.type)` building a `GenerationSpec` → one `runGeneration` call → one shared
"if issues 502 / else charge + success" tail. Each `case` shrinks to ~10 LOC of
"build the spec." This deletes the four duplicated retry/charge tails (~120 LOC) and the
duplicated `add-word`/`regenerate-for-word` blocks collapse into one shared spec builder.
Target: < 250 LOC and a single canonical control flow that a reader holds once.

### 2. The validation contract is split across three layers and re-expressed three different ways

There are **three** independent validation surfaces for what is conceptually one contract
("a generated word entry is well-formed"):

1. `lib/generate/schemas.ts` — JSON-schema shape (string/array/min/max items).
2. `lib/themes/serverValidation.ts::collectThemeIssues` — typed `ThemeValidationIssue`
   discriminated union for length/empty/duplicate checks.
3. `lib/generate/semanticValidation.ts` — word-type rules **plus** hand-rolled length
   checks that duplicate #2.

`validateGeneratedAnswer` (semanticValidation.ts:146–150) and `validateGeneratedWrongAnswer`
(186–192) re-implement the exact `< 1` / `> THEME_*_MAX_LENGTH` length checks that
`collectThemeIssues` already produces as typed issues (serverValidation.ts:111–137). The
entry/theme validators (`validateGeneratedWordEntry`, `validateGeneratedTheme`) get length
checks for free via `collectThemeIssues`; the field validators re-do them by hand and emit
the same English strings inline. That is canonical-helper duplication of the exact kind the
project rules call out.

**Remedy.** Route the field validators through the same `collectThemeIssues` pathway, or
extract one `validateAnswerString` / `validateWrongAnswerString` helper that both layers
call, so the "min 1 / max N" rule lives once. `validateGeneratedAnswer` /
`validateGeneratedWrongAnswer` then reduce to (length via shared helper) + word-type rule +
the cross-field uniqueness checks that are genuinely field-specific.

### 3. `requestValidation.ts` (421 LOC) re-declares a request contract that `lib/themes/api.ts` already declares — the boundary is duplicated, not shared

`requestValidation.ts` defines `GenerateThemeRequest`, `RegenerateFieldRequest`,
`RegenerateForWordRequest`, `AddWordRequest`, `GenerateMoreWordsRequest` (35–87). The client
`lib/themes/api.ts` independently defines `GenerateThemeParams`, `GenerateFieldParams`,
`RegenerateForWordParams`, `AddWordParams`, `GenerateMoreWordsParams` (118–292) — the **same
field sets**, minus the `type` literal, then each `generateX` wrapper rebuilds the body
object literal by hand (`{ type: "theme", themeName: params.themeName, … }`) and re-validates
the **response** with hand-rolled type guards (`isWordEntryArray`, `isAnswerAndWrongsData`,
`isGenerateFieldData`, 16–55).

So one logical request/response contract is written out three times: the server request
interface, the client params interface, and the client response guard. A rename of any field
must be made in all three by hand with no compiler link between them. (`api.ts` is the Area-2
file, so I am flagging the *coupling* here, not deep-reviewing it — but the duplication
originates from this area's request types not being the shared source of truth.)

**Remedy.** Make `GenerateRequest` (this file) the single exported contract and have the
client derive its params via `Extract<GenerateRequest, { type: "theme" }>` minus `type`,
rather than re-declaring `*Params`. Better still, adopt the validator library already in use
elsewhere (Convex `v`/zod-style) so request parsing *produces* the type instead of a 421-LOC
hand-rolled parser whose `parseTrimmedString` / `parseStringArray` / `parseCount` /
`parseThemeWordCount` are a generic schema engine re-invented from scratch. At minimum,
collapse the per-field response guards in `api.ts` against the same shared shapes. Note: the
*parser itself* is clean and well-typed (the `ParseResult` discriminated return is good); the
problem is that it is one of three parallel statements of the same contract.

### 4. Four generation surfaces hand-roll modal chrome and ignore the canonical `ModalShell`

Identical to Area 1 blocker #5, now in this area's files. `GenerateThemeModal.tsx`
(63–70), `GenerateMoreModal.tsx` (40–47), `DiscardPickAndPruneModal.tsx` (34–41), and the
panel in `PickAndPruneReview.tsx` (48–51) all repeat:

```
fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4
  → rounded-3xl p-6 w-full max-w-md border-2 backdrop-blur-sm  (getThemeModalPanelStyle)
  → centered title <h2 class="title-font text-xl font-bold mb-4 text-center">
```

`app/components/modals/ModalShell.tsx` is the canonical implementation of exactly this
(portal + SSR-safe mount + appearance colors + centered title), and it is already used by
other modal flows. These four duplicate the overlay, the panel, the `if (!isOpen) return
null` gate, and the title block, and they skip the portal/SSR handling ModalShell provides.

**Remedy.** Wrap the three true modals in `<ModalShell title="…">`; delete their
overlay/panel/title boilerplate and the `getThemeModalPanelStyle` usage for the dialog
shell. `PickAndPruneReview` is a full-height inline panel (not a centered dialog) so it is a
legitimate exception to the portal modal — leave its layout, but it should still not be
duplicating the panel-style recipe (see Minor).

### 5. `DiscardPickAndPruneModal` is a thin reskin of the canonical confirm dialog

This 75-LOC component is "title + message + Keep/Discard buttons with `danger` styling" —
the same shape as `DeleteConfirmModal` / `RegenerateConfirmModal` flagged in Area 1. The only
variable is the `reviewKind`→message ternary (28–31). It hand-rolls the overlay/panel and
duplicates `getThemeActionButtonStyle("danger", colors)` plumbing.

**Remedy.** Once a shared `<ConfirmModal title message confirmLabel cancelLabel
confirmVariant>` exists (Area 1 will need it for the delete/regenerate confirms), this file
collapses to a single `<ConfirmModal>` usage with the message ternary. Do not ship a fourth
bespoke confirm dialog; converge on one.

---

## 🟡 Medium

### 6. `wordType` is double-defaulted because the request type leaves it optional

`requestValidation.ts::parseWordType` (114–118) deliberately returns `undefined` when absent,
so `wordType?: WordType` stays optional on every request interface. Consequently
`generationService.ts` re-applies the default **six times** (96, 116, 173, 280, 348, 418:
`body.wordType || getDefaultWordType()`), and `prompts.ts` *also* defaults it on **seven**
builders (`wordType: WordType = DEFAULT_WORD_TYPE`). The same default decision is encoded in
three places.

**Remedy.** Resolve the default once, at the boundary: have `parseWordType` (or each
`parse*Request`) return a concrete `WordType` defaulting to `DEFAULT_WORD_TYPE`, making
`wordType` **required** on the request types. Then the six `|| getDefaultWordType()` in the
service and the seven `= DEFAULT_WORD_TYPE` defaults in `prompts.ts` all delete — the prompt
builders take a plain required `WordType`. One default, expressed at the one boundary that
owns it. (Per AGENTS.md "no silent defaults that hide a contract" — push the decision to the
edge and make the internal contract explicit.)

### 7. `getDefaultWordType()` and `DEFAULT_WORD_TYPE` are two names for one value

`wordTypes.ts` exports both the const `DEFAULT_WORD_TYPE = "nouns"` (line 1) and a function
`getDefaultWordType()` (line 190) that returns it. This area uses the function in the service
(6×) and the const in `prompts.ts` (7×) — a naming-consistency smell where two spellings of
the same concept coexist across the stack.

**Remedy.** Keep `DEFAULT_WORD_TYPE`; delete `getDefaultWordType()` and its imports. (Largely
moot if #6 lands, since the internal call sites disappear — but the dual export should still
collapse to one.)

### 8. `useThemeGenerator.ts` hosts two unrelated hooks; `useAddWord` doesn't belong here

The file exports both `useThemeGenerator` (whole-theme generation) and `useAddWord`
(112–187, single-word add). They share no state and no helper — `useAddWord` is the add-word
feature's hook, co-located only by accident. It also re-exports `WordType` (line 189) as a
third public thing.

**Remedy.** Move `useAddWord` to its own `useAddWord.ts`. Drop the `WordType` re-export
(callers already import it from `@/lib/themes/api`). Minor, but it removes a misleading
"generator" grouping.

### 9. `GenerateThemeModal` (316 LOC) inlines a word-type carousel that is its own component

Lines 75–146 are a self-contained "carousel" widget: prev/next chevron buttons (with the two
inline `ChevronLeftIcon`/`ChevronRightIcon` SVGs at 302–316), the gradient selected-label
pill, the dot indicators, and the `cycleWordType` logic (56–60). It has nothing to do with
the theme-name/prompt/count form around it, and it pushes the file past a comfortable size
for a single modal.

**Remedy.** Extract `<WordTypeCarousel value onChange disabled />`. Drops ~85 LOC + the two
icon components out of the modal, and the carousel becomes reusable if word-type selection
appears elsewhere. The modal body then reads as "carousel / name / prompt / count /
actions / pick-and-prune CTA."

### 10. The Pick-and-Prune CTA block is duplicated verbatim across the two generate modals

`GenerateThemeModal` (269–296) and `GenerateMoreModal` (115–142) contain the same "Try Pick
& Prune" promo card: same wrapper styles (`mt-4 rounded-2xl border p-3`, the
`${colors.primary.DEFAULT}14` / `55` background/border), same uppercase label, a one-line
copy difference, and the same full-width outline "Try" button. Copy-pasted, will drift.

**Remedy.** Extract `<PickAndPruneCta description onTry disabled />`. Removes one of the two
copies and centralizes the promo styling.

### 11. The two generate modals are ~80% the same modal

Beyond the CTA (#10): both have the word-count `range` + numeric readout (GenerateTheme
199–227, GenerateMore 52–72), the spinner + "Generating N words…" block (GenerateTheme
230–242, GenerateMore 80–92), the `FormError`, and the Generate/Cancel button pair. The
divergence is small (theme adds name/prompt/carousel; "more" omits them and uses a different
button color + the `pickAndPrune` flag for the spinner copy).

**Remedy.** After #9/#10, factor the shared spinner + word-count-slider + action-row into
small components (`<GeneratingSpinner count label />`, `<WordCountSlider />`,
`<ModalActions />`). Not a full merge into one modal — the prop shapes differ enough — but the
shared pieces should be extracted rather than maintained in parallel.

### 12. Generation orchestration is split across two hook layers with no clear seam

`useThemeGenerator` / `useGenerateMore` each own `{ isGenerating/generationMode, error,
counts }` state and a `generate()` that calls the API and translates the result envelope into
`{ data | null } + setError`. Then `useThemeGenerationController` wraps **both** plus
`usePickAndPrune` + `useAddWord`, owns three `showXModal` booleans, and re-implements the
same "call generate → on success mutate localWords/draft + reset + close" shape four times
(`handleGenerateNewTheme` 64–88, `handleGeneratePickAndPruneTheme` 90–116, `handleGenerateMore`
187–202, `handleGenerateMorePickAndPrune` 204–227). The standard-vs-pick-and-prune split is
expressed as **two near-identical handlers per entry point** that differ only by
`wordCountOverride`/`countOverride` + `mode`/`pickAndPrune` + the success destination
(detail draft vs. `usePickAndPrune.initialize` + review view).

**Remedy.** Parameterize the success destination instead of forking the handler:
`handleGenerateTheme(mode)` and `handleGenerateMore(mode)` where `mode` selects override count
and `onWords: (words) => …`. Collapses four handlers to two. The `generationMode` /
`pickAndPrune` flags that exist only to drive the spinner copy can then derive from the single
"how many words am I generating" value rather than being threaded as separate booleans through
`useGenerateMore` (the `pickAndPrune` field there exists *solely* for the spinner string).

### 13. `useThemeGenerationController` exposes raw state setters alongside the props bundles

It returns both the memoized `generateModalProps` / `pickAndPruneReviewProps` /
`discardPickAndPruneProps` bundles **and** the raw `showGenerateModal`,
`setShowGenerateModal`, `showAddWordModal`, `setShowAddWordModal`, `showGenerateMoreModal`,
`setShowGenerateMoreModal`, plus the whole `addWordHook` / `generateMoreHook` / `pickAndPrune`
objects (277–294). That is the same "props-builder layer that also leaks the raw state it is
supposed to encapsulate" pattern flagged in Area 1 #9 — it invites future code to bypass the
bundles and drive the modals directly.

**Remedy.** Decide on one surface. Either return only the `*Props` bundles + the action
handlers `page.tsx` actually needs, or (cleaner) render `<GenerateMoreModal>` /
`<AddWordModal>` next to `<ThemeDetail>` and stop bundling. Trim the raw setters/hook objects
from the public return.

---

## 🟢 Minor / nit-level

- **`PickAndPruneReview.tsx` style helpers (181–270).** Six `get*Style` builders + the
  per-row gradient recipes are ~120 of the file's 302 LOC. Fine as local helpers, but the
  panel shell (`getThemeModalPanelStyle`, 50) is the same recipe ModalShell owns; consider a
  shared `panelSurfaceStyle(colors)` so the inline-panel and the dialog don't drift.
- **`createPickAndPruneWordId` (usePickAndPrune.ts:63–69)** has a `crypto.randomUUID`
  branch with a `Math.random` fallback. This is a genuine environment-capability fallback
  (old runtimes), not a compat shim — acceptable — but the project targets a Node 18+ /
  modern-browser runtime where `randomUUID` is always present, so the fallback branch is
  almost certainly dead. Confirm the runtime floor and delete the branch if so.
- **`responses.ts::buildGenerationValidationError` (8–14)** surfaces only
  `validationIssues[0]`, while the full `validationIssues` array is *also* returned in the
  body (36). The single-issue string is then thrown away by the client (`api.ts` reads
  `payload.error`). Harmless, but the "first issue only" prefix is redundant with the array.
- **`GENERATE_API_INCLUDE_DEBUG_PROMPT`** (responses.ts:4) is read but only documented in an
  archived progress note (`Dev/Archived/clean-code-progress.md`). Add it to the env example /
  current docs so the debug toggle is discoverable.
- **`openaiAdapter.ts::toResponsesInput` (25–30)** casts `message.content as string`. Since
  `buildMessages`/`buildRetryMessages` always set string content, type the internal message
  shape as `{ role; content: string }` instead of reusing `ChatCompletionMessageParam` and
  casting back. Removes the cast.
- **Magic `6` in `prompts.ts` summaries (278, 288)** — `buildWordFieldSummary` /
  `buildWrongFieldSummary` hardcode "6 challenging wrong answers" while the rest of the file
  uses `WRONG_ANSWER_COUNT`. Use the constant.
- **`max_output_tokens: 30000`** (openaiAdapter.ts:51) is an unnamed magic number; lift to
  `constants.ts`.

---

## Recommended ordering

1. **#1 generationService pipeline collapse** — biggest single LOC win and the area's core
   spaghetti; do first so #2/#6 land on top of one flow instead of five.
2. **#2 validation-layer dedup** + **#6/#7 wordType default consolidation** — these are
   contract-cleanups that also shrink the service further.
3. **#4/#5 ModalShell + ConfirmModal adoption** — low-risk LOC delete (coordinate with Area 1,
   which needs the same `ConfirmModal`).
4. **#9–#11 generate-modal decomposition** (carousel, CTA, shared spinner/slider).
5. **#12/#13 controller handler-merge + surface trim.**
6. **#3 shared request/response contract** — larger, possibly cross-area (touches Area 2
   `api.ts`); schedule deliberately.
7. Minors as drive-bys.

## Approval bar

Not approvable as-is. Blocking reasons:

- **`generationService.ts` 492 LOC of five copy-pasted pipelines** with an obvious
  single-engine reframing (the headline code-judo move).
- **One validation contract expressed three times** (schema / serverValidation /
  semanticValidation), with literal duplicate length checks.
- **The generate request contract duplicated across server types, client params, and client
  response guards** with no shared source of truth.
- **Canonical `ModalShell` ignored by four generation surfaces** and a fourth bespoke confirm
  dialog (`DiscardPickAndPruneModal`).

Bright spots that should be preserved: `usePickAndPrune` is a genuinely clean
reducer-driven state model (typed actions, discriminated `PickAndPruneDraft`,
derived sorted selectors) — exactly the shape Area 1 was missing, and a good template for
the rest of this area. `requestValidation`'s `ParseResult` discriminated return and
`responses.ts`'s small focused helpers are also good; the issue is duplication *around* them,
not their internal quality.
