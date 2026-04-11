import { internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { loadThemesByIds } from "./helpers/sessionWords";
import { buildSessionWords } from "../lib/sessionWords";

export const backfillChallengeSessionWords = internalMutation({
  args: {},
  handler: async (ctx) => {
    const challenges = await ctx.db.query("challenges").collect();
    let updatedChallenges = 0;

    for (const challenge of challenges) {
      const legacyThemeId = (challenge as { themeId?: Id<"themes"> }).themeId;
      const themeIds = challenge.themeIds.length > 0 ? challenge.themeIds : legacyThemeId ? [legacyThemeId] : [];
      const needsThemeIds = challenge.themeIds.length === 0 && themeIds.length > 0;
      const needsSessionWords = (!challenge.sessionWords || challenge.sessionWords.length === 0) && themeIds.length > 0;

      if (!needsThemeIds && !needsSessionWords) continue;

      const themes = await loadThemesByIds(ctx, themeIds);
      const sessionWords = buildSessionWords(themes);

      await ctx.db.patch(challenge._id, {
        ...(needsThemeIds ? { themeIds } : {}),
        ...(needsSessionWords ? { sessionWords } : {}),
      });
      updatedChallenges += 1;
    }

    const scheduledDuels = await ctx.db.query("scheduledDuels").collect();
    let updatedScheduledDuels = 0;

    for (const scheduledDuel of scheduledDuels) {
      const legacyThemeId = (scheduledDuel as { themeId?: Id<"themes"> }).themeId;
      const themeIds = scheduledDuel.themeIds.length > 0 ? scheduledDuel.themeIds : legacyThemeId ? [legacyThemeId] : [];
      if (scheduledDuel.themeIds.length > 0 || themeIds.length === 0) continue;

      await ctx.db.patch(scheduledDuel._id, { themeIds });
      updatedScheduledDuels += 1;
    }

    return {
      updatedChallenges,
      updatedScheduledDuels,
    };
  },
});
