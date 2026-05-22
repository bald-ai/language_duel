# Code Review — Plain-Language Action List (Must / Might / Don't)

**Date:** 2026-05-22
Same findings as the 15 area reviews + the reconciliation, re-sorted into three buckets and written
in everyday language. For the technical detail (file:line, exact remedy) open the matching
`Dev/code_review_*.md`.

**How to read the buckets**
- **MUST** — real problems worth fixing now: the blockers, plus the things a review said have to
  land before that area is "done."
- **MIGHT** — genuine improvements, but optional / do them when you're already in that code.
- **DON'T** — leave it alone. Either it's already good, or changing it would add churn for no gain.
  Several of these are things the reviewers explicitly said *not* to touch.

**A few problems show up almost everywhere — fix each once, not per screen** (details in the
reconciliation file):
- The same "pick the popup frame" code is hand-built in many popups → use the one shared popup.
- Many components mix two color systems (a frozen set of colors + the live theme), causing a
  shadow-bug → always use the live theme colors.
- The front-end keeps re-describing data shapes by hand, and they've drifted from what the server
  actually returns → derive the shape from the server instead.
- Lots of "code nothing calls" left over from past rewrites → delete it (needs your OK first).

---

## Theme content

### Area 1 — Theme management screens (view/edit your vocab sets) · 🔴 needs work
**Must**
- The main theme-detail file is ~760 lines and is really three screens glued together (header,
  the word cards, the bottom action bar). Split it into three.
- Stop passing the "add word" and "generate more" popups *through* the detail screen just so they
  can appear next to it. Show them on the page directly, the way the delete popup already works.
  Drops ~15 pass-through inputs.
- One piece of "caching" actually re-runs every single render — it does nothing but add noise.
  Delete it.
- The theme list uses heavy variable-height scrolling machinery, but every row is the same height.
  Rip it out (use a simple fixed-height list, or none).
- The popups each rebuild the same popup frame by hand and one delete popup copy-pastes a "danger
  button" style that already exists — use the shared popup + the existing button style.
- The list's filter is three separate on/off switches that must never be on at once, kept in sync
  by hand. Replace with one "current filter" value.
**Might**
- The word editor renders three modes inline; split into three small pieces.
- The controller hook hands back ~18 things but the page uses ~6 — trim the unused ones (and a
  dead setter).
- Duplicate-word checking runs at two or three layers each render; compute once and share.
- Rename-on-click-away and rename-on-Enter duplicate the same logic; share one function.
**Don't**
- The little 3-type helper file and the near-duplicate "visibility/can-edit" handlers are fine —
  leave them until there's a real third case.

### Area 2 — Theme data & "who can see/edit" rules · 🔴 needs work
**Must**
- The rule for "who is allowed to edit this theme" is written out **three times** in three places.
  Change the rule once and you must remember all three or they disagree. Write it once and have the
  others call it.
- That shared rule is named as if it's only about audio ("can generate TTS") but it's actually the
  general "can edit" check the whole UI relies on. Rename it to say what it really is.
- Listing themes re-checks "can this person see it?" by firing ~9 database lookups **per theme, one
  after another** — even though the list was already built from access-aware queries. Drop the
  redundant re-check; the list is already correct.
- A 6-line file just re-exports another file under a second name, so the same thing is imported two
  different ways. Delete it and import the real one.
**Might**
- The validation helpers re-scan all the words several times to answer one question; scan once and
  read off the results.
- A duplicate-word check fakes a dummy word to reuse the big validator — replace with a simple
  "is this word already in the list?" check.
- A word-type list is hand-copied in three places; keep one and reference it.
- A one-item list + type-cast used to test "is it a draft" — just compare to "draft".
**Don't**
- The appearance/color file (`lib/theme.ts`) is internally clean — see the coverage-gap note below;
  the issue is that it's filed in the wrong area and shares the word "theme" with vocab themes.

### Area 3 — Theme generation & "Pick and Prune" · 🔴 needs work
**Must**
- The generation service (~490 lines) is **five copy-pasted pipelines** that all do the same thing
  (build prompt → ask the AI → check → retry → check → charge credits). The retry/charge/finish tail
  is pasted verbatim five times. Collapse to one engine that takes a small per-type recipe.
- The "what makes a valid word" rule is expressed three different ways in three files, with the
  exact length checks duplicated. Route them through one shared check.
- The request shape is hand-written three times (server side, client side, and a client response
  checker) with no link between them — rename a field and you must fix all three by hand. Make one
  the source and derive the others.
- The generation popups rebuild the popup frame instead of using the shared one, and there's yet
  another hand-built confirm dialog — converge on the shared popup + one shared confirm dialog.
**Might**
- The default word type is re-applied in ~13 spots because the request leaves it optional; decide it
  once at the entry point.
- One word-type carousel and one "Try Pick & Prune" promo are inlined and copy-pasted across the two
  generate popups; pull each into its own small piece.
- The controller hook leaks raw on/off state next to the bundled inputs — pick one surface.
**Don't**
- The "Pick and Prune" state logic is genuinely clean — keep it; it's the model the other theme code
  should copy.
- The request parser's internal design is good; the problem is duplication around it, not the parser
  itself — don't rewrite it.

## Gameplay

### Area 4 — The live duel screen · 🟡 mostly good
**Must**
- There's a 220-line "translation layer" that just reshuffles data from one shape into another, ends
  in a type-cast (a sign the computer couldn't verify the reshuffle), and is then immediately
  un-shuffled by a 90-line block in the duel view. It earns nothing — build the final shape directly
  and delete the layer.
- One game rule (zeroing hints in single-player mode) is applied in that translation layer and
  silently throws away the hint logic computed elsewhere. Move it into the one place hints are decided.
- The duel view file is ~712 lines (header + body + footer in one) with the answer-grid loop
  copy-pasted three times. Split it and collapse the triplicated loop.
**Might**
- The "show the frozen question vs the live one" choice is repeated ~8 times — decide it once.
- Two hooks separately watch the same phase change; have one do it.
- A hook hands back references nobody reads — drop them.
- One question type is declared twice, with a repeated cast.
**Don't**
- The hook layer here is genuinely well-organized (the answer state machine, sabotage, and
  save-actions are cleanly separated, with pure logic in the right place). Leave it as-is.

### Area 5 — Practice question screens & sabotage effects · 🔴 needs work
**Must (needs your sign-off — it's a deletion)**
- The big one: each question-input screen advertises "works for solo and duel," but the duel half is
  **never used** in the real app (the live duel screen uses different components). That dead duel half
  — including ~280 lines of four-times-copy-pasted "hint UI" and a drag-the-letters anagram feature —
  is ~700 lines that do nothing in production, kept alive only by tests. Recommend deleting it (and
  the tests that guard it). Confirm before deleting.
**Must**
- Even in the solo-only code, the "Confirm / Don't Know" buttons and their styles are hand-copied
  across 3–4 screens — extract one shared button row + style.
- The "split letters into words" rendering loop is duplicated between two screens — make one shared
  helper.
- The two answer-animation hooks (bounce, trampoline) are the same hook with two physics models —
  share one animation engine.
**Might**
- Those animations use plain random numbers while the rest of the app uses a seeded/reproducible
  generator — make it a deliberate choice.
- A keyboard handler works around React with a timeout and a disabled lint rule; simplify once the
  dead duel code is gone.
**Don't**
- The shared duel pieces (Scoreboard, final-results, countdown, hint UI) are clean — no action.
- The audio "try storage, else regenerate" branch is normal product behavior, not a problem.

### Area 6 — Duel/challenge server logic & rules · 🔴 needs work
**Must (needs your sign-off — deletions)**
- One helper file (~84 lines) has **zero callers** — delete it.
- ~70% of another helper file is leftover solo-game logic that was rewritten elsewhere and never
  removed — the new version is what runs. Delete the old copy (and its now-orphaned tests).
- A couple more test-only helpers nothing else uses — delete.
**Must**
- "Playing against yourself" is handled as a special case bolted into **three** separate rule files,
  with correctness held together by a written warning instead of the type system. Model it cleanly as
  single-player instead of a fake two-player match.
- The four sabotage effect names are listed in three places, and a phase list in two — keep one of
  each and reference it.
**Might**
- The "is the round finished?" tail is duplicated between the answer and timeout paths — share it.
- A sabotage timer has optional settings that always get the default anyway, plus a 25-second
  "just in case" branch for a state that can't happen — simplify.
- The challenge-creation code re-checks fields the data model should already guarantee; and the
  "accept/decline from a notification" handlers duplicate the plain "accept/decline" ones — share the
  guard logic.
**Don't**
- The single PvP/PvE mode gate (`assertDuelMode`) is clean and used consistently — keep it exactly.
- The pure rule/scoring files are in the right place and fine — leave them.

### Area 7 — Challenge lobby (set up a match) · 🟡 mostly good
**Must**
- The Challenge popup is ~707 lines and is three unrelated screens in one (an inbox of incoming
  challenges, the create-a-challenge form, and three list pickers). Split them.
- There's dead "public API" indirection: five re-exports nobody imports, and a "pending count" value
  nobody reads — delete.
- One mode button mixes the two color systems (the shadow-bug) — use the live colors only.
- A "compact theme picker" inside the popup is a ~120-line copy of the shared theme picker, which was
  already built to be embedded — use the shared one.
**Might**
- Two hand-written "user" shapes that are identical — collapse to one, sourced from the real data.
- Two screens copy-paste the same trio of lobby popups — make one shared wrapper.
**Don't**
- The lobby's state machine is genuinely good (one clear status, not scattered switches) — keep it.
- The self-duel helper is small, pure, and reused — fine. (Note: there's **no** "join by code"
  feature here despite the brief; only create→wait.)

## Practice & progress

### Area 8 — Solo practice & "Learn" screens · 🔴 needs work
**Must**
- The two practice pages copy-paste ~95 lines of identical "figure out which session this is" setup
  plus a 5-branch loading/error screen — change one and you must change the other. Extract a shared
  hook + a shared status screen.
- The practice page is ~735 lines doing four jobs (session setup, completion-reporting bookkeeping,
  a big inline header, and a 220-line "pick the right input for this level" ladder). Move the
  bookkeeping into a hook and the level-picker behind one small component.
- The practice header and learn header are the same decorative header with a different subtitle —
  make one.
- The Exit button, the bottom gradient bar (pasted ~7 times), and a button style that already exists
  centrally are all copy-pasted — share them.
**Might**
- A couple of small "advance to next question" duplications and an unnecessary timing workaround.
- The learn page holds ~120 lines of reveal/confidence/timer state that belong in a hook.
- A confidence value is encoded into the URL in one file and decoded in another, 500 lines apart —
  put both halves together.
- Use the real word type instead of poking at object shapes with "in"/"typeof" guards.
**Don't**
- The pure solo runtime, navigation, timer, and the small learn pieces are in good shape — leave them.
- `lib/contextClues` is prototype code (only the prototype uses it) — not graded; treat as excluded.

### Area 9 — Weekly goals & boss · 🟡 mostly good
**Must**
- The goal's real status (draft / locked / grace period / completed) is re-derived from raw dates and
  flags in **4–5 places**, and the "one partner locked, waiting on the other" state in 5 places.
  Compute each once and have everyone read that.
- A "mode" field is marked optional and defaults to "shared," with an impossible third branch — but
  every goal always sets it. Make it required and drop the just-in-case default.
- The "is this theme completed?" rule (solo vs shared) is copy-pasted four times — use the one helper
  that already exists.
**Might**
- The big mutations file (~525 lines) mixes five concerns (edit, boss launch, lock, delete, and
  notification handlers) — split before it grows past the limit.
- Order the lock/complete steps so the actual status change happens before the notifications, not
  after the riskiest step.
- A tested "can start boss?" helper isn't used in production while the real path re-implements it.
**Don't**
- No blockers; the pure logic layer is mostly fine. Nothing here is urgent on its own.

### Area 10 — Spaced repetition · 🟡 mostly good
**Must**
- The review board re-describes the server's data by hand and it's already drifted — it invents a
  `partner.email` field the server never sends (the test even fakes it). Derive the shape from the
  server so the fake field disappears.
**Might**
- The board file (~412 lines) does five presentation jobs in one — split into card/row/section pieces
  and share the title/step helpers with the launch page (they're currently copy-pasted).
- One "Ready Now" section re-implements a header that a shared section component already provides.
- A redundant "is it due now" field nobody reads — delete.
- The board loads every ready item's full word content just to compute a yes/no "is content ready"
  flag — use a lighter check.
**Don't**
- The scheduling logic (`lib/spacedRepetition.ts`) is exemplary — small, pure, fully tested, reused
  everywhere. Leave it. The server-side defensive guards are fine too.

## Cross-cutting systems

### Area 11 — Notifications & friends · 🔴 needs work
**Must**
- The server already has a clean, typed model of each notification kind, but the notification list
  component **throws it away** and re-describes everything as "everything optional," then sorts it out
  by hand in a 280-line switch. Use the server's typed model.
- That notification component is ~524 lines — really nine little cards fused into one switch. Turn it
  into a lookup of small per-type cards. This also fixes the next point.
- The component is handed **nine** action callbacks for every notification though each uses at most
  three — give each card only its own.
- A hand-written "does this have a goal id?" checker duplicates one that already exists — use the
  existing one.
- "Remove friend" scans a user's entire friend list twice instead of using the existing indexed
  "friendship between these two people" helper — use the helper.
**Might**
- A notification-type map is built at runtime then forced back to a hand-written type — just write
  the four-line map plainly.
- An event value that's written but never read; the same event list hand-copied three times; a
  "1 theme / N themes" pluralizer written three times — consolidate each.
**Don't**
- The friends/notifications server code is otherwise in good shape (reused guards, centralized
  ownership checks, no just-in-case branches) — leave it.
- A generic countdown hook lives in the wrong folder (only goals use it) → just relocate it.

### Area 12 — Email & reminders · 🟡 mostly good
**Must**
- ~120 lines of dead/duplicated code in the email-log file: two 60-line lookup ladders that are the
  same except the last line; a "log sent" function nobody calls; and a finished one-time migration
  cleanup that's forbidden to keep. Delete them (collapse the two ladders into one).
- The list of email triggers is written twice (schema + the contract file) and kept in sync by hand —
  a tenth trigger would silently break at the boundary while compiling fine. Derive one from the other.
**Might**
- A "reminder offset" value is threaded through five layers as if it affects de-duplication, but
  nothing actually uses it for that — drop it from those signatures (keep it only as a stored note).
- A "contract" file that just re-exports three things under new names, with one consumer that
  re-exports them *again* — delete the middle layer (and stop renaming the email-only type to a
  broader name).
- The reminder enable-check runs twice (planner + sender) — let the sender be the one gate.
- A magic 10-minute number and an unused database index — name the number, drop the index.
**Don't**
- The cron scheduling is clean (one job per concern). The "best-effort, swallow one bad recipient"
  error handling is intentional batch isolation, not a problem. Leave both.

### Area 13 — Text-to-speech pipeline · 🟡 mostly good
**Must**
- A fully-tested "apply generated audio to words" helper has **no production caller** — and the real
  version (a hand-rolled copy in a mutation) has quietly **diverged** from it. So the tests are
  guarding code that never runs. Make the tested helper the real one and call it from the mutation.
- The core audio types are declared twice in two incompatible shapes across the front/back boundary
  (the generic version exists only to make the dead helper testable) — keep one.
**Might**
- The shared audio hook lives in the "game" folder though themes/solo/duel all use it — relocate it.
- A 17-line hook just renames two things — delete it and call the real hook directly.
- The "abort after timeout" code is duplicated on the live and stored paths — share one timeout
  helper.
- Two identical API-key readers; a vendor response is shape-guessed in three spots — consolidate.
**Don't**
- The provider "try A, fall back to B" chain, the per-user lock, and the adapter interface are all
  well-built and correct — leave them (the A→B fallback is allowed product behavior, not a problem).

## Foundation & shell

### Area 14 — Settings, preferences & appearance · 🟡 mostly good
**Must**
- A production hook ships a **test-only escape hatch** (a global flag that lets un-wrapped test
  renders silently get default colors). That's exactly the kind of "just-in-case" branch the rules
  forbid — delete it and wrap the tests properly instead.
- The credits panel defaults the credit counts to "full" when missing — but the server always sends
  them. So a real bug that zeroed credits would show a happy "500/500." Make the values required and
  drop the default.
- A preferences hook has a parameter that does nothing (its result is thrown away) and is fed a
  do-nothing helper — delete both.
**Might**
- The CSS-variable color map is a hand-kept mirror of where the variables are written, already
  slightly out of sync — derive both from one list.
- The background picker re-declares the list of backgrounds the shared module already owns — use the
  shared one and tighten the type.
- The three preference-save mutations are near-identical with one inconsistency in where they
  validate — make them uniform.
**Don't**
- The "too many providers?" worry is a false alarm — the three providers share one persistence hook
  and don't duplicate logic. Don't merge them.
- Don't add a "patch user" wrapper — it'd just wrap one line and hide the per-field intent.
- The color-math magic numbers are fine inline (just fix one wrong comment that says ~60° when the
  code does 180°).

### Area 15 — App shell, sign-in, user sync & database schema · 🟡 mostly good
**Must**
- The shared "primary gradient button" style exists in one place and is used correctly by the modal
  buttons — but the menu button and back button each re-derive it by hand (three encodings of one
  thing). Route them through the shared one.
- The database schema declares the difficulty list **twice** under two names (identical values) and
  copy-pastes a six-field "where did this session come from" block across three tables. Define each
  once and reuse.
**Might**
- The home page (~499 lines) repeats the top-nav corners six times and inlines ~10 icons and the
  deep-link parsing — extract a shared header, move icons out, move parsing into a hook.
- The sign-in nav file repeats three near-identical button blocks and scatters page-prefetching —
  consolidate.
- User search has an unnamed "20" cap; a popup types its word list as "unknown[]" but only ever
  counts it — name the number, type the field honestly (or just pass a count).
**Don't**
- The hand-rolled `Id`/`WordEntry` types that keep pure logic free of generated imports are a
  deliberate, defensible boundary — leave them (just add a one-line "why" comment).
- The dev-only presence counter is acceptable as-is.

---

## Cross-area items that need a decision (not just code)
- **Confirm the deletions.** The dead-code removals in Areas 5, 6, 12, 13, 14 (biggest: ~700 lines of
  unused duel code in Area 5) are flagged, not done — the rules make deletion your call. Several are
  pinned by tests, which would be removed too.
- **`lib/theme.ts` (the appearance/color file) was never actually graded.** It was assigned to the
  "theme data" area but is really appearance code, so its insides went unreviewed. It needs a pass,
  and ideally a rename so "theme = colors" stops colliding with "theme = vocab set."
- **`lib/contextClues` is prototype code** — confirm it's excluded for good.
- **"Respond to a challenge" exists as two separate screens** (inside the Challenge popup and in the
  Notifications tab). Decide if you want both before anyone de-duplicates the server side.
