import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const log = mutation({
  args: {
    leadId: v.id("leads"),
    emailVerzonden: v.boolean(),
    onderwerp: v.optional(v.string()),
    type: v.string(),
    foutmelding: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("outreachLog", {
      ...args,
      verzondOp: Date.now(),
      verwijderd: false,
    });
  },
});

export const listByLead = query({
  args: { leadId: v.id("leads") },
  handler: async (ctx, { leadId }) => {
    return await ctx.db
      .query("outreachLog")
      .withIndex("by_lead", (q) => q.eq("leadId", leadId))
      .order("desc")
      .collect();
  },
});

export const listRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const results = await ctx.db
      .query("outreachLog")
      .withIndex("by_date")
      .order("desc")
      .take(limit ?? 20);
    return results;
  },
});
