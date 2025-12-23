# Contributing to Language Duel

## Engineering Principles

### 1. Feature-First Architecture

We co-locate code by **feature**, not by technical type.

- **Rule:** If a component, hook, or utility is used by only one page, it belongs in that page's folder.
- **Structure:**
  - `app/feature-name/page.tsx` (The Controller)
  - `app/feature-name/components/` (The Views)
  - `app/feature-name/hooks/` (The Logic)
- **Violation:** Putting a `DuelTimer` in the root `components/` folder when it's only used by the duel feature.

**Example structure:**

```
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
      constants.ts          # Magic numbers & config for this feature
```

### 2. The "Skinny Page" Rule

Page components (`page.tsx`) are traffic controllers, not workers.

- **Rule:** A `page.tsx` file should not exceed **400 lines** UNLESS IT MAKES SENSE IN CONTEXT OF THAT FILE
- **Rule:** It must not contain complex `useEffect` chains, math, or data shuffling logic.
- **Action:** If logic is complex, extract it to a custom hook (e.g., `useDuelGameLoop`). If UI is complex, extract it to a sub-component.

**Good page.tsx:**

```tsx
export default function FeaturePage() {
  const { data, actions } = useFeatureLogic();
  
  if (loading) return <Loading />;
  if (error) return <Error />;
  
  return <FeatureUI data={data} onAction={actions.doThing} />;
}
```

**Bad page.tsx:**

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

### 3. Explicit Naming & Status

We do not use ambiguous or temporal names in production code.

- **Rule:** Never name a folder `old-`, `new-`, or `temp-`. Use descriptive feature names.
  - ✅ `classic-duel` (describes what it is)
  - ❌ `old-duel` (describes when it was made)
- **Rule:** If code is deprecated, mark it with `@deprecated` JSDoc comment or delete it. Do not leave "zombie code" linked in the app.

### 4. Logic Isolation

Business rules must be testable without React.

- **Rule:** Mathematical logic (scoring, shuffling, difficulty calculation) belongs in pure functions in `lib/`, not inside React components.
- **Benefit:** We can unit test the game rules without rendering the UI.

**Good:**

```tsx
// lib/scoring.ts
export function calculateScore(correct: number, total: number): number {
  return Math.round((correct / total) * 100);
}

// In component
import { calculateScore } from '@/lib/scoring';
const score = calculateScore(correct, total);
```

**Bad:**

```tsx
// Inside component
const score = Math.round((correctAnswers / questionsAnswered) * 100);
```

### 5. Magic Number Ban

- **Rule:** No hardcoded numbers (timers, probabilities, limits) in component logic or business rules.
- **Action:** Move them to `constants.ts` files, either at the feature level or global `lib/` level.
- **Exception:** Tailwind utility classes (e.g., `max-w-[360px]`, `pt-12`, `grid-cols-[1fr_200px]`) are generally allowed directly in JSX for layout purposes, as they represent visual styling rather than business logic. However, if a specific dimension is used repeatedly across multiple components, consider a constant.

**Good:**

```tsx
// constants.ts
export const POOL_EXPANSION_THRESHOLD = 0.65;
export const LEVEL_UP_CHANCE = 0.66;

// In hook
if (progress >= POOL_EXPANSION_THRESHOLD) {
  expandPool();
}
```

**Bad:**

```tsx
// In component
if (progress >= 0.65) {
  expandPool();
}
```

## Code Organization Reference

```
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
├── lib/                      # Pure utility functions
│   ├── difficultyUtils.ts    # Difficulty calculation logic
│   ├── answerShuffle.ts      # Answer shuffling logic
│   └── stringUtils.ts        # String manipulation utilities
└── public/                   # Static assets
```

## Pull Request Checklist

Before submitting a PR, ensure:

- [ ] Page components are under 400 lines if it makes sense for that page
- [ ] Complex logic is extracted to hooks
- [ ] No magic numbers in component code
- [ ] Feature-specific code is co-located with the feature
- [ ] No `old-`, `new-`, or `temp-` folder names
- [ ] Pure functions are in `lib/` and testable without React


Code must pass
npx tsc --noEmit
no errors
no lint errors
no warnings
