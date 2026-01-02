# Contributing to Language Duel

This codebase optimizes for **fast, obvious change**. Our “rules” are defaults that keep the code easy to modify under real constraints. If a rule makes a change **slower without improving clarity**, it’s OK to break it — but do it consciously and keep the result readable.

---

## Engineering Principles

### 0) North Star: Change Speed + Clarity

* Prefer code that’s **easy to find**, **easy to understand**, and **easy to change**.
* Avoid “architecture theater.” Add structure **only when it reduces confusion or future work**.

---

## 1) Feature-First Architecture

We co-locate code by **feature**, not by technical type.

* **Default:** If a component/hook/utility is used by only one feature/page, it belongs in that feature folder.
* **Shared only when truly shared:** If it’s used in multiple features, move it to a shared location (`app/components`, `hooks`, `lib`, etc.).
* **Avoid archaeology:** Make it obvious where a thing lives.

**Structure (default):**

* `app/feature-name/page.tsx` (Controller)
* `app/feature-name/components/` (Views)
* `app/feature-name/hooks/` (Feature logic)
* `app/feature-name/constants.ts` (Feature constants / config)

**Violation example:** Putting a `DuelTimer` in root `app/components/` when it’s only used by `duel`.

**Example structure:**

```txt
app/
  solo/
    [sessionId]/
      page.tsx              # Controller - orchestrates the feature
      components/           # UI components specific to this feature
        CompletionScreen.tsx
        index.ts
      hooks/                # State & logic specific to this feature
        useSoloSession.ts
        index.ts
      constants.ts          # Non-obvious numbers & config for this feature
```

---

## 2) The “Skinny Page” Guideline

Page components (`page.tsx`) are traffic controllers, not workers.

* **Default:** Keep `page.tsx` under ~400 lines **if it improves readability**.
* **If it grows:** That’s a signal, not a failure.
* **Avoid in `page.tsx`:**

  * long `useEffect` chains
  * non-trivial data shuffling
  * game logic / scoring math
  * big JSX walls that hide intent

**Action:**

* If logic is complex → extract a hook (`useDuelGameLoop`) or pure functions (`lib/`).
* If UI is complex → extract components.

**Good page.tsx:**

```tsx
export default function FeaturePage() {
  const { data, actions } = useFeatureLogic();

  if (loading) return <Loading />;
  if (error) return <Error />;

  return <FeatureUI data={data} onAction={actions.doThing} />;
}
```

**Not great page.tsx:**

```tsx
export default function FeaturePage() {
  const [state1, setState1] = useState();
  const [state2, setState2] = useState();
  // ... 15 more useState calls

  useEffect(() => {
    // 50 lines of complex logic
  }, [dep1, dep2, dep3]);

  useEffect(() => {
    // Another 30 lines
  }, [dep4, dep5]);

  const handleThing = () => {
    // 20 lines of computation
  };

  return (
    // 200 lines of JSX
  );
}
```

---

## 3) Explicit Naming & Status

We avoid ambiguous or temporal names in production code.

* **Rule:** No folders named `old-`, `new-`, `temp-`. Use descriptive feature names.

  * ✅ `classic-duel`
  * ❌ `old-duel`
* **Rule:** No zombie code that’s still wired into the app.

  * Prefer deleting unused code.
  * If something is intentionally kept for migration, mark it clearly:

    * `@deprecated` JSDoc
    * comment describing removal plan / owner / date (brief)

---

## 4) Logic Isolation

Keep **game rules and business logic** testable without React.

* **Default:** Core rules (scoring, shuffling, difficulty, matchmaking rules) go in **pure functions** in `lib/`.
* **Allowed exception:** Small “glue logic” can live in hooks/components if it’s:

  * trivial (one-liners, obvious transforms),
  * not reused,
  * not a core rule that will evolve.

**Good:**

```ts
// lib/scoring.ts
export function calculateScore(correct: number, total: number): number {
  return Math.round((correct / total) * 100);
}
```

```tsx
// In component
import { calculateScore } from '@/lib/scoring';
const score = calculateScore(correct, total);
```

**Also acceptable (trivial + obvious):**

```tsx
const score = Math.round((correct / total) * 100);
```

**Not great (complex rule buried in UI):**

* multi-branch scoring/difficulty logic living inside React rendering code
* logic that you *wish* you could unit test without a UI harness

---

## 5) Magic Numbers: Name the Non-Obvious Stuff

* **Default:** If a number is **non-obvious**, **repeated**, or **business-significant**, give it a name.
* **Allowed exception:** Inline numbers are fine when they’re:

  * obvious math (`* 100`, `Math.round`, basic clamps),
  * one-off UI/layout adjustments,
  * truly local and unlikely to change.

**Good (non-obvious thresholds):**

```ts
// constants.ts
export const POOL_EXPANSION_THRESHOLD = 0.65;
export const LEVEL_UP_CHANCE = 0.66;
```

```ts
if (progress >= POOL_EXPANSION_THRESHOLD) {
  expandPool();
}
```

**Not great (mysterious constants scattered):**

```ts
if (progress >= 0.65) {
  expandPool();
}
```

**Tailwind exception (styling ≠ business logic):**

* Tailwind utilities like `max-w-[360px]`, `pt-s`, `grid-cols-[1fr_200px]` are fine inline.
* If the same custom dimension repeats a lot across the app, consider extracting it.

---

## Quick “Weirdness Threshold” (When to Extract)

Extract into a hook or `lib/` when you see:

* multiple branches + timers + state transitions
* dependency-heavy `useEffect` chains
* logic that would be painful to re-derive 2 weeks later
* logic that you’d want to unit test

Keep inline when it’s:

* a one-liner transform
* directly improves readability by being visible in-place
* not reused and not business-critical

---

## Code Organization Reference

```txt
language_duel/
├── app/                      # Next.js App Router
│   ├── components/           # Shared UI components (auth, modals, etc.)
│   ├── game/                 # Shared game mechanics
│   │   ├── levels/           # Level input components (L0-L3)
│   │   └── sabotage/         # Sabotage effects system
│   ├── duel/                 # Duel feature
│   │   └── [duelId]/
│   │       ├── page.tsx
│   │       ├── components/
│   │       └── hooks/
│   ├── solo/                 # Solo challenge feature
│   │   └── [sessionId]/
│   │       ├── page.tsx
│   │       ├── components/
│   │       └── hooks/
│   └── themes/               # Theme management feature
│       ├── page.tsx
│       ├── components/
│       └── hooks/
├── convex/                   # Backend functions & schema
├── hooks/                    # Global React hooks
├── lib/                      # Pure utility functions / core rules
│   ├── difficultyUtils.ts    # Difficulty calculation logic
│   ├── answerShuffle.ts      # Answer shuffling logic
│   └── stringUtils.ts        # String manipulation utilities
└── public/                   # Static assets
```

---

## Pull Request Checklist

Before submitting a PR, ensure:

* [ ] Feature-specific code is co-located with the feature
* [ ] `page.tsx` stays mostly orchestration (extract heavy UI/logic when it helps)
* [ ] Non-obvious / repeated numbers are named (`constants.ts`)
* [ ] Core rules live in `lib/` as pure functions (testable without React)
* [ ] No `old-`, `new-`, or `temp-` names
* [ ] Deprecated code is either removed or clearly marked with intent

---

## Required Checks (Must Pass)

Run:

```bash
npx tsc --noEmit
```

* ✅ no TypeScript errors

Also:

* ✅ no lint errors
* ✅ no meaningful warnings (if warnings are noisy/irrelevant, fix the config or suppress intentionally with a comment explaining why)

---

If you want, paste your actual ESLint setup and I’ll suggest a **“warnings that matter”** configuration so this stays strict without becoming a time sink.
