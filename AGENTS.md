# AGENTS.md

This file defines the shared rules for AI coding work. Optimize for clarity and fast change, and build for your future AI self.

> **Note:** Project documentation lives at `docs/DOCUMENTATION.md` (not at the repo root).

## General
- When the user mentions a `.md` file by name (without a path), it is usually located inside the `Dev` folder. Look there first before asking for the path.
- Future-AI clarity: make intent obvious, keep logic easy to find, and add short comments only when the behavior is not self-evident.
- Feature-first organization: keep code with the feature unless it is truly shared.
- Consistent naming: use stable, descriptive names; avoid old/new/temp/v2/fixed; keep naming patterns uniform within a feature.
- Naming across the entire stack is non-negotiable. Product terms, route names, table names, API names, variables, tests, docs, and UI copy must describe the same concept the same way. Do not leave mismatched legacy names behind as "internal only" cleanup unless the user explicitly approves a temporary transition step.
- No fallback code. "Fallback" here means code that exists to paper over things that should be gone or enforced: support for old data shapes after a migration, compatibility branches for removed code paths, message/string matching against legacy error text, silent defaults that hide a broken contract, dual-path old/new behavior during a rename or refactor, or "just in case" branches with no real caller. When behavior depends on a contract, enforce the contract directly with clear validation or errors. This rule does NOT cover legitimate product behavior such as provider/service degradation chains (e.g. TTS provider A unavailable → fall back to provider B), graceful UI defaults for genuinely optional data (e.g. show "Someone" when a user has no display name fields), retries, or offline/empty-state UX. Those are product defaults, not fallbacks in this rule's sense, and are fine. When you encounter existing compatibility, legacy, or just-in-case fallback code in the touched area, verify the current contract and callers, then remove confirmed obsolete paths without asking for approval. Update affected callers and test fixtures to satisfy the current contract, and summarize the removal in the handoff. Preserve legitimate product behavior described above.
- Separation by layer: pages wire, components render UI, hooks orchestrate state, lib holds pure logic. Keep core rules testable without React.
- Name non-obvious or repeated numbers in `constants.ts`; trivial UI math can stay inline.
- Explicit input validation and clear errors at boundaries (APIs, external data, user input).
- No `any` in app code; avoid `@ts-ignore` unless documented. Generated code is the exception.
- Stable UI selectors for key controls (`data-testid`/IDs).
- No new dependencies or tooling changes without approval.
- File size guideline: aim to keep files under ~700 LOC; split/refactor when it improves clarity or testability.
- Production data exists from the maintainer and one other user (a few months of usage). Treat that data as **disposable** — it is not pristine and can be wiped. Always prefer cleaner schemas, required discriminators, and tighter contracts over migration code or "support old shape" fallbacks. There is no real user base to migrate.

## Testing
- When coverage is explicitly requested, retain the existing 70% thresholds for lines/branches/functions/statements. Coverage is not a routine handoff gate.
- If behavior changes or a bug is fixed, add/update tests to reflect the intended behavior; refactors should not weaken tests.
- If a test becomes a false positive/negative or no longer validates intent, update it to assert the correct behavior.
- Prefer adding tests over loosening assertions.
- Never delete/disable tests just to get green; any test change requires a short rationale in handoff.
- Flag test-only code. If a helper, branch, constant, or whole file has no real caller in the running app and exists only to be exercised by tests (or kept alive with `void` suppressions, "for future use" comments, or "for parity" stubs), surface it to the user instead of shipping it. The rule mirrors "no fallback code" above — code with no real caller is dead code, regardless of whether a test touches it.

## Handoff
- Update docs when behavior changes (short note in existing docs).
- Gate before handoff: AI must run eslint (no lint errors), `npm run typecheck`, `npx tsc --noEmit -p convex/tsconfig.json` (Convex uses a stricter `lib: ES2021` config than the root tsconfig and rejects newer APIs like `Object.hasOwn`), plus any existing tests before handing off only when code or tests changed.
- For final handoff validation, run the full suite with `npm run test:run` so Vitest runs once and exits. Focused runs with `npm run test:run -- <test files>` are optional during implementation. Do not use `npm test` for handoff validation unless the user explicitly wants watch mode.
- Do not run eslint, typecheck, or tests for documentation-only, prompt-only, content-only, or other non-code changes. In those cases, handoff should just state that validation was skipped because no code changed.
- Do not suggest manual testing in handoff unless the user explicitly asks for it.
- Do not assume the user wants tickets, branches, or pull requests. Default to the user's direct-to-main workflow unless they say otherwise.

## Verification preferences

- For new features and behavior changes, add or update meaningful tests using the project's existing test framework, fixtures, helpers, and conventions. Inspect nearby tests first. Bug fixes should include a regression test where practical. Do not weaken assertions or disable tests merely to make a run pass.
- After the final code change, run the full ordinary automated test suite before handoff. Project commands: `npm run test:run` (the full suite in one-shot mode; `npm test` starts watch mode). Fix failures caused by the change and rerun after fixes. Clearly report unrelated failures, unavailable toolchains, blockers, and skipped checks; do not claim the suite passed when it did not. Existing lint, typecheck, and build requirements still apply.
- Intermediate focused test runs are optional when useful for implementation or debugging. There is no requirement to run tests after every edit.
- Coverage, code metrics (including complexity and CRAP), and mutation testing are manual-only. Run them only when the user explicitly requests the corresponding check. Never include them in routine coding checks, pre-handoff checks, or automatic CI, including for critical behavior changes. A combined quality command that collects metrics or runs mutations is also manual-only; use the ordinary test commands instead.
- Do not generate or retain verification report files, evidence bundles, saved test logs, or source snapshots. Print verification results to the terminal. Disable optional file reporters; if tooling requires temporary internal data, use temporary storage and clean up data created by that run after success or failure. This is not permission to delete unrelated existing files or user-requested deliverables.
- Documentation-only changes do not require app tests unless they affect build/test instructions or an existing project rule explicitly requires documentation consistency tests.
- Ordinary local tests do not authorize device interaction, deployment, paid service calls, or live model benchmarks. Keep those within the user's explicit scope and report excluded checks.

- When changing verification tooling, also run its ordinary regression tests: `PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s scripts -p test_verification_session.py`. These tests simulate subprocess outcomes and do not run coverage, code metrics, or mutations.
