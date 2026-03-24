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

// Map naar n8n webhook sector namen
export const SECTOR_WEBHOOK_MAP: Record<string, string> = {
  "e-commerce": "Retail & E-commerce",
  recruitment: "Consulting", // Closest match in the existing 14 sectors
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

export const berekenLeadScore = (lead: {
  website?: string | null;
  email?: string | null;
  telefoon?: string | null;
  reviewScore?: number | null;
  reviewCount?: number | null;
}): number => {
  let score = 20;
  if (lead.website) score += 15;
  if (lead.email) score += 20;
  if (lead.telefoon) score += 10;
  if (lead.reviewScore && lead.reviewScore >= 4.0) score += 15;
  else if (lead.reviewScore && lead.reviewScore >= 3.5) score += 7;
  if (lead.reviewCount && lead.reviewCount > 10) score += 10;
  return Math.min(score, 100);
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
