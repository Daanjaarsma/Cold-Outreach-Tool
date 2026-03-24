import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_verwijderd", (q) => q.eq("verwijderd", false))
      .order("desc")
      .collect();
  },
});

export const listBySector = query({
  args: { sector: v.string() },
  handler: async (ctx, { sector }) => {
    return await ctx.db
      .query("leads")
      .withIndex("by_sector", (q) => q.eq("sector", sector).eq("verwijderd", false))
      .order("desc")
      .collect();
  },
});

export const stats = query({
  args: {},
  handler: async (ctx) => {
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_verwijderd", (q) => q.eq("verwijderd", false))
      .collect();

    return {
      totaal: leads.length,
      metEmail: leads.filter((l) => l.email).length,
      benaderd: leads.filter((l) => l.status === "benaderd").length,
      geantwoord: leads.filter((l) => l.status === "geantwoord").length,
    };
  },
});

export const save = mutation({
  args: {
    bedrijfsnaam: v.string(),
    categorie: v.string(),
    subCategorie: v.optional(v.string()),
    stad: v.optional(v.string()),
    telefoon: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    reviewScore: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    bedrijfsgrootte: v.optional(v.string()),
    leadScore: v.number(),
    sector: v.string(),
    bron: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("leads", {
      ...args,
      status: "nieuw",
      aantalKeerBenaderd: 0,
      verwijderd: false,
    });
  },
});

export const saveBatch = mutation({
  args: {
    leads: v.array(
      v.object({
        bedrijfsnaam: v.string(),
        categorie: v.string(),
        subCategorie: v.optional(v.string()),
        stad: v.optional(v.string()),
        telefoon: v.optional(v.string()),
        email: v.optional(v.string()),
        website: v.optional(v.string()),
        reviewScore: v.optional(v.number()),
        reviewCount: v.optional(v.number()),
        bedrijfsgrootte: v.optional(v.string()),
        leadScore: v.number(),
        sector: v.string(),
        bron: v.string(),
      })
    ),
  },
  handler: async (ctx, { leads }) => {
    // Haal bestaande leads op voor deduplicatie
    const bestaande = await ctx.db
      .query("leads")
      .withIndex("by_verwijderd", (q) => q.eq("verwijderd", false))
      .collect();

    const bestaandeKeys = new Set<string>();
    for (const l of bestaande) {
      const naam = l.bedrijfsnaam.toLowerCase().trim();
      if (l.email) bestaandeKeys.add(`${naam}||${l.email.toLowerCase().trim()}`);
      if (l.stad) bestaandeKeys.add(`${naam}||stad:${l.stad.toLowerCase().trim()}`);
    }

    let nieuwe = 0;
    let overgeslagen = 0;

    for (const lead of leads) {
      const naam = lead.bedrijfsnaam.toLowerCase().trim();
      const emailKey = lead.email ? `${naam}||${lead.email.toLowerCase().trim()}` : null;
      const stadKey = lead.stad ? `${naam}||stad:${lead.stad.toLowerCase().trim()}` : null;

      if (
        (emailKey && bestaandeKeys.has(emailKey)) ||
        (!emailKey && stadKey && bestaandeKeys.has(stadKey))
      ) {
        overgeslagen++;
        continue;
      }

      if (emailKey) bestaandeKeys.add(emailKey);
      if (stadKey) bestaandeKeys.add(stadKey);

      await ctx.db.insert("leads", {
        ...lead,
        status: "nieuw",
        aantalKeerBenaderd: 0,
        verwijderd: false,
      });
      nieuwe++;
    }

    return { nieuwe, overgeslagen };
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("leads"),
    status: v.string(),
  },
  handler: async (ctx, { id, status }) => {
    await ctx.db.patch(id, { status });
  },
});

export const markBenaderd = mutation({
  args: { ids: v.array(v.id("leads")) },
  handler: async (ctx, { ids }) => {
    const now = Date.now();
    for (const id of ids) {
      const lead = await ctx.db.get(id);
      if (lead) {
        await ctx.db.patch(id, {
          status: "benaderd",
          laatstBenaderd: now,
          aantalKeerBenaderd: lead.aantalKeerBenaderd + 1,
        });
      }
    }
  },
});

export const updateNotities = mutation({
  args: {
    id: v.id("leads"),
    notities: v.string(),
  },
  handler: async (ctx, { id, notities }) => {
    await ctx.db.patch(id, { notities });
  },
});

export const softDelete = mutation({
  args: { id: v.id("leads") },
  handler: async (ctx, { id }) => {
    await ctx.db.patch(id, {
      verwijderd: true,
      verwijderdOp: Date.now(),
    });
  },
});
