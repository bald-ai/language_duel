# Sentence Theme Debt

Notes from the emergency production fix to get sentence themes saving.

## Technical debt

- Production Convex was still running an old `themes:createTheme` signature that required `words`, so generated sentence themes failed even though local code had the newer `contentType: "sentence"` / `sentenceRounds` path.
- Production deployment was blocked by old data that did not match the stricter discriminated schemas:
  - `duels.duelQuestions[]` missing `kind: "word"`.
  - `duels.sessionWords[]` missing `kind: "word"`.
  - `themes` missing `contentType: "word"`.
- I temporarily loosened Convex validators in `convex/schema.ts` to allow old production rows through deployment, patched production data, then restored strict validators and redeployed.
- This was a manual data patch using exported JSON + `convex import --prod --replace`; there is no repeatable migration script committed.
- Dev data and production data had similar schema drift, which means future schema tightening can fail deploys unless old rows are patched first.

## Product / process debt

- Sentence theme save was marked fixed before verifying the actual production mutation path from the app.
- Validation was too local-focused: tests/typecheck/lint passed, but the live production Convex validator was not checked.
- Handoff should include an end-to-end check for the exact user-facing action when the bug is in a deployed backend contract.

## Later cleanup to consider

- Add a proper one-off migration or admin utility for discriminator backfills instead of manual JSON imports.
- Add a pre-deploy checklist for Convex schema changes that checks production data compatibility before deployment.
- Add a cheap production-safe validator probe for important mutations, especially when adding required fields or discriminators.
- Consider a test or CI guard that catches generated Convex mutation signatures drifting from the deployed app expectation.
