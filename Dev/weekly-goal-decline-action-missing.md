# Weekly Goal Decline Action Missing

**Date identified:** 2026-02-03

**Context:** Discovered during email notifications implementation prep. The plan includes a "weekly goal declined" email trigger, but no explicit decline mutation exists.

## The Problem

Weekly goals have no explicit decline action. When User A invites User B to a weekly goal:
- User B can open the goal and add or remove themes during the editing phase
- User B can lock the goal, which acts like accept
- User B can delete the goal while it is unlocked
- But there is no "decline" button that notifies User A

Currently, if User B does not want to participate, they can only ignore or delete the goal, and User A gets no notification.

## Impact on Email Notifications

Email trigger #10, "weekly goal invite declined", cannot be implemented without this mutation.

## Options

1. **Add explicit decline mutation**: Create a notification for User A and delete the goal
2. **Skip this email trigger**: Document that decline means silent ignore or delete
3. **Repurpose delete as decline**: Treat `deleteGoal` as implicit decline and send an email to the partner

## Status

Parked for later. Email notifications can proceed for now without this trigger.
