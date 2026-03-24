import type { VercelRequest, VercelResponse } from "@vercel/node";

// TODO: Apify integratie toevoegen
// - Google Maps Scraper actor aanroepen
// - Custom Email Scraper actor aanroepen
// - Resultaten combineren

const APIFY_BASE = "https://api.apify.com/v2";

interface ScrapeParams {
  location: string;
  sector: string;
  subSector?: string;
  leadCount: number;
  bedrijfsgrootte?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { location, sector, subSector, leadCount, bedrijfsgrootte } =
    req.body as ScrapeParams;

  if (!location || !sector) {
    return res.status(400).json({ error: "Locatie en sector zijn verplicht" });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return res.status(500).json({ error: "APIFY_TOKEN niet geconfigureerd" });
  }

  try {
    // Stap 1: Zoekterm samenstellen
    const searchQuery = subSector
      ? `${subSector} ${location}`
      : `${sector} ${location}`;

    // Stap 2: Google Maps Scraper aanroepen
    // TODO: Vervang ACTOR_ID met de juiste actor ID
    const googleMapsActorId = "compass/crawler-google-places"; // Marketplace actor
    const gmapsResponse = await fetch(
      `${APIFY_BASE}/acts/${googleMapsActorId}/runs?token=${apifyToken}`,
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

    if (!gmapsResponse.ok) {
      throw new Error(`Google Maps Scraper fout: ${gmapsResponse.status}`);
    }

    const gmapsRun = await gmapsResponse.json();
    const runId = gmapsRun.data?.id;

    if (!runId) {
      throw new Error("Geen run ID ontvangen van Apify");
    }

    // Stap 3: Wacht op resultaat (polling)
    let status = "RUNNING";
    let attempts = 0;
    const maxAttempts = 60; // max 5 minuten (5s interval)

    while (status === "RUNNING" && attempts < maxAttempts) {
      await new Promise((r) => setTimeout(r, 5000));
      const statusRes = await fetch(
        `${APIFY_BASE}/actor-runs/${runId}?token=${apifyToken}`
      );
      const statusData = await statusRes.json();
      status = statusData.data?.status || "FAILED";
      attempts++;
    }

    if (status !== "SUCCEEDED") {
      throw new Error(`Scraper gestopt met status: ${status}`);
    }

    // Stap 4: Resultaten ophalen
    const datasetRes = await fetch(
      `${APIFY_BASE}/actor-runs/${runId}/dataset/items?token=${apifyToken}&format=json`
    );
    const rawLeads = await datasetRes.json();

    // Stap 5: Mapt naar lead-formaat
    const leads = (rawLeads || []).map((item: any) => ({
      bedrijfsnaam: item.title || item.name || "Onbekend",
      categorie: item.categoryName || sector,
      stad: item.city || item.address?.split(",").pop()?.trim() || location,
      telefoon: item.phone || item.phoneUnformatted || undefined,
      email: item.email || undefined, // Wordt aangevuld door email scraper
      website: item.website || item.url || undefined,
      reviewScore: item.totalScore || item.stars || undefined,
      reviewCount: item.reviewsCount || undefined,
    }));

    // TODO: Stap 6: Custom Email Scraper aanroepen voor websites zonder email
    // Dit wordt toegevoegd zodra de custom scraper broncode beschikbaar is

    return res.status(200).json({ leads });
  } catch (err) {
    console.error("Scrape error:", err);
    return res.status(500).json({
      error:
        err instanceof Error ? err.message : "Er ging iets mis bij het scrapen",
    });
  }
}
