import { internalMutation } from "../_generated/server";

export const stampWeeklyGoalsMode = internalMutation({
  args: {},
  handler: async (ctx) => {
    const goals = await ctx.db.query("weeklyGoals").collect();
    let stampedCount = 0;

    for (const goal of goals) {
      if (goal.mode !== undefined) continue;
      await ctx.db.patch(goal._id, { mode: "shared" });
      stampedCount += 1;
    }

    return { stampedCount };
  },
});
