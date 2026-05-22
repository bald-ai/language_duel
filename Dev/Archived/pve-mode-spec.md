# PvE Mode — Feature Spec

## Purpose

This spec describes a **full redesign of duel modes**, splitting the experience into two clearly distinct modes: the existing **PvP (competitive, sabotage-driven)** mode, and a new **PvE (cooperative, hint-driven)** mode.

Today the duel mixes competitive and cooperative ideas in one experience (sabotages plus an existing "I need help" hint handshake). That blend feels muddy. The goal here is a cleaner separation — PvP leans fully into competition, PvE leans fully into collaboration — so we can see how each mode feels on its own and which one players gravitate to.

PvE is not a small add-on to PvP. It is a parallel mode with its own tools, its own pacing, and its own emotional tone (space and support, not pressure and chaos).

## Foundational assumption

The app is designed primarily for **two players physically together** (couch co-op), each on their own device. Online connection is the transport, not the experience. This drives the absence of in-app coordination affordances in PvE: no consent prompts, no notifications, no chat, no "I need help" ping, no onboarding tutorial — players can simply talk to each other.

See `docs/adr/0002-physical-co-presence-assumption.md`.

## Overview

Add a **PvE (cooperative) mode** to duels as an alternative to the existing PvP (sabotage) mode. In PvE, players draw from a **shared hint pool** that helps both of them on the current question — turning the duel into a collaborative learning experience.

## Goals

- Offer players a non-competitive duel experience focused on learning together
- Encourage cooperation through a shared, scarce resource
- Buy players more "brain-cracking" think time when stuck, since struggling-then-recalling is when learning sticks
- Reuse the duel structure, scoring, and difficulty system already in place

## Mode Selection

- When creating a duel, the creator picks between **PvP** and **PvE** via two buttons in the creator window, placed under the difficulty section.
- **PvP** = existing behavior with sabotages.
- **PvE** = new behavior with hints. Sabotage UI and mechanics are hidden.
- The mode is shown to the joiner as a normal duel setting (same treatment as theme/difficulty) — no special prominence, no consent step. The creator and joiner are physically co-located and have already discussed the mode.
- Mode is set at creation and cannot change during the duel.
- If the joiner doesn't want the chosen mode, they use the existing decline-to-join flow. No new mechanic.

## Difficulty Tuning

Medium difficulty changes to give more decoys and create a clearer difficulty curve:

- **Easy:** 1 correct + 3 wrong = 4 options (unchanged)
- **Medium:** 1 correct + **5 wrong** = 6 options (was 1 + 4)
- **Hard:** 1 correct + 4 wrong = 5 options, with "None of the above" mechanic (unchanged)

This change applies to **both PvP and PvE** modes — it's a general improvement, not PvE-specific. Applies to all new duels at launch; no migration needed since no active duels will be running at rollout.

## Hint System (PvE Only)

### Core Rules

- **Shared pool.** Hints are a single shared resource owned jointly by both players, not gifts from one to the other.
- **One of each type per duel.** The pool contains 1 use of each of the 4 hint types — 4 total uses possible per duel.
- **One per question.** Maximum 1 hint may be fired per question.
- **Either player, anytime, no consent.** Either player can fire any available hint at any point during a question. No "must have answered first" gate, no confirmation prompt.
- **Affects both players.** When a hint is fired, the effect applies to both players regardless of whether either has already answered. If a player has already locked their answer, the hint shows on their screen for awareness but cannot change their committed answer.
- **Universal +5s.** Every hint adds +5 seconds to both players' question timers in addition to its main effect. (Players typically fire hints after already burning think-time, so the timing can be tight.)
- **No score penalty.** Using hints does not reduce points. Pool scarcity is the only cost.
- **No "I need help" button.** The old request-hint mechanic is removed in PvE.

### The Four Hints

1. **50/50**
   - Removes wrong answers down to: correct + 1 wrong.
   - Easy: removes 2; Medium: removes 3; Hard: removes 3.
   - Plus the universal +5s.

2. **+10 Seconds**
   - Adds extra time to both players' question timers. Combined with the universal +5s bump, total effect is **+15s**.

3. **Anagram**
   - Shows the correct answer's letters scrambled, displayed directly under the question text on both players' screens.
   - Plus the universal +5s.

4. **Letter Count**
   - Shows the number of letters in the correct answer, displayed directly under the question text on both players' screens.
   - Plus the universal +5s.

### Hint Panel

- Lives in the **same UI slot** the PvP sabotage panel uses today. Sabotage buttons are simply replaced by hint buttons in PvE.
- **Symmetric** — both players see the identical panel on their own device, with the same remaining-uses state. Either can fire from their own screen.
- **Synced** — when one player fires a hint, the other's panel updates immediately (used hint greys out for both).
- **Silent feedback** — no toast, no notification, no animation. The on-screen effect (options vanishing, timer bumping, anagram appearing) is the only signal that a hint fired.
- **No onboarding** — discoverable through play. Two physically present players will figure it out together.

### Hint vs. Sabotage Symmetry

| | PvP (Sabotage) | PvE (Hint) |
|---|---|---|
| Direction | Hurt opponent | Help both players |
| Trigger | Available after answering (per existing rules) | Available any time, by either player |
| Limit | Per-duel sabotage budget | 1 of each type per duel + max 1 per question |
| Feel | Pressure & chaos | Space & support |

## What Stays the Same

- Duel creation flow (theme, difficulty preset, timer, etc.) — just adds the mode toggle.
- Question structure, scoring per difficulty, win conditions, end-of-duel screen.
- Underlying duel session lifecycle.
- The 21-second base question timer.

## What's Out of Scope

- Reusing hints from PvE in other game modes (solo, etc.).
- Persistent hint stats or leaderboards.
- Mid-duel mode switching.
- Edge-case handling for a hint fired at the exact moment a question times out — noted for future, not addressed in v1.
- Score-system rework for PvE (see "Known Design Debt" below).

## Known Design Debt

- **Scoring is currently identical to PvP** — individual scores plus a declared winner. The competitive framing may not fit PvE's cooperative tone. Intentionally deferred; revisit after playtesting.

## Success Looks Like

- Players who want a chill, learning-focused experience pick PvE and use hints freely.
- The 4-hint shared pool with a 1-per-question cap creates real "is this question worth our hint?" decisions.
- The +5s universal bump (and +15s on the time hint) makes hints feel generous and worthwhile.
- Partners feel like teammates, not opponents.

## Artifacts

All files produced by or directly tied to this feature's design phase.

### Spec & domain

- `Dev/pve-mode-spec.md` — this document. Working spec. Local-only (Dev/ is gitignored).
- `CONTEXT.md` — canonical glossary (Duel, Mode, PvP/PvE, Hint, Sabotage, Shared Hint Pool, Physical Co-presence). Committed.

### Architecture decisions

- `docs/adr/0001-shared-hint-pool-affecting-both-players.md` — why hints became a shared pool that affects both players (instead of a gift from one to the other). Committed.
- `docs/adr/0002-physical-co-presence-assumption.md` — why the app assumes the two players sit together, and what that lets us cut (consent prompts, notifications, onboarding). Committed.

### Status & reporting

- `tmp/pve-status.html` — single-page status snapshot of the feature (decisions locked, ADRs, commits, what shipped, progress chart, up-next list, deferred items). Styled after the "Weekly status" pattern from <https://thariqs.github.io/html-effectiveness/>. Local-only (tmp/ is gitignored); regenerate when status changes.

### Handoffs

- `handoff-s9SDGx.md` (system temp dir) — handoff from the design session that produced this spec and the two ADRs.

### Commits on `main`

- `27e3905` — Add `CONTEXT.md` and ADRs 0001 + 0002 for PvE mode design.
- `1aa2952` — Clarify the no-fallback-code rule in `AGENTS.md` (incidental cleanup committed in the same session).
