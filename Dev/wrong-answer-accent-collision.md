# Wrong Answer / Correct Answer Collision After Accent Stripping

**Date identified:** 2026-04-15  
**Status:** Resolved (2026).

## What was wrong

Wrong answers could match the correct answer after accent normalization (`normalizeAccents` / gameplay comparison), so multiple choices could look identical even though raw strings differed (e.g. `"el café"` vs `"el cafe"`).

## What we did

1. **Generation** — `WRONG_ANSWER_REQUIREMENTS` in `lib/generate/prompts.ts` tells the model not to use wrong answers that differ only by accents/diacritics (and related trivial variants).
2. **Validation** — Theme validation compares answers and wrong answers with the same normalization used in gameplay (`normalizeForComparison` in `lib/stringUtils.ts`), wired through `lib/themes/serverValidation.ts` and client checks in `lib/themes/validators.ts`.
3. **Generate API** — Theme generation responses are checked with `collectThemeIssues` before accept.

See tests under `tests/lib/themesCollectThemeIssues.test.ts`, `tests/lib/themesValidators.test.ts`, and theme generation API tests.
