# Prod Deployment TODO

## 1. Deploy code first
```bash
npx convex deploy
```

## 2. Run scheduled duel status migration
Reclassifies old "declined" rows that were actually cancellations or expirations.
```bash
npx convex run scheduledDuels:migrateDeclinedStatuses '{}' --prod
```
**After confirming it ran successfully, delete `migrateDeclinedStatuses` from `convex/scheduledDuels.ts`.**

## 3. Weekly goals — no code changes were made
The cleanup setup was reviewed and deemed solid (no changes needed).
If the new schema deploy throws validation errors on existing weekly goal rows, it means
some rows have field values that don't match the updated schema. In that case:
- Check the Convex dashboard logs for the specific validation error
- Write a similar one-time migration in `convex/weeklyGoals.ts` to patch the offending rows
- The most likely issue would be stale `status` values or missing required fields on old rows

## Cleanup after migrations
- [ ] Delete `migrateDeclinedStatuses` from `convex/scheduledDuels.ts`
- [ ] Redeploy to remove the migration function from prod
