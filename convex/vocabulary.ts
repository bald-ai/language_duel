import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getVocabulary = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("vocabulary").collect();
  },
});

export const getVocabularyByCategory = query({
  args: { category: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("vocabulary")
      .filter((q) => q.eq(q.field("category"), args.category))
      .collect();
  },
});

export const addVocabulary = mutation({
  args: {
    spanish: v.string(),
    english: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("vocabulary", args);
  },
});

export const seedBathroomVocabulary = mutation({
  args: {},
  handler: async (ctx) => {
    const bathroomVocabulary = [
      { spanish: "el champú", english: "shampoo", category: "bathroom" },
      { spanish: "el jabón", english: "soap", category: "bathroom" },
      { spanish: "la toalla", english: "towel", category: "bathroom" },
      { spanish: "el espejo", english: "mirror", category: "bathroom" },
      { spanish: "la ducha", english: "shower", category: "bathroom" },
      { spanish: "la bañera", english: "bathtub", category: "bathroom" },
      { spanish: "el cepillo de dientes", english: "toothbrush", category: "bathroom" },
      { spanish: "la pasta de dientes", english: "toothpaste", category: "bathroom" },
      { spanish: "el peine", english: "comb", category: "bathroom" },
      { spanish: "el secador", english: "hair dryer", category: "bathroom" },
      { spanish: "el papel higiénico", english: "toilet paper", category: "bathroom" },
      { spanish: "el grifo", english: "faucet/tap", category: "bathroom" },
      { spanish: "la esponja", english: "sponge", category: "bathroom" },
      { spanish: "el desodorante", english: "deodorant", category: "bathroom" },
      { spanish: "la afeitadora", english: "razor", category: "bathroom" },
      { spanish: "el maquillaje", english: "makeup", category: "bathroom" },
      { spanish: "el enjuague bucal", english: "mouthwash", category: "bathroom" },
      { spanish: "las pinzas", english: "tweezers", category: "bathroom" },
      { spanish: "el algodón", english: "cotton (cotton pads)", category: "bathroom" },
      { spanish: "la crema", english: "cream/lotion", category: "bathroom" },
    ];

    const insertedIds = [];
    for (const vocab of bathroomVocabulary) {
      const existing = await ctx.db
        .query("vocabulary")
        .withIndex("by_spanish", (q) => q.eq("spanish", vocab.spanish))
        .first();

      if (!existing) {
        const id = await ctx.db.insert("vocabulary", vocab);
        insertedIds.push(id);
      }
    }

    return insertedIds;
  },
});
