import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const logOutreach = internalMutation({
  args: {
    email: v.string(),
    onderwerp: v.optional(v.string()),
    verzondOp: v.number(),
    emailVerzonden: v.boolean(),
    type: v.string(),
    foutmelding: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Zoek lead op basis van email
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect();

    const lead = leads.find((l) => !l.verwijderd) ?? null;

    if (lead) {
      // Log de outreach
      await ctx.db.insert("outreachLog", {
        leadId: lead._id,
        emailVerzonden: args.emailVerzonden,
        onderwerp: args.onderwerp,
        verzondOp: args.verzondOp,
        type: args.type,
        foutmelding: args.foutmelding,
        verwijderd: false,
      });

      // Update lead status
      await ctx.db.patch(lead._id, {
        status: "benaderd",
        laatstBenaderd: Date.now(),
        aantalKeerBenaderd: lead.aantalKeerBenaderd + 1,
      });
    }

    return { leadFound: !!lead };
  },
});

export const checkContacted = internalQuery({
  args: {
    emails: v.array(v.string()),
  },
  handler: async (ctx, { emails }) => {
    const results: string[] = [];

    for (const email of emails) {
      const leads = await ctx.db
        .query("leads")
        .withIndex("by_email", (q) => q.eq("email", email))
        .collect();

      const found = leads.find((l) => !l.verwijderd && l.status !== "nieuw");
      if (found) results.push(email);
    }

    return results;
  },
});
