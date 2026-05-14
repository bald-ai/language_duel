# ADR 0001: PvE hints use a shared pool and affect both players

**Status:** Accepted
**Date:** 2026-05-14

## Context

PvE mode was originally specified as a "gift" system: the player who answered first could send a hint to the still-thinking partner. Hints belonged to the sender, the receiver could ping for help, and only the receiver was affected.

During design review we found this asymmetric model carried over a lot of friction from PvP (sender/receiver roles, request handshakes, an "I need help" button) and didn't fully commit to the cooperative tone PvE is supposed to set.

We needed to decide how hints are owned, who can fire them, and who they affect.

## Decision

PvE hints are drawn from a **shared pool jointly owned by both players**. When a hint is fired, it **affects both players** on the current question regardless of who clicked it or whether either has already answered.

Specifics:

- Pool is 1 use of each hint type per duel (4 total uses possible).
- Maximum 1 hint per question.
- Either player can fire any hint at any time during a question. No consent step.
- Universal +5s timer bump on every hint (in addition to the hint's main effect).
- No score penalty for using hints. The shared pool's scarcity is the only cost.
- The "I need help" / request-hint mechanic is removed in PvE.

## Alternatives considered

- **Original gift model** (per-player budget, sender → receiver). Rejected: kept too much PvP friction; asymmetric roles felt at odds with cooperation.
- **Per-player hint budget where the giver chooses who benefits.** Rejected: re-introduces the sender/receiver split.
- **Shared pool but each hint only helps one player at a time (chosen on fire).** Rejected: adds a decision step that breaks the "instant fire" feel and doesn't match the "we're a team" framing.
- **One-per-question only, no per-duel pool.** Rejected: makes hints feel infinite, removes the strategic "save it for a tougher one" decision.

## Consequences

- Cleaner cooperative identity for PvE. Both players are equally empowered; no roles.
- Lower UI complexity: one symmetric hint panel on both devices, no consent prompts, no pings.
- The "shared pool" becomes a piece of canonical vocabulary (see `CONTEXT.md`).
- Once players are used to "any hint = both benefit," reverting to a gift model would feel like a regression in cooperation. Practically hard to reverse.
- A player can in principle "burn" a team hint without their partner agreeing. Mitigated by the assumption that players are physically co-located and can talk first (see ADR 0002).
- Scoring is currently still inherited from PvP and may not fit a fully cooperative tone. Tracked as known design debt; intentionally not addressed here.
