# How to remove the "Online Mock Features" prototype

This prototype is self-contained. It was added to `main` in a single commit
(`a534896` — "Add online mock-feature prototypes with room-code PvP").

Nothing in your real game (duels, challenges, themes) depends on it. Removing
it is: **delete 4 things, revert 2 files, clear 1 database table.**

## Option A — easiest (if no other work landed on top)

If you haven't built anything else on top of this commit yet, just undo it:

```bash
git revert a534896      # creates a commit that removes everything below
```

Then do the database step (see "Database cleanup" at the bottom). Done.

## Option B — manual removal

### 1. Delete these folders/files (the whole prototype)
```bash
rm -rf app/mock-online
rm -rf lib/mockOnline
rm -rf tests/lib/mockOnline
rm convex/prototypeRooms.ts
```

### 2. Revert the one home-menu entry point
In `app/HomePageClient.tsx`, delete two small blocks:
- the `OnlineMockIcon` component (the `<svg>` with a globe)
- the `MenuButton` with `dataTestId="home-online-mock-features"`

### 3. Revert the database schema
In `convex/schema.ts`, delete two things:
- the import line: `import { ... } from "../lib/mockOnline/state";`
- the whole `prototypeRooms: defineTable({ ... })` block (it has a comment
  above it saying it's safe to drop)

> ⚠️ Order matters: if you delete `lib/mockOnline/` but forget this schema
> step, the leftover import breaks your **entire Convex backend**, not just the
> prototype. Always do step 3 together with step 1.

### 4. Regenerate Convex types
```bash
npx convex codegen
```

## Database cleanup (required either way)

Once anyone has actually used the prototype, real rows live in your Convex
database in the `prototypeRooms` table. After removing the table from the
schema, clear that data on your deployment so Convex doesn't complain:

- Open the Convex dashboard → your deployment → Data → `prototypeRooms` table
- Delete all rows (or drop the table)

That's the only step that isn't just code.

## Verify it's fully gone
```bash
npm run typecheck
git grep -nE "mockOnline|mock-online|prototypeRooms"   # should return nothing
```
