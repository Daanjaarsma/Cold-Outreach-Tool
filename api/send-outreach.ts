import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";
import { Resend } from "resend";

const CONVEX_SITE_URL =
  process.env.VITE_CONVEX_SITE_URL ||
  "https://qualified-herring-111.eu-west-1.convex.site";

const SYSTEM_PROMPT = `Je bent een ervaren B2B sales professional die koude acquisitie emails schrijft namens Praedix, een AI-bedrijf dat het Nederlandse MKB helpt met AI-automatiseringen.

Praedix biedt AI-automatiseringen aan vanaf €499 (implementatie) + €49/maand (support).

Specifieke AI-kansen voor e-commerce bedrijven:
- Klantenservice chatbot: beantwoordt automatisch 80% van veelgestelde vragen
- Productverwerking: automatische productbeschrijvingen, categorisering en SEO-optimalisatie
- Facturatieprocessen: automatische facturatie, herinneringen en boekhouding-integratie
- Orderverwerking: automatische orderbevestigingen en track-and-trace updates
- Klantdata-analyse: inzichten uit bestelhistorie en klantgedrag

Regels:
1. Schrijf in correct Nederlands, gebruik 'je/jouw' (niet 'u')
2. Max 150 woorden
3. Professioneel maar informeel en persoonlijk
4. Begin met een bedrijfsspecifiek inzicht (gebaseerd op de bedrijfsnaam en website)
5. Noem 1-2 concrete AI-kansen relevant voor dit specifieke bedrijf
6. Eindig met een CTA: gratis consult boeken via https://www.praedix-ai-scan.com/consult
7. Onderteken met: Met vriendelijke groet,\nHet Praedix team
8. Gebruik GEEN markdown formatting (geen **, geen ##, geen bullets)
9. Schrijf de email als plain text met alinea's gescheiden door lege regels`;

interface Lead {
  bedrijfsnaam: string;
  email: string;
  website?: string;
  stad?: string;
  categorie?: string;
  subCategorie?: string;
  telefoon?: string;
}

function buildEmailHtml(body: string): string {
  const htmlBody = body
    .replace(/\n\n/g, "<br><br>")
    .replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: 'Poppins', Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px;">
  ${htmlBody}
  <br><br>
  <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">
  <table style="width: 100%;">
    <tr>
      <td style="padding: 10px 0;">
        <strong style="color: #1e1e1e;">Praedix</strong><br>
        <span style="color: #666; font-size: 13px;">AI-automatiseringen voor het MKB</span><br>
        <a href="https://www.praedix.io" style="color: #31edae; font-size: 13px; text-decoration: none;">www.praedix.io</a>
      </td>
    </tr>
  </table>
  <p style="font-size: 11px; color: #999; margin-top: 20px;">
    Je ontvangt deze email omdat we denken dat AI-automatiseringen waardevol kunnen zijn voor jouw bedrijf.
    Wil je geen emails meer ontvangen? Stuur een reply met "uitschrijven".
  </p>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { leads } = req.body as { leads: Lead[] };

  if (!leads || !Array.isArray(leads) || leads.length === 0) {
    return res.status(400).json({ error: "Geen leads meegegeven" });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!anthropicKey || !resendKey) {
    return res.status(500).json({ error: "API keys niet geconfigureerd" });
  }

  const claude = new Anthropic({ apiKey: anthropicKey });
  const resend = new Resend(resendKey);

  // Filter en dedupliceer
  const seen = new Set<string>();
  const validLeads: Lead[] = [];

  for (const lead of leads) {
    if (!lead.email?.includes("@") || !lead.bedrijfsnaam) continue;
    const key = lead.email.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    validLeads.push(lead);
  }

  // Max 50 per dag
  const batch = validLeads.slice(0, 50);

  let sentCount = 0;
  const errors: string[] = [];

  for (const lead of batch) {
    try {
      // 1. Genereer email met Claude
      const message = await claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Schrijf een koude acquisitie email voor dit e-commerce bedrijf:\n\nBedrijfsnaam: ${lead.bedrijfsnaam}\nWebsite: ${lead.website || "onbekend"}\nStad: ${lead.stad || "onbekend"}\nCategorie: ${lead.categorie || "E-commerce"}\nSub-categorie: ${lead.subCategorie || ""}`,
          },
        ],
      });

      const text =
        message.content[0].type === "text" ? message.content[0].text : "";

      // Parse onderwerp en body
      const subjectMatch = text.match(/ONDERWERP:\s*(.+)/);
      const bodyMatch = text.match(/BODY:\s*([\s\S]+)/);
      const subject = subjectMatch
        ? subjectMatch[1].trim()
        : `AI-kansen voor ${lead.bedrijfsnaam}`;
      let body = bodyMatch ? bodyMatch[1].trim() : text;
      body = body.replace(/\*\*/g, "").replace(/^#+\s/gm, "");

      // 2. Verstuur via Resend
      await resend.emails.send({
        from: "Praedix <info@praedix.io>",
        to: [lead.email],
        subject,
        html: buildEmailHtml(body),
        replyTo: "info@praedix.io",
      });

      // 3. Log naar Convex
      try {
        await fetch(`${CONVEX_SITE_URL}/logOutreach`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: lead.email,
            bedrijfsnaam: lead.bedrijfsnaam,
            onderwerp: subject,
            verzondOp: Date.now(),
            emailVerzonden: true,
            type: "cold",
          }),
        });
      } catch {
        // Convex logging is niet kritiek
      }

      sentCount++;
    } catch (err) {
      errors.push(
        `${lead.bedrijfsnaam}: ${err instanceof Error ? err.message : "Onbekende fout"}`
      );
    }
  }

  return res.status(200).json({
    success: true,
    totalLeads: leads.length,
    sentCount,
    skippedCount: leads.length - batch.length,
    errors,
  });
}
