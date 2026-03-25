import type { VercelRequest, VercelResponse } from "@vercel/node";

const APIFY_BASE = "https://api.apify.com/v2";

// ── ACTOR IDs ──
const GMAPS_ACTOR_ID = "compass/crawler-google-places";
const SHOPIFY_ACTOR_ID = "clearpath/shopify-store-leads";
const EMAIL_SCRAPER_ACTOR_ID = process.env.APIFY_EMAIL_SCRAPER_ID || "";

// ── TIMEOUT MANAGEMENT ──
const startTime = Date.now();
const MAX_EXEC_MS = 55000; // 55s, 5s marge voor response
function timeRemaining(): number {
  return MAX_EXEC_MS - (Date.now() - startTime);
}

interface ScrapeParams {
  location: string;
  sector: string;
  subSector?: string;
  leadCount: number;
  excludePlaceIds?: string[];
  bedrijfsgrootte?: string;
}

// ══════════════════════════════════════════════════════════════════════
// DOMEIN NORMALISATIE (cross-bron deduplicatie)
// ══════════════════════════════════════════════════════════════════════

function normalizeDomain(url: string): string | null {
  try {
    const u = url.startsWith("http") ? url : `https://${url}`;
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// FILTERING & VALIDATIE
// ══════════════════════════════════════════════════════════════════════

// ── CATEGORIE-BLACKLIST (Google Maps) ──
const EXCLUDE_CATEGORIES: Record<string, string[]> = {
  "e-commerce": [
    // Marketing & reclame
    "marketingbureau", "reclamebureau", "internetmarketingservice", "online marketing",
    "pr-bureau", "seo-bureau", "mediabedrijf", "marketingconsultant", "digital agency",
    // Web & IT dienstverlening
    "webdesignbureau", "webdesigner", "webdesign", "webontwerp", "website",
    "softwarebedrijf", "app-ontwikkelaar", "it-dienstverlening", "it-bedrijf",
    "e-commerceservice", "internetbedrijf", "e-commerce bureau", "online bureau",
    // Advies & consulting
    "adviesbureau", "consultant", "bedrijfsadviseur", "management consultant",
    // Logistiek & fulfillment
    "logistieke dienstverlening", "fulfillment", "magazijn", "opslagruimte",
    "bezorgservice", "koeriersdienst", "verhuisbedrijf",
    // B2B diensten
    "business to business", "b2b-service",
    // Creatief & media
    "grafisch ontwerper", "drukkerij", "fotograaf", "videoproductiebedrijf",
    "reclame", "communicatiebureau",
    // Financieel & juridisch
    "accountant", "boekhouder", "belastingadviseur", "advocatenkantoor",
    // Warenhuizen (ketens)
    "warenhuis",
  ],
  recruitment: [
    "advocatenkantoor", "accountant", "belastingadviseur", "notaris",
    "verzekeringskantoor", "financieel adviseur", "marketingbureau",
    "webdesignbureau", "softwarebedrijf",
  ],
};

function isExcludedCategory(categoryName: string, sector: string): boolean {
  const excludes = EXCLUDE_CATEGORIES[sector] || [];
  const cat = categoryName.toLowerCase().trim();
  return excludes.some((ex) => cat.includes(ex));
}

// ── KETEN-BLACKLIST (uitgebreid: 100+ ketens) ──
const KETEN_BLACKLIST = [
  // Warenhuizen & drogisterij
  "hema", "etos", "prénatal", "prenatal", "wibra", "blokker", "action",
  "kruidvat", "trekpleister", "da drogist", "bijenkorf",
  // Supermarkten & food delivery
  "albert heijn", "jumbo", "lidl", "aldi", "plus supermarkt", "dirk",
  "picnic", "crisp", "flink", "gorillas", "thuisbezorgd", "just eat",
  // Bouwmarkten
  "gamma", "karwei", "praxis", "hornbach", "bouwmaat", "toolstation",
  // Wonen & interieur
  "ikea", "jysk", "kwantum", "leen bakker", "beter bed", "swiss sense",
  "xenos", "flying tiger", "intratuin", "fonq",
  // Elektronica
  "mediamarkt", "coolblue", "bcc", "expert", "samsung experience", "apple store",
  // Online platforms
  "bol.com", "amazon", "zalando", "wehkamp",
  // Mode - internationaal
  "h&m", "zara", "c&a", "primark", "zeeman", "mango",
  "pull & bear", "bershka", "stradivarius", "massimo dutti",
  "scotch & soda", "tommy hilfiger", "ralph lauren", "levi's",
  "jack & jones", "only", "vero moda", "esprit",
  // Mode - sport
  "nike", "adidas", "puma", "decathlon", "intersport", "jd sports",
  "bever", "foot locker", "perry sport",
  // Beauty ketens
  "douglas", "rituals", "sephora", "the body shop", "lush",
  // Huisdieren
  "pets place", "jumper", "ranzijn",
  // Boekhandel & media
  "bruna", "pearl",
  // Overig
  "big bazar", "formido", "sligro", "makro",
].map((k) => k.toLowerCase());

function isKeten(bedrijfsnaam: string): boolean {
  const naam = bedrijfsnaam.toLowerCase().trim();
  return KETEN_BLACKLIST.some((keten) => naam.includes(keten));
}

// ── JUNK-DATA FILTERING ──
const JUNK_EMAILS = [
  "press@google.com", "support@jouwweb.nl", "noreply@", "no-reply@",
  "support@wix.com", "support@squarespace.com", "support@shopify.com",
  "donotreply@", "mailer-daemon@", "postmaster@",
];

const JUNK_WEBSITE_PATTERNS = [
  "google.com/maps", "maps.google", "facebook.com", "instagram.com",
  "linkedin.com", "twitter.com", "x.com", "youtube.com",
];

function isJunkEmail(email: string): boolean {
  const e = email.toLowerCase();
  return JUNK_EMAILS.some((j) => e.includes(j));
}

function isJunkWebsite(website: string): boolean {
  const site = website.toLowerCase();
  return JUNK_WEBSITE_PATTERNS.some((p) => site.includes(p));
}

// ══════════════════════════════════════════════════════════════════════
// E-COMMERCE WEBSITE VALIDATIE (gewogen signalen)
// ══════════════════════════════════════════════════════════════════════

// Sterke signalen: 2 punten (ondubbelzinnig e-commerce)
const STRONG_ECOMMERCE_SIGNALS = [
  // Platform-detectie
  "shopify", "woocommerce", "magento", "lightspeed", "ccvshop", "shopware",
  "prestashop", "bigcommerce", "mijnwebwinkel", "snipcart",
  // Cart/checkout elementen
  "add-to-cart", "add_to_cart", "addtocart", "winkelwagen", "winkelmand",
  "shopping-cart", "shopping_cart", "cart-icon", "checkout",
  "in-winkelwagen", "toevoegen aan winkelwagen",
  // Structured data
  "og:product", "product:price", "schema.org/product", "schema.org/offer",
];

// Zwakke signalen: 1 punt (komen ook op niet-webshop sites voor)
const WEAK_ECOMMERCE_SIGNALS = [
  "product-price", "product_price", "prijs", "price",
  "bestel", "kopen", "bestellen", "buy now",
  "voorraad", "in stock", "op voorraad", "leverbaar",
  "verzendkosten", "gratis verzending", "free shipping",
];

// Negatieve signalen: dienstverlener-indicatoren
const DIENSTVERLENER_SIGNALS = [
  "onze diensten", "onze services", "our services",
  "maatwerk oplossingen", "custom solutions", "op maat",
  "strategie", "consultancy", "advies op maat",
  "portfolio", "onze klanten", "onze cases", "onze projecten",
  "offerte aanvragen", "vrijblijvend gesprek", "gratis adviesgesprek",
  "ons team", "onze specialisten", "onze experts",
  "wij helpen", "wij bouwen", "wij ontwikkelen", "wij ontwerpen",
];

const ECOMMERCE_SCORE_THRESHOLD = 4; // Punten nodig om te valideren

async function validateEcommerceWebsite(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PraedixBot/1.0)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!response.ok) return false;

    // Lees eerste 60KB HTML
    const reader = response.body?.getReader();
    if (!reader) return false;

    let html = "";
    let bytesRead = 0;
    const maxBytes = 60000;

    while (bytesRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      bytesRead += value.length;
    }
    reader.cancel();

    const htmlLower = html.toLowerCase();

    // Tel gewogen score
    let score = 0;
    let hasStrongSignal = false;

    for (const signal of STRONG_ECOMMERCE_SIGNALS) {
      if (htmlLower.includes(signal)) {
        score += 2;
        hasStrongSignal = true;
      }
    }

    for (const signal of WEAK_ECOMMERCE_SIGNALS) {
      if (htmlLower.includes(signal)) {
        score += 1;
      }
    }

    // Check negatieve signalen (dienstverlener-detectie)
    if (!hasStrongSignal) {
      let dienstSignalen = 0;
      for (const signal of DIENSTVERLENER_SIGNALS) {
        if (htmlLower.includes(signal)) dienstSignalen++;
      }
      if (dienstSignalen >= 3) {
        return false; // Dienstverlener, geen webshop
      }
    }

    return score >= ECOMMERCE_SCORE_THRESHOLD;
  } catch {
    return false;
  }
}

// ── BEDRIJFSGROOTTE PROXY VIA REVIEW COUNT ──
const REVIEW_COUNT_RANGES: Record<string, { min: number; max: number }> = {
  "1-10":    { min: 0, max: 75 },
  "11-50":   { min: 10, max: 500 },
  "51-200":  { min: 50, max: 2000 },
  "201-1000": { min: 200, max: 100000 },
  "1000+":   { min: 500, max: 100000 },
};

function matchesBedrijfsgrootte(reviewCount: number | null, bedrijfsgrootte?: string): boolean {
  if (!bedrijfsgrootte) return true;
  const range = REVIEW_COUNT_RANGES[bedrijfsgrootte];
  if (!range) return true;
  if (reviewCount === null || reviewCount === 0) {
    return bedrijfsgrootte === "1-10" || bedrijfsgrootte === "11-50";
  }
  return reviewCount >= range.min && reviewCount <= range.max;
}

// ══════════════════════════════════════════════════════════════════════
// ZOEKTERMEN
// ══════════════════════════════════════════════════════════════════════

// ── SHOPIFY ZOEKTERMEN (met "nederland" voor geo-targeting) ──
const SHOPIFY_QUERIES: Record<string, string[]> = {
  "e-commerce": ["kleding nederland", "schoenen nederland", "beauty nederland", "sport nederland", "wonen nederland", "voeding nederland"],
  "Webshops (D2C)": ["kleding nederland", "beauty nederland", "accessoires nederland", "schoenen nederland", "sport nederland"],
  "Online marktplaatsen": ["marketplace nederland", "tweedehands nederland", "vintage nederland"],
  "Fysieke winkels met webshop": ["winkel nederland", "lokaal nederland", "boutique nederland"],
  "Groothandels met online verkoop": ["groothandel nederland", "bulk nederland", "B2B supplies nederland"],
};

// ── GOOGLE MAPS ZOEKTERMEN ──
// Zoek op retail-categorieën die Google Maps begrijpt, niet op consumentengedrag
const SEARCH_QUERIES: Record<string, { queries: string[] }> = {
  "e-commerce": {
    queries: ["kledingwinkel", "schoenenwinkel", "sportwinkel", "speelgoedwinkel"],
  },
  "e-commerce::Webshops (D2C)": {
    queries: ["webshop", "online winkel", "webwinkel"],
  },
  "e-commerce::Online marktplaatsen": {
    queries: ["online marktplaats", "online platform", "tweedehands winkel"],
  },
  "e-commerce::Fysieke winkels met webshop": {
    queries: ["kledingwinkel", "schoenenwinkel", "meubelwinkel", "fietsenwinkel"],
  },
  "e-commerce::Groothandels met online verkoop": {
    queries: ["groothandel", "leverancier"],
  },
  recruitment: {
    queries: ["uitzendbureau", "werving en selectie", "recruitmentbureau"],
  },
  "recruitment::Uitzendbureau": {
    queries: ["uitzendbureau"],
  },
  "recruitment::Werving & selectie": {
    queries: ["werving en selectie", "recruitmentbureau"],
  },
  "recruitment::Detachering": {
    queries: ["detachering", "detacheringsbureau"],
  },
  "recruitment::HR-dienstverlening": {
    queries: ["hr advies", "hr dienstverlening", "personeelszaken"],
  },
};

function getSearchConfig(sector: string, subSector?: string) {
  const key = subSector ? `${sector}::${subSector}` : sector;
  return SEARCH_QUERIES[key] || SEARCH_QUERIES[sector] || {
    queries: [subSector || sector],
  };
}

// ══════════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ══════════════════════════════════════════════════════════════════════

async function waitForRun(runId: string, token: string, maxWaitMs = 240000): Promise<string> {
  const effectiveMax = Math.min(maxWaitMs, timeRemaining() - 5000);
  if (effectiveMax <= 0) return "TIMEOUT";

  const start = Date.now();
  while (Date.now() - start < effectiveMax) {
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

// ══════════════════════════════════════════════════════════════════════
// EMAIL FALLBACK
// ══════════════════════════════════════════════════════════════════════

function generateFallbackEmail(website: string): { email: string; bron: "fallback" } | null {
  const domain = normalizeDomain(website);
  if (!domain) return null;
  // Geen fallback voor social media of platform-domeinen
  const skipDomains = ["facebook.com", "instagram.com", "linkedin.com", "bol.com", "amazon.nl", "etsy.com"];
  if (skipDomains.some((s) => domain.includes(s))) return null;
  return { email: `info@${domain}`, bron: "fallback" };
}

// ══════════════════════════════════════════════════════════════════════
// SHOPIFY SCRAPER — voor e-commerce leads
// ══════════════════════════════════════════════════════════════════════

async function scrapeShopify(params: {
  subSector?: string;
  leadCount: number;
  excludePlaceIds?: string[];
  excludeDomains?: Set<string>;
  bedrijfsgrootte?: string;
  token: string;
}): Promise<any[]> {
  const { subSector, leadCount, excludePlaceIds, excludeDomains, token } = params;
  const excludeSet = new Set(excludePlaceIds || []);

  const allQueries = (subSector && SHOPIFY_QUERIES[subSector]) || SHOPIFY_QUERIES["e-commerce"];
  const queries = allQueries.slice(0, 3);
  const perQueryMax = Math.ceil((leadCount + excludeSet.size) / queries.length) + 10;

  console.log(`[SHOPIFY] Zoeken met queries: ${queries.join(", ")} (${perQueryMax} per query)`);

  const allResults: any[] = [];

  for (const query of queries) {
    if (timeRemaining() < 15000) {
      console.log(`[SHOPIFY] Tijd op — stoppen na ${allResults.length} resultaten`);
      break;
    }

    const shopifyRes = await fetch(
      `${APIFY_BASE}/acts/${SHOPIFY_ACTOR_ID.replace("/", "~")}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          maxItems: perQueryMax,
          shipsTo: "NL",
          inStock: true,
        }),
      }
    );

    if (!shopifyRes.ok) {
      console.error(`[SHOPIFY FOUT] Query "${query}": ${shopifyRes.status}`);
      continue;
    }

    const shopifyRun = await shopifyRes.json();
    const runId = shopifyRun.data?.id;
    if (!runId) continue;

    const status = await waitForRun(runId, token);
    if (status !== "SUCCEEDED") continue;

    const items = await getDatasetItems(runId, token);
    console.log(`[SHOPIFY] Query "${query}": ${items.length} stores`);
    allResults.push(...items);
  }

  // Dedupliceer + filter ketens + domein-dedup
  const seenStores = new Set<string>();
  const seenDomains = new Set<string>(excludeDomains || []);

  const uniqueStores = allResults.filter((store: any) => {
    const storeName = store.name || store.title || "";
    const storeUrl = store.storeUrl || store.url || store.website || "";
    const key = (storeUrl || store.handle || storeName).toLowerCase().trim();
    if (!key || seenStores.has(key)) return false;
    if (excludeSet.has(`shopify:${key}`)) return false;
    if (isKeten(storeName)) return false;

    // Domein-dedup
    const domain = normalizeDomain(storeUrl);
    if (domain && seenDomains.has(domain)) return false;
    if (domain) seenDomains.add(domain);

    seenStores.add(key);
    return true;
  }).slice(0, leadCount);

  console.log(`[SHOPIFY KLAAR] ${allResults.length} ruwe → ${uniqueStores.length} unieke stores`);

  return uniqueStores.map((store: any) => {
    const storeUrl = store.storeUrl || store.url || store.website || "";
    const storeId = `shopify:${(storeUrl || store.handle || store.name || "").toLowerCase().trim()}`;

    return {
      bedrijfsnaam: store.name || store.title || "Onbekend",
      categorie: "Webshop (Shopify)",
      stad: store.city || store.location || extractCityFromAddress(store.address) || undefined,
      telefoon: store.phone || store.phoneNumber || undefined,
      email: store.email || store.contactEmail || undefined,
      emailBron: (store.email || store.contactEmail) ? "scraped" : undefined,
      website: storeUrl || undefined,
      reviewScore: store.rating || store.averageRating || undefined,
      reviewCount: store.reviewCount || store.totalReviews || undefined,
      placeId: storeId,
    };
  });
}

function extractCityFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const parts = address.split(",").map((p: string) => p.trim());
  if (parts.length >= 2) {
    const cityPart = parts[parts.length - 2] || parts[parts.length - 1];
    return cityPart.replace(/^\d{4}\s?[A-Z]{2}\s*/, "").trim() || undefined;
  }
  return undefined;
}

// ══════════════════════════════════════════════════════════════════════
// GOOGLE MAPS SCRAPER — voor recruitment + e-commerce fallback
// ══════════════════════════════════════════════════════════════════════

async function scrapeGoogleMaps(params: {
  location: string;
  sector: string;
  subSector?: string;
  leadCount: number;
  excludePlaceIds?: string[];
  excludeDomains?: Set<string>;
  bedrijfsgrootte?: string;
  token: string;
  validateEcommerce?: boolean;
}): Promise<any[]> {
  const { location, sector, subSector, leadCount, excludePlaceIds, excludeDomains, bedrijfsgrootte, token, validateEcommerce } = params;

  const config = getSearchConfig(sector, subSector);
  const searchQueries = config.queries.map((q) => `${q} ${location}`);

  const excludeCount = excludePlaceIds?.length || 0;
  // Bij e-commerce validatie: vraag veel meer op (veel gaan afvallen)
  const filterMultiplier = validateEcommerce ? 8 : bedrijfsgrootte ? 3 : 1.5;
  const perQueryLimit = Math.ceil(((leadCount) * filterMultiplier + excludeCount) / searchQueries.length) + 5;

  console.log(`[GMAPS] Zoeken: ${searchQueries.map(q => `"${q}"`).join(", ")} (${perQueryLimit} per query)`);

  const gmapsRes = await fetch(
    `${APIFY_BASE}/acts/${GMAPS_ACTOR_ID.replace("/", "~")}/runs?token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        searchStringsArray: searchQueries,
        maxCrawledPlacesPerSearch: perQueryLimit,
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

  const gmapsStatus = await waitForRun(gmapsRunId, token);
  if (gmapsStatus !== "SUCCEEDED") {
    throw new Error(`Google Maps Scraper: ${gmapsStatus}`);
  }

  const gmapsDataRaw = await getDatasetItems(gmapsRunId, token);

  // Dedupliceer + filter: categorie, grootte, ketens, domeinen
  const seenPlaces = new Set<string>();
  const seenDomains = new Set<string>(excludeDomains || []);
  const excludeSet = new Set(excludePlaceIds || []);
  let stats = { categorie: 0, grootte: 0, keten: 0, junk: 0, domein: 0 };

  const gmapsData = gmapsDataRaw.filter((item: any) => {
    const id = item.placeId || item.title;
    if (seenPlaces.has(id)) return false;
    if (id && excludeSet.has(id)) return false;
    seenPlaces.add(id);

    const cat = item.categoryName || "";
    if (cat && isExcludedCategory(cat, sector)) { stats.categorie++; return false; }

    const naam = item.title || item.name || "";
    if (isKeten(naam)) { stats.keten++; return false; }

    const reviews = item.reviewsCount ?? null;
    if (!matchesBedrijfsgrootte(reviews, bedrijfsgrootte)) { stats.grootte++; return false; }

    // Junk website check
    const website = item.website || item.url || "";
    if (website && isJunkWebsite(website)) { stats.junk++; return false; }

    // Domein-dedup
    const domain = normalizeDomain(website);
    if (domain && seenDomains.has(domain)) { stats.domein++; return false; }
    if (domain) seenDomains.add(domain);

    return true;
  });

  console.log(`[GMAPS FILTER] ${gmapsDataRaw.length} ruwe → ${gmapsData.length} na filter | cat:${stats.categorie} keten:${stats.keten} grootte:${stats.grootte} junk:${stats.junk} domein:${stats.domein}`);

  // Map naar baseleads
  let baseleads = gmapsData.map((item: any, idx: number) => ({
    leadId: item.placeId || `lead-${idx + 1}`,
    bedrijfsnaam: item.title || item.name || "Onbekend",
    categorie: item.categoryName || sector,
    stad: item.city || item.address?.split(",").pop()?.trim() || location,
    telefoon: item.phone || item.phoneUnformatted || null,
    website: item.website || item.url || null,
    reviewScore: item.totalScore || item.stars || null,
    reviewCount: item.reviewsCount || null,
  }));

  // ── E-COMMERCE WEBSITE VALIDATIE ──
  if (validateEcommerce && baseleads.length > 0) {
    console.log(`[VALIDATIE] Website-check voor ${baseleads.length} leads (drempel: ${ECOMMERCE_SCORE_THRESHOLD} punten)...`);

    const validatedLeads: any[] = [];
    for (let i = 0; i < baseleads.length && validatedLeads.length < leadCount; i += 5) {
      if (timeRemaining() < 10000) {
        console.log(`[VALIDATIE] Tijd op — ${validatedLeads.length} gevalideerd`);
        break;
      }

      const batch = baseleads.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (lead: any) => {
          if (!lead.website) return { lead, isValid: false };
          const isValid = await validateEcommerceWebsite(lead.website);
          return { lead, isValid };
        })
      );

      for (const { lead, isValid } of results) {
        if (isValid) {
          validatedLeads.push(lead);
          console.log(`  ✅ ${lead.bedrijfsnaam}`);
        } else {
          console.log(`  ❌ ${lead.bedrijfsnaam} — ${lead.website}`);
        }
      }
    }

    console.log(`[VALIDATIE KLAAR] ${baseleads.length} → ${validatedLeads.length} gevalideerde webshops`);
    baseleads = validatedLeads;
  }

  baseleads = baseleads.slice(0, leadCount);

  // ── EMAIL VERRIJKING ──
  let emailMap: Record<string, { email: string | null; phone: string | null }> = {};
  const leadsMetWebsite = baseleads.filter((l: any) => l.website);

  if (leadsMetWebsite.length > 0 && EMAIL_SCRAPER_ACTOR_ID && timeRemaining() > 15000) {
    console.log(`[EMAIL] Scrapen voor ${leadsMetWebsite.length} websites`);

    const emailInput = leadsMetWebsite.map((l: any) => ({
      leadId: l.leadId,
      website: l.website,
      name: l.bedrijfsnaam,
      phone: l.telefoon,
      city: l.stad,
    }));

    const emailRes = await fetch(
      `${APIFY_BASE}/acts/${EMAIL_SCRAPER_ACTOR_ID.replace("/", "~")}/runs?token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadsJson: emailInput,
          concurrency: 10,
          perSiteTimeoutSec: 8,
          perLeadHardTimeoutSec: 35,
        }),
      }
    );

    if (emailRes.ok) {
      const emailRun = await emailRes.json();
      const emailRunId = emailRun.data?.id;
      if (emailRunId) {
        const emailStatus = await waitForRun(emailRunId, token);
        if (emailStatus === "SUCCEEDED") {
          const emailData = await getDatasetItems(emailRunId, token);
          if (Array.isArray(emailData)) {
            for (const item of emailData) {
              if (item.leadId) {
                emailMap[item.leadId] = {
                  email: item.primaryEmail || null,
                  phone: item.phone || null,
                };
              }
            }
            console.log(`[EMAIL KLAAR] ${Object.keys(emailMap).length} emails gevonden`);
          }
        }
      }
    }
  } else if (timeRemaining() <= 15000) {
    console.log(`[EMAIL OVERGESLAGEN] Onvoldoende tijd (${Math.round(timeRemaining() / 1000)}s resterend)`);
  }

  // Combineer + junk-email filtering + fallback
  return baseleads.map((lead: any) => {
    const enriched = emailMap[lead.leadId];
    let email = enriched?.email || undefined;
    let emailBron: string | undefined = email ? "scraped" : undefined;

    // Filter junk emails
    if (email && isJunkEmail(email)) {
      email = undefined;
      emailBron = undefined;
    }

    // Fallback email-generatie als er geen email is maar wel een website
    if (!email && lead.website) {
      const fallback = generateFallbackEmail(lead.website);
      if (fallback) {
        email = fallback.email;
        emailBron = fallback.bron;
      }
    }

    return {
      bedrijfsnaam: lead.bedrijfsnaam,
      categorie: lead.categorie,
      stad: lead.stad,
      telefoon: enriched?.phone || lead.telefoon || undefined,
      email,
      emailBron,
      website: lead.website || undefined,
      reviewScore: lead.reviewScore || undefined,
      reviewCount: lead.reviewCount || undefined,
      placeId: lead.leadId || undefined,
    };
  });
}

// ══════════════════════════════════════════════════════════════════════
// MAIN HANDLER — hybride aanpak
// ══════════════════════════════════════════════════════════════════════

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { location, sector, subSector, leadCount, excludePlaceIds, bedrijfsgrootte } = req.body as ScrapeParams;

  if (!location || !sector) {
    return res.status(400).json({ error: "Locatie en sector zijn verplicht" });
  }

  const apifyToken = process.env.APIFY_TOKEN;
  if (!apifyToken) {
    return res.status(500).json({ error: "APIFY_TOKEN niet geconfigureerd" });
  }

  try {
    let leads: any[] = [];

    if (sector === "e-commerce") {
      // ── HYBRIDE AANPAK VOOR E-COMMERCE ──
      console.log(`[HYBRIDE] E-commerce: Shopify scraper als primaire bron`);

      // Shopify Store Lead Scraper (primair — alleen echte webshops)
      const shopifyLeads = await scrapeShopify({
        subSector,
        leadCount: leadCount || 20,
        excludePlaceIds,
        bedrijfsgrootte,
        token: apifyToken,
      });

      leads = shopifyLeads;

      // Verzamel domeinen van Shopify leads voor cross-bron dedup
      const shopifyDomains = new Set<string>();
      for (const l of leads) {
        if (l.website) {
          const d = normalizeDomain(l.website);
          if (d) shopifyDomains.add(d);
        }
      }

      console.log(`[HYBRIDE] Shopify: ${leads.length}/${leadCount || 20} leads`);

      // Google Maps met website-validatie als fallback
      const remaining = (leadCount || 20) - leads.length;
      if (remaining > 0 && timeRemaining() > 15000) {
        console.log(`[HYBRIDE] Google Maps fallback voor ${remaining} extra (met website-validatie)`);

        const allExcludeIds = [
          ...(excludePlaceIds || []),
          ...leads.map((l: any) => l.placeId).filter(Boolean),
        ];

        const gmapsLeads = await scrapeGoogleMaps({
          location,
          sector,
          subSector,
          leadCount: remaining,
          excludePlaceIds: allExcludeIds,
          excludeDomains: shopifyDomains, // Cross-bron domein dedup
          bedrijfsgrootte,
          token: apifyToken,
          validateEcommerce: true,
        });

        leads = [...leads, ...gmapsLeads];
      }

      // Finale domein-dedup over gecombineerde resultaten
      const finalDomains = new Set<string>();
      leads = leads.filter((l: any) => {
        if (!l.website) return true;
        const domain = normalizeDomain(l.website);
        if (!domain) return true;
        if (finalDomains.has(domain)) return false;
        finalDomains.add(domain);
        return true;
      });

      console.log(`[HYBRIDE] Totaal: ${leads.length} leads`);
    } else {
      // ── GOOGLE MAPS VOOR RECRUITMENT ──
      console.log(`[GMAPS] Recruitment: Google Maps als bron`);

      leads = await scrapeGoogleMaps({
        location,
        sector,
        subSector,
        leadCount: leadCount || 20,
        excludePlaceIds,
        bedrijfsgrootte,
        token: apifyToken,
        validateEcommerce: false,
      });
    }

    console.log(`[KLAAR] ${leads.length} leads, ${leads.filter((l: any) => l.email).length} met email (${Math.round((Date.now() - startTime) / 1000)}s)`);

    return res.status(200).json({ leads });
  } catch (err) {
    console.error("Scrape error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Er ging iets mis bij het scrapen",
    });
  }
}
