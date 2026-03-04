import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getSettings = query({
  handler: async (ctx) => {
    const record = await ctx.db.query("settings").first();
    if (!record) return null;
    return record;
  },
});

export const getSettingByKey = query({
  args: {
    key: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query('settings')
      .withIndex('by_key', (q: any) => q.eq('key', args.key))
      .first();
    if (!record) return null;
    return record;
  },
});

export const setSettings = mutation({
  args: {
    key: v.string(),
    value: v.any(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q: any) => q.eq("key", args.key))
      .first();

    const payload = { key: args.key, value: args.value, updatedAt: Date.now() };
    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("settings", payload);
    }
    return { success: true };
  },
});
