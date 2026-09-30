# Convex reset and compatibility cleanup

The maintainer authorized a full development and production reset on 2026-09-30
to finish the cleanup described in `Dev/refactor_compat_fallbacks.md`. Convex access
was restored on this Mac from the project handoff archive.

## Deployment targets

| Environment | Deployment | URL |
| --- | --- | --- |
| Development | `adorable-seahorse-643` | https://adorable-seahorse-643.convex.cloud |
| Production | `acoustic-bat-777` | https://acoustic-bat-777.convex.cloud |

Both deployments belong to team `baldai`, project `language-duel`. The local
`.env.local` selects development; `npx convex deploy --yes` selects production.
The existing server environment variables and Clerk issuer configuration remain
configured on each deployment.

## Required stored data

- Users always have a nickname, both credit balances, and a credit month. Monthly
  refill checks only the month; it does not repair missing credit fields.
- Every theme has an owner and visibility. Word themes and word snapshots have a
  word category. Word and sentence content are narrowed before their arrays are
  read or duplicated.
- Challenges and duels store the difficulty preset, and duels store their
  question array. Optional creation arguments still receive their intended
  defaults before insertion.
- Notifications require a payload matching their type. Weekly goal invitations
  require an event; draft-expiry notifications have a separate payload shape.
- Relay readers assert the relay state. Completed goals require a completion
  timestamp when read or advanced, and pending repetitions require a due time.
- Loaded notification preferences are read directly; missing rows still use
  defaults and partial updates still pass through input normalization.

True optional gameplay state, draft inputs, loading state, permissions, and
viewer-safe answer masks retain their existing behavior.

## Reset and live checks

Both deployments were reset using an empty snapshot with `convex import
--replace-all --yes` (and `--prod` for production). File storage was cleared and
scheduled work was checked for cancellation. Internal maintenance functions were
used only during the reset and removed from the final backend deployment.

Each environment passed 80 live function calls using two disposable
administrative test identities. The checks covered:

- Fresh-user creation, required profiles and credit balances, credit consumption
  and refund, default notification preferences and stored preference reads.
- Word and sentence theme creation and duplication, including optional create
  defaults and required metadata.
- Friend requests and acceptance, and typed invitation notifications.
- PvP and PvE word duel creation, answer masking, answering and completion.
- Relay hard upgrades, budgets, answer masking, feedback and completion, plus
  relay and tag-team sentence board completion.
- Solo goal locking and word/sentence snapshots, both solo bosses, completion
  timestamps, repetition board due times and launch preview.
- Shared goal invitations, both participant locks, snapshots, and boss challenge
  acceptance.

Email preferences were disabled for test identities before invitations were
created. The scheduled jobs observed after the checks were successful or
canceled; none were failed or still pending. All test data was removed afterward.
An audit found zero documents in all 14 application tables and zero stored files
in each environment.

## Verification and release

`npm run verify` covers lint, application TypeScript, Convex TypeScript, 2,649
Vitest tests across 270 files, and 10 Python tooling tests. The production Next.js
build was also checked with the existing public Clerk publishable configuration.
Frontend publication uses the repository's automatic Netlify deployment from
`main`.

The live backend checks use administrative identity injection rather than real
Clerk browser sign-in. They do not exercise paid AI generation, TTS generation,
or actual email delivery. Local Convex access is configured; running those
frontend provider integrations locally still requires their frontend environment
variables, which were not present in the Convex handoff archive.
