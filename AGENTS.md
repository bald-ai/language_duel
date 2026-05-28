# AGENTS.md

This file defines the shared rules for AI coding work. Optimize for clarity and fast change, and build for your future AI self.

> **Note:** Project documentation lives at `docs/DOCUMENTATION.md` (not at the repo root).

## General
- When the user mentions a `.md` file by name (without a path), it is usually located inside the `Dev` folder. Look there first before asking for the path.
- Future-AI clarity: make intent obvious, keep logic easy to find, and add short comments only when the behavior is not self-evident.
- Feature-first organization: keep code with the feature unless it is truly shared.
- Consistent naming: use stable, descriptive names; avoid old/new/temp/v2/fixed; keep naming patterns uniform within a feature.
- Naming across the entire stack is non-negotiable. Product terms, route names, table names, API names, variables, tests, docs, and UI copy must describe the same concept the same way. Do not leave mismatched legacy names behind as "internal only" cleanup unless the user explicitly approves a temporary transition step.
- No fallback code. "Fallback" here means code that exists to paper over things that should be gone or enforced: support for old data shapes after a migration, compatibility branches for removed code paths, message/string matching against legacy error text, silent defaults that hide a broken contract, dual-path old/new behavior during a rename or refactor, or "just in case" branches with no real caller. When behavior depends on a contract, enforce the contract directly with clear validation or errors. This rule does NOT cover legitimate product behavior such as provider/service degradation chains (e.g. TTS provider A unavailable → fall back to provider B), graceful UI defaults for genuinely optional data (e.g. show "Someone" when a user has no display name fields), retries, or offline/empty-state UX. Those are product defaults, not fallbacks in this rule's sense, and are fine. If you accidentally stumble on existing fallback code (in the compat/legacy/just-in-case sense above) in the touched area, report it to the user and ask how to handle it instead of removing it on your own. Direct user instructions (including explicit plan steps that name the fallback to remove) count as approval and override this default — in that case just follow the instruction.
- Separation by layer: pages wire, components render UI, hooks orchestrate state, lib holds pure logic. Keep core rules testable without React.
- Name non-obvious or repeated numbers in `constants.ts`; trivial UI math can stay inline.
- Explicit input validation and clear errors at boundaries (APIs, external data, user input).
- No `any` in app code; avoid `@ts-ignore` unless documented. Generated code is the exception.
- Stable UI selectors for key controls (`data-testid`/IDs).
- No new dependencies or tooling changes without approval.
- File size guideline: aim to keep files under ~700 LOC; split/refactor when it improves clarity or testability.
- Production data exists from the maintainer and one other user (a few months of usage). Treat that data as **disposable** — it is not pristine and can be wiped. Always prefer cleaner schemas, required discriminators, and tighter contracts over migration code or "support old shape" fallbacks. There is no real user base to migrate.

## Testing
- Coverage bar: Thresholds at 70% for lines/branches/functions/statements.
- If behavior changes or a bug is fixed, add/update tests to reflect the intended behavior; refactors should not weaken tests.
- If a test becomes a false positive/negative or no longer validates intent, update it to assert the correct behavior.
- Prefer adding tests over loosening assertions.
- Never delete/disable tests just to get green; any test change requires a short rationale in handoff.
- Flag test-only code. If a helper, branch, constant, or whole file has no real caller in the running app and exists only to be exercised by tests (or kept alive with `void` suppressions, "for future use" comments, or "for parity" stubs), surface it to the user instead of shipping it. The rule mirrors "no fallback code" above — code with no real caller is dead code, regardless of whether a test touches it.

## Handoff
- Update docs when behavior changes (short note in existing docs).
- Gate before handoff: AI must run eslint (no lint errors), `npm run typecheck`, `npx tsc --noEmit -p convex/tsconfig.json` (Convex uses a stricter `lib: ES2021` config than the root tsconfig and rejects newer APIs like `Object.hasOwn`), plus any existing tests before handing off only when code or tests changed.
- For handoff validation, prefer `npm run test:run -- <test files>` or `npm run test:run` so Vitest runs once and exits. Do not use `npm test` for handoff validation unless the user explicitly wants watch mode.
- Do not run eslint, typecheck, or tests for documentation-only, prompt-only, content-only, or other non-code changes. In those cases, handoff should just state that validation was skipped because no code changed.
- Do not suggest manual testing in handoff unless the user explicitly asks for it.
- Do not assume the user wants tickets, branches, or pull requests. Default to the user's direct-to-main workflow unless they say otherwise.
