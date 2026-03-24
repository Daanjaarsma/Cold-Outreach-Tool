import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";

const http = httpRouter();

// POST /logOutreach — Aangeroepen door n8n na het versturen van een email
http.route({
  path: "/logOutreach",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { email, bedrijfsnaam, onderwerp, verzondOp, emailVerzonden, type, foutmelding } = body;

    // Zoek de lead op basis van email
    const lead = await ctx.runQuery(
      // @ts-expect-error internal query
      async (ctx: any) => {
        const leads = await ctx.db
          .query("leads")
          .withIndex("by_email", (q: any) => q.eq("email", email))
          .collect();
        return leads.find((l: any) => !l.verwijderd) ?? null;
      }
    );

    if (lead) {
      await ctx.runMutation(
        // @ts-expect-error internal mutation
        async (ctx: any) => {
          await ctx.db.insert("outreachLog", {
            leadId: lead._id,
            emailVerzonden: emailVerzonden ?? true,
            onderwerp: onderwerp ?? null,
            verzondOp: verzondOp ?? Date.now(),
            type: type ?? "cold",
            foutmelding: foutmelding ?? null,
            verwijderd: false,
          });

          // Update lead status
          await ctx.db.patch(lead._id, {
            status: "benaderd",
            laatstBenaderd: Date.now(),
            aantalKeerBenaderd: lead.aantalKeerBenaderd + 1,
          });
        }
      );
    }

    return new Response(JSON.stringify({ success: true, leadFound: !!lead }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }),
});

// POST /checkContacted — Check of leads al benaderd zijn
http.route({
  path: "/checkContacted",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const { emails } = await request.json();

    const contacted = await ctx.runQuery(
      // @ts-expect-error internal query
      async (ctx: any) => {
        const results: string[] = [];
        for (const email of emails) {
          const leads = await ctx.db
            .query("leads")
            .withIndex("by_email", (q: any) => q.eq("email", email))
            .collect();
          const found = leads.find((l: any) => !l.verwijderd && l.status !== "nieuw");
          if (found) results.push(email);
        }
        return results;
      }
    );

    return new Response(JSON.stringify({ contacted }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }),
});

// CORS preflight
http.route({
  path: "/logOutreach",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

http.route({
  path: "/checkContacted",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }),
});

export default http;
