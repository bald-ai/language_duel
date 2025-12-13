---
name: Difficulty Starting Levels
overview: Add a new Level 0 (word reveal with "Got it!"/"Not yet" buttons) and link the learn phase's confidence slider to starting difficulty in the solo challenge flow.
todos:
  - id: pass-confidence
    content: Modify learn page to pass confidence levels via URL to solo challenge
    status: pending
  - id: level0-component
    content: Create Level0Input component with Got it!/Not yet buttons
    status: pending
  - id: init-with-confidence
    content: Update session init to use confidence levels for starting difficulty
    status: pending
  - id: level-selection
    content: Update level selection logic to handle Level 0 progression
    status: pending
---

# Confidence-Based Starting Difficulty

## Summary

Link the confidence slider in the learn phase to the solo challenge's starting difficulty. Add a new Level 0 for words marked with 0 confidence.

## Key Changes

### 1. Pass Confidence Levels from Learn Phase to Solo Challenge

- Modify the "Skip to Challenge" navigation in [`app/solo/learn/[sessionId]/page.tsx`](app/solo/learn/[sessionId]/page.tsx) to encode confidence levels in the URL (as JSON in a query param)
- Confidence 0 → Start at Level 0
- Confidence 1 → Start at Level 1
- Confidence 2 → Start at Level 2  
- Confidence 3 → Start at Level 3

### 2. Add Level 0 Component in Solo Challenge

- Create a `Level0Input` component in [`app/solo/[sessionId]/page.tsx`](app/solo/[sessionId]/page.tsx)
- Shows: the word (English) and the answer (Spanish)
- Two buttons: "Got it!" and "Not yet"
- "Got it!" → upgrades word to Level 1 on next appearance
- "Not yet" → keeps word at Level 0 (will be shown again)

### 3. Update Session Initialization

- Parse confidence levels from URL in solo challenge page
- Use confidence levels to set initial `currentLevel` in `wordStates` (instead of always 1)
- Update `WordState` interface to support Level 0

### 4. Update Level Selection Logic

- Modify `selectNextQuestion` to handle Level 0
- Level 0 always shows Level 0 input (no random escalation)
- After "Got it!" → word becomes Level 1
- After "Not yet" → word stays Level 0

## Files to Modify

1. `app/solo/learn/[sessionId]/page.tsx` - Pass confidence to URL
2. `app/solo/[sessionId]/page.tsx` - Add Level0Input, parse confidence, update logic