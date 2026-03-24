import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

// POST /logOutreach — Aangeroepen door /api/send-outreach na het versturen van een email
http.route({
  path: "/logOutreach",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const body = await request.json();
    const { email, onderwerp, verzondOp, emailVerzonden, type, foutmelding } = body;

    const result = await ctx.runMutation(internal.httpHelpers.logOutreach, {
      email: email ?? "",
      onderwerp: onderwerp ?? undefined,
      verzondOp: verzondOp ?? Date.now(),
      emailVerzonden: emailVerzonden ?? true,
      type: type ?? "cold",
      foutmelding: foutmelding ?? undefined,
    });

    return new Response(JSON.stringify({ success: true, leadFound: result.leadFound }), {
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

    const contacted: string[] = await ctx.runQuery(internal.httpHelpers.checkContacted, {
      emails: emails ?? [],
    });

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
