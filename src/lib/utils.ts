export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const SUB_SECTORS: Record<string, string[]> = {
  "e-commerce": [
    "Webshops (D2C)",
    "Online marktplaatsen",
    "Fysieke winkels met webshop",
    "Groothandels met online verkoop",
  ],
  recruitment: [
    "Uitzendbureau",
    "Werving & selectie",
    "Detachering",
    "HR-dienstverlening",
  ],
};

export const BEDRIJFSGROOTTES = ["1-10", "11-50", "51-200", "201-1000", "1000+"];

export const STATUSES = [
  { value: "nieuw", label: "Nieuw", color: "bg-white/10 text-white/60" },
  { value: "benaderd", label: "Benaderd", color: "bg-blue-500/20 text-blue-400" },
  { value: "geantwoord", label: "Geantwoord", color: "bg-[#31edae]/20 text-[#31edae]" },
  { value: "consult_gepland", label: "Consult gepland", color: "bg-green-500/20 text-green-400" },
  { value: "klant", label: "Klant", color: "bg-yellow-500/20 text-yellow-400" },
  { value: "afgewezen", label: "Afgewezen", color: "bg-red-500/20 text-red-400" },
];

export const formatDutchPhone = (phone: string): string => {
  let cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+31")) cleaned = "0" + cleaned.slice(3);
  else if (cleaned.startsWith("0031")) cleaned = "0" + cleaned.slice(4);

  if (cleaned.startsWith("06") && cleaned.length === 10) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 6)} ${cleaned.slice(6)}`;
  } else if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
  }
  return phone;
};

// Categorieën die goed passen bij e-commerce (B2C retail)
// Opgeschoond: geen apotheken, bakkerijen, supermarkten (niet de doelgroep)
const RELEVANTE_ECOMMERCE_CATEGORIEEN = [
  "winkel", "kledingwinkel", "schoenenwinkel", "meubelwinkel", "speelgoedwinkel",
  "elektronicawinkel", "dierenwinkel", "boekwinkel", "sportwinkel",
  "juwelier", "parfumerie", "fietsenwinkel", "cadeauwinkel",
  "woninginrichting", "webshop", "online winkel", "detailhandel",
  "tuincentrum",
];

// Categorieën die duiden op een dienstverlener (niet een productverkoper)
const NEGATIEVE_CATEGORIEEN = [
  "marketingbureau", "reclamebureau", "webdesign", "adviesbureau",
  "it-dienstverlening", "softwarebedrijf", "consultant", "digital agency",
  "e-commerceservice", "internetbedrijf", "communicatiebureau",
];

export const berekenLeadScore = (lead: {
  website?: string | null;
  email?: string | null;
  emailBron?: string | null;
  telefoon?: string | null;
  reviewScore?: number | null;
  reviewCount?: number | null;
  categorie?: string | null;
  sector?: string | null;
}): number => {
  let score = 15;

  // Contactgegevens (max 30)
  if (lead.email) {
    score += lead.emailBron === "fallback" ? 10 : 20; // Fallback = minder betrouwbaar
  }
  if (lead.telefoon) score += 10;

  // Online aanwezigheid (max 20)
  if (lead.website) {
    score += 10;
    const site = lead.website.toLowerCase();
    const isEigenDomein = !site.includes("facebook.com") && !site.includes("instagram.com")
      && !site.includes("bol.com") && !site.includes("amazon") && !site.includes("etsy.com");
    if (isEigenDomein) score += 5;
  }

  // Reviews (max 20)
  if (lead.reviewScore && lead.reviewScore >= 4.0) score += 12;
  else if (lead.reviewScore && lead.reviewScore >= 3.5) score += 6;
  if (lead.reviewCount && lead.reviewCount > 10) score += 8;

  // Categorie relevantie (max 15) + Shopify bonus
  if (lead.categorie && lead.sector === "e-commerce") {
    const cat = lead.categorie.toLowerCase();

    // Shopify-bron bonus (gevalideerde webshop)
    if (cat.includes("shopify")) score += 10;

    const isRelevant = RELEVANTE_ECOMMERCE_CATEGORIEEN.some((r) => cat.includes(r));
    if (isRelevant) score += 15;

    // Negatieve signalen: dienstverlener penalty
    if (NEGATIEVE_CATEGORIEEN.some((n) => cat.includes(n))) score -= 25;
  } else if (lead.categorie && lead.sector === "recruitment") {
    const cat = lead.categorie.toLowerCase();
    const isRelevant = cat.includes("uitzend") || cat.includes("werving") || cat.includes("recruitment")
      || cat.includes("detachering") || cat.includes("hr") || cat.includes("personeel");
    if (isRelevant) score += 15;
  }

  return Math.max(0, Math.min(score, 100));
};

export const generateCSV = (leads: any[]): void => {
  const headers = [
    "Bedrijfsnaam", "Sector", "Sub-sector", "Stad", "Bedrijfsgrootte",
    "Telefoon", "Email", "Website", "Review Score", "Lead Score", "Status"
  ];
  const rows = leads.map((l) => [
    l.bedrijfsnaam,
    l.sector,
    l.subCategorie || "",
    l.stad || "",
    l.bedrijfsgrootte || "",
    l.telefoon || "",
    l.email || "",
    l.website || "",
    l.reviewScore?.toString() || "",
    l.leadScore?.toString() || "",
    l.status,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `praedix-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
