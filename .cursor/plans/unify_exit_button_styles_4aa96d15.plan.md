---
name: Unify Exit Button Styles
overview: Update the exit buttons in Solo Challenge (both learn and challenge phases) to match the subtle, minimal style used in the duel page.
todos:
  - id: update-learn-phase
    content: Update exit button in Solo Challenge Learn phase (app/solo/learn/[sessionId]/page.tsx)
    status: completed
  - id: update-challenge-phase
    content: Update exit button in Solo Challenge phase (app/solo/[sessionId]/page.tsx)
    status: completed
  - id: update-exit-component
    content: Update shared ExitButton component (app/components/ExitButton.tsx)
    status: completed
---

# Unify Exit Button Styles

## Current State

The duel page exit button uses a subtle, minimal style:

```173:177:app/duel/[duelId]/components/DuelGameUI.tsx
const exitButtonStyle = {
  backgroundColor: colors.background.elevated,
  borderColor: colors.status.danger.DEFAULT,
  color: colors.status.danger.light,
};
```

With simple classes: `py-2 px-4 rounded border-2 text-xs`

The Solo Challenge pages use a bold 3D red button with solid danger background, border-b-4, translate effects, and shadow-lg.

## Changes Required

### 1. Update Solo Challenge - Learn Phase

In [`app/solo/learn/[sessionId]/page.tsx`](app/solo/learn/[sessionId]/page.tsx) (lines 585-601), replace the 3D exit button styling with the duel page style:

- Remove `border-b-4`, `shadow-lg`, and translate hover effects
- Change to `rounded` instead of `rounded-xl`
- Apply the subtle color scheme (elevated background, danger border, danger text)

### 2. Update Solo Challenge - Challenge Phase

In [`app/solo/[sessionId]/page.tsx`](app/solo/[sessionId]/page.tsx) (lines 324-340), apply the same changes as above.

### 3. Update Shared ExitButton Component

In [`app/components/ExitButton.tsx`](app/components/ExitButton.tsx), update the styling to match the duel page style so any future usage of this component will be consistent.

## Target Style (Applied to All)

```tsx
className="absolute top-4 right-4 font-bold py-2 px-4 rounded border-2 text-xs uppercase tracking-widest transition hover:brightness-110"
style={{
  backgroundColor: colors.background.elevated,
  borderColor: colors.status.danger.DEFAULT,
  color: colors.status.danger.light,
}}
```