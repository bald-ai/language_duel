# Language Duel — Roadmap

## Context

The app has been used with a real user (GF) who learns languages as a hobby. Key findings from actual usage:

- **Online duels split opinion** — GF enjoyed them; for the other player they felt too short to get into, like a rude interruption. The fun of in-person play (pausing, discussing, trash-talking) is missing online, but the duel mechanic itself is liked.
- **In-person duels are where the magic is** — the social interaction around the game is what makes it fun. GF still rated the duel as her favourite feature overall.
- **Word-only content gets repetitive** — after ~100 words the experience feels too samey. GF specifically requested sentences.
- **No reason to come back** — nothing pulls you to reopen the app the next day. Weekly goals exist but were never actually used.
- **The app alone isn't enough to learn a language** — it works best as a supplement to other learning, not a standalone tool.
- **Cold-start problem kills online multiplayer** — no player base to match with on a fresh app. The viable model is local co-op: bring your own buddy.

These findings shape the three phases below.

---

## Phase 1 — Make It Worth Opening Again

**Goal:** Fix the core engagement problem before testing anything else.

**Why:** Phase 1 already happened once and failed — we used the app, it got boring, we stopped. Re-running the same test won't produce a different result. The app needs more variety before another honest test is worth running.

### What to build

- **Sentences** — Add sentence-based exercises alongside word-based ones (fill the blank, translate the phrase, listen and pick meaning). This is the #1 piece of direct user feedback.
- **Weekly Boss Round** — A Sunday showdown that combines all themes learned that week into one big duel. Gives the week a climax to aim for and a reason to actually learn during the week.

### What we're testing

- Does content variety (sentences vs. just words) make daily usage feel less repetitive?
- Does a weekly event (boss round) create enough pull to keep both players engaged through the week?
- Do we actually open the app for a full week this time?

---

## Phase 2 — Supplement, Don't Replace

**Goal:** Explore making Language Duel an extension of existing learning material rather than a standalone app.

**Why:** GF's insight — the app alone isn't enough to learn a language. People already use Duolingo, take classes, watch content in target languages. The question isn't "how do we compete with that?" but "how do we plug into it?" Similar to how Take Take Take (chess app) partnered with Lichess instead of building their own play zone — they focused on their unique value (content, UX, AI analysis) and built on top of existing infrastructure.

### What to explore

- How do we take what someone is already learning (from Duolingo, a class, a textbook) and turn it into duel/co-op material?
- Can themes be auto-generated or imported from external sources?
- What's the "Lichess" of language learning we could build on top of? (Anki decks, open word lists, Duolingo vocabulary)

### What we're testing

- Does using real study material (words/sentences you're actually learning elsewhere) make the app feel more useful than random AI-generated themes?
- Does the app feel like a natural part of someone's learning routine rather than a separate thing to remember?

---

## Phase 3 — Co-op Mini-Games

**Goal:** Experiment with making vocabulary knowledge a game mechanic, not homework.

**Why:** Inspired by "It Takes Two" — specifically the asymmetric co-op mini-game where one player stands on a grid with animal faces and the other slides on a rail, needing the first player to step on matching pictures to clear obstacles. The idea: what if translation speed is your partner's superpower? You translate fast → their obstacle clears. You're slow → they crash.

This shifts the app from "quiz each other" to "play together where language skill IS the gameplay." That's a fundamentally different experience and could be the real differentiator.

### What to explore

- Asymmetric co-op: one player has an action/arcade challenge, the other has the language challenge, and they depend on each other.
- Different mini-game formats that use vocabulary as a mechanic (not just as quiz content).
- Shared-screen / same-device play since in-person is where the fun lives.

### What we're testing

- Is the co-op game format genuinely more fun than the current duel format?
- Does the urgency of helping your partner create better motivation to learn words than self-improvement alone?
- Can this work on a single phone screen, or does it need two devices side by side?
