# Wrong Answer / Correct Answer Collision After Accent Stripping

**Date identified:** 2026-04-15

## The Problem

Wrong answers can become identical to the correct answer after accent normalization, making it impossible for players to distinguish them during gameplay.

**Example:** Correct answer is `"el café"`, AI generates `"el cafe"` as a wrong answer. Validation passes because `normalizeComparableValue` preserves accents — the two strings differ. But during gameplay, answer comparison strips accents (`normalizeAccents`), so both become `"el cafe"` and the player sees two identical-looking options.

## Where It Happens

1. **AI generation** (`lib/generate/prompts.ts`) — prompts say wrong answers must not match the correct answer, but say nothing about accent-stripped equivalence.
2. **Server validation** (`lib/themes/serverValidation.ts` L74-77) — uses `normalizeComparableValue` (preserves accents) to check wrong-vs-correct collision, so `café` ≠ `cafe` passes.
3. **Client validation** (`lib/themes/validators.ts` L24-28) — `doesWrongAnswerMatchCorrect` also uses `relaxedNormalize` which preserves accents. Same gap.
4. **Gameplay** (`lib/stringUtils.ts` `normalizeAccents`) — strips all diacritics for comparison, collapsing the difference.

## Two-Layer Fix

### Layer 1: Tell the AI (prevention)

Add a rule to `WRONG_ANSWER_REQUIREMENTS` in `lib/generate/prompts.ts`:

> "No wrong answer may differ from the correct answer only by accents or diacritics (e.g., if the answer is 'el café', do not use 'el cafe' as a wrong answer)."

This reduces the occurrence at generation time.

### Layer 2: Validate with accent stripping (enforcement)

Update the wrong-answer-vs-correct-answer checks in both:
- `lib/themes/serverValidation.ts` `validateWrongAnswers` — compare using `normalizeAccents` instead of `normalizeComparableValue`
- `lib/themes/validators.ts` `doesWrongAnswerMatchCorrect` — compare using `normalizeAccents` instead of `relaxedNormalize`

This catches any collision the AI still produces, blocking it at save time.

## Status

Ready to implement. Both layers are small, isolated changes.
