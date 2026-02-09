# AGENTS.md

This file defines the shared rules for AI coding work. Optimize for clarity and fast change, and build for your future AI self.

## General
- Future-AI clarity: make intent obvious, keep logic easy to find, and add short comments only when the behavior is not self-evident.
- Feature-first organization: keep code with the feature unless it is truly shared.
- Consistent naming: use stable, descriptive names; avoid old/new/temp/v2/fixed; keep naming patterns uniform within a feature.
- Language glossary is the shared source of truth: consult `LANGUAGE.md` for UI/screens/flows. Update it only when the user asks or after a confirmed misunderstanding.
- Separation by layer: pages wire, components render UI, hooks orchestrate state, lib holds pure logic. Keep core rules testable without React.
- Name non-obvious or repeated numbers in `constants.ts`; trivial UI math can stay inline.
- Explicit input validation and clear errors at boundaries (APIs, external data, user input).
- No `any` in app code; avoid `@ts-ignore` unless documented. Generated code is the exception.
- Stable UI selectors for key controls (`data-testid`/IDs).
- No new dependencies or tooling changes without approval.
- File size guideline: aim to keep files under ~700 LOC; split/refactor when it improves clarity or testability. Exceptions: convex/scheduledDuels.ts, convex/weeklyGoals.ts, app/themes/hooks/useThemesController.ts.
- Reference DOCUMENTATION.md

## Testing
- Coverage bar: Thresholds at 70% for lines/branches/functions/statements.
- If behavior changes or a bug is fixed, add/update tests to reflect the intended behavior; refactors should not weaken tests.
- If a test becomes a false positive/negative or no longer validates intent, update it to assert the correct behavior.
- Prefer adding tests over loosening assertions.
- Never delete/disable tests just to get green; any test change requires a short rationale in handoff.

## Handoff
- Update docs when behavior changes (short note in existing docs).
- Gate before handoff: AI must run eslint (no lint errors), `npm run typecheck`, plus any existing tests before handing off; if any step cannot be run, state why and what is missing.
