import type { VercelRequest, VercelResponse } from "@vercel/node";

const APIFY_BASE = "https://api.apify.com/v2";

// Google Maps Scraper actor ID — standaard Apify marketplace actor
const GMAPS_ACTOR_ID = "compass/crawler-google-places";

// Custom Email Scraper actor ID — wordt ingevuld na deploy op Apify
// Vervang dit met je eigen actor ID na het deployen van apify-email-scraper/
const EMAIL_SCRAPER_ACTOR_ID = "YOUR_APIFY_USERNAME/praedix-cold-outreach-enricher";

interface ScrapeParams {
  location: string;
  sector: string;
  subSector?: string;
  leadCount: number;
  bedrijfsgrootte?: string;
}

async function waitForRun(runId: string, token: string, maxWaitMs = 240000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 4000));
    const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${token}`);
    const data = await res.json();
    const status = data.data?.status;
    if (status === "SUCCEEDED" || status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      return status;
    }
  }
  return "TIMEOUT";
}

async function getDatasetItems(runId: string, token: string): Promise<any[]> {
  const res = await fetch(
    `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${token}&format=json`
  );
  if (!res.ok) return [];
  return await res.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { location, sector, subSector, leadCount } = req.body as ScrapeParams;

  if (!location || !sector) {
    return res.status(400).json({ error: "Locatie en sector zijn verplicht" });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return res.status(500).json({ error: "APIFY_TOKEN niet geconfigureerd" });
  }

  try {
    // ── STAP 1: Google Maps Scraper ──
    const searchQuery = subSector
      ? `${subSector} ${location}`
      : `${sector} ${location}`;

    console.log(`[STAP 1] Google Maps zoeken: "${searchQuery}" (max ${leadCount} leads)`);

    const gmapsRes = await fetch(
      `${APIFY_BASE}/acts/${GMAPS_ACTOR_ID}/runs?token=${apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchStringsArray: [searchQuery],
          maxCrawledPlacesPerSearch: leadCount || 20,
          language: "nl",
          countryCode: "nl",
        }),
      }
    );

    if (!gmapsRes.ok) {
      const errBody = await gmapsRes.text();
      throw new Error(`Google Maps Scraper fout (${gmapsRes.status}): ${errBody}`);
    }

    const gmapsRun = await gmapsRes.json();
    const gmapsRunId = gmapsRun.data?.id;
    if (!gmapsRunId) throw new Error("Geen run ID van Google Maps Scraper");

    // Wacht op Google Maps resultaten
    const gmapsStatus = await waitForRun(gmapsRunId, apifyToken);
    if (gmapsStatus !== "SUCCEEDED") {
      throw new Error(`Google Maps Scraper: ${gmapsStatus}`);
    }

    const gmapsData = await getDatasetItems(gmapsRunId, apifyToken);
    console.log(`[STAP 1 KLAAR] ${gmapsData.length} bedrijven gevonden`);

    if (gmapsData.length === 0) {
      return res.status(200).json({ leads: [], message: "Geen bedrijven gevonden voor deze zoekopdracht" });
    }

    // ── STAP 2: Bereid leads voor met basis-data ──
    const baseleads = gmapsData.map((item: any, idx: number) => ({
      leadId: item.placeId || `lead-${idx + 1}`,
      bedrijfsnaam: item.title || item.name || "Onbekend",
      categorie: item.categoryName || sector,
      stad: item.city || item.address?.split(",").pop()?.trim() || location,
      telefoon: item.phone || item.phoneUnformatted || null,
      website: item.website || item.url || null,
      reviewScore: item.totalScore || item.stars || null,
      reviewCount: item.reviewsCount || null,
      address: item.address || null,
    }));

    // ── STAP 3: Custom Email Scraper voor websites ──
    const leadsMetWebsite = baseleads.filter((l: any) => l.website);
    console.log(`[STAP 3] Email scrapen voor ${leadsMetWebsite.length} websites`);

    let emailMap: Record<string, { email: string | null; phone: string | null }> = {};

    if (leadsMetWebsite.length > 0 && !EMAIL_SCRAPER_ACTOR_ID.startsWith("YOUR_")) {
      const emailInput = leadsMetWebsite.map((l: any) => ({
        leadId: l.leadId,
        website: l.website,
        name: l.bedrijfsnaam,
        phone: l.telefoon,
        city: l.stad,
      }));

      const emailRes = await fetch(
        `${APIFY_BASE}/acts/${EMAIL_SCRAPER_ACTOR_ID}/runs?token=${apifyToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadsJson: emailInput,
            concurrency: 10,
            perSiteTimeoutSec: 5,
            perLeadHardTimeoutSec: 25,
          }),
        }
      );

      if (emailRes.ok) {
        const emailRun = await emailRes.json();
        const emailRunId = emailRun.data?.id;

        if (emailRunId) {
          const emailStatus = await waitForRun(emailRunId, apifyToken);
          if (emailStatus === "SUCCEEDED") {
            const emailData = await getDatasetItems(emailRunId, apifyToken);
            for (const item of emailData) {
              if (item.leadId) {
                emailMap[item.leadId] = {
                  email: item.primaryEmail || null,
                  phone: item.phone || null,
                };
              }
            }
            console.log(`[STAP 3 KLAAR] ${Object.keys(emailMap).length} emails gevonden`);
          }
        }
      }
    } else if (EMAIL_SCRAPER_ACTOR_ID.startsWith("YOUR_")) {
      console.log("[STAP 3 OVERGESLAGEN] Email scraper actor ID niet geconfigureerd");
    }

    // ── STAP 4: Combineer resultaten ──
    const leads = baseleads.map((lead: any) => {
      const enriched = emailMap[lead.leadId];
      return {
        bedrijfsnaam: lead.bedrijfsnaam,
        categorie: lead.categorie,
        stad: lead.stad,
        telefoon: enriched?.phone || lead.telefoon || undefined,
        email: enriched?.email || undefined,
        website: lead.website || undefined,
        reviewScore: lead.reviewScore || undefined,
        reviewCount: lead.reviewCount || undefined,
      };
    });

    console.log(`[KLAAR] ${leads.length} leads, ${leads.filter((l: any) => l.email).length} met email`);

    return res.status(200).json({ leads });
  } catch (err) {
    console.error("Scrape error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Er ging iets mis bij het scrapen",
    });
  }
}
