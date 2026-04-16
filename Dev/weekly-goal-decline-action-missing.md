# Weekly Goal Decline Action

**Date identified:** 2026-02-03  
**Status:** Resolved.

## Original gap

Weekly goal invites had no explicit **decline** path that notified the inviter; partners could only ignore or delete the goal.

## Current behavior

- **`declineWeeklyPlanInvitation`** in `convex/weeklyGoals.ts` — invited user declines during editing; records a `weekly_goal_declined` notification event for email/notification pipelines.
- Tests: `tests/convex/weeklyGoals.declineInvitation.test.ts`.

Email trigger #10 (“weekly goal invite declined”) can use this mutation as its source of truth.
