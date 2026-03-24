import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  leads: defineTable({
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
    sector: v.string(), // "e-commerce" | "recruitment"
    status: v.string(), // "nieuw" | "benaderd" | "geantwoord" | "consult_gepland" | "klant" | "afgewezen"
    notities: v.optional(v.string()),
    laatstBenaderd: v.optional(v.number()),
    aantalKeerBenaderd: v.number(),
    bron: v.string(), // "zoektool" | "csv-import" | "handmatig"
    verwijderd: v.boolean(),
    verwijderdOp: v.optional(v.number()),
  })
    .index("by_sector", ["sector", "verwijderd"])
    .index("by_status", ["status", "verwijderd"])
    .index("by_email", ["email"])
    .index("by_verwijderd", ["verwijderd"]),

  outreachLog: defineTable({
    leadId: v.id("leads"),
    emailVerzonden: v.boolean(),
    onderwerp: v.optional(v.string()),
    verzondOp: v.number(),
    type: v.string(), // "cold" | "followup"
    foutmelding: v.optional(v.string()),
    verwijderd: v.boolean(),
    verwijderdOp: v.optional(v.number()),
  })
    .index("by_lead", ["leadId"])
    .index("by_date", ["verzondOp"]),
});
