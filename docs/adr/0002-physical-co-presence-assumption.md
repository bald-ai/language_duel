# ADR 0002: Designed for two physically co-located players

**Status:** Accepted
**Date:** 2026-05-14

## Context

Language Duel uses an online connection between two players' devices, which has historically led the team to design as if the two players were strangers communicating only through the app — adding things like in-app pings, consent prompts, hint request handshakes, and explanatory onboarding.

In practice, the intended player situation is two people sitting next to each other (couch co-op), each on their own device, who can talk to each other in real time. Designing as if they were remote strangers adds UI weight and erodes the casual, social feel of the product.

We needed to make this assumption explicit so it could be applied consistently across feature decisions.

## Decision

Language Duel is designed primarily for **two players physically together**, each on their own device. Online connection is the transport, not the experience.

Concrete implications applied across PvE design:

- No consent prompts before firing hints — players talk in person.
- No in-app "I need help" / request-hint button in PvE.
- No notifications or toasts when a hint is fired — the screen effect is the signal.
- No onboarding tutorial for hints — players discover them together.
- Mode label on invite/lobby is treated like any other duel setting — the creator already told the joiner verbally.

## Alternatives considered

- **Design for remote strangers as the default.** Rejected: would add coordination affordances most real users don't need, and would dilute the casual social feel that defines the product today.
- **Stay neutral / support both equally.** Rejected: forces every feature to ship two parallel UX paths, doubling design and code work without clear payoff.

## Consequences

- Fewer coordination UI elements across the app. Simpler screens, faster to build.
- New features should default to "trust that players can talk" before adding in-app coordination.
- If the product later targets remote play seriously (matchmaking with strangers, async play), many of these decisions would need to be revisited (consent, notifications, onboarding, possibly chat).
- The assumption itself is hard to reverse silently — many features will be designed around it, so a future pivot should be a deliberate, explicit re-decision.
