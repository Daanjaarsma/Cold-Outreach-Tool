import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { PasswordGate } from "./components/PasswordGate";
import { StatsOverzicht } from "./components/StatsOverzicht";
import { LeadZoekForm } from "./components/LeadZoekForm";
import { LeadsResultaat } from "./components/LeadsResultaat";
import { OutreachPanel } from "./components/OutreachPanel";
import { berekenLeadScore, SECTOR_WEBHOOK_MAP } from "./lib/utils";

const WEBHOOK_URL =
  "https://praedixautomations.app.n8n.cloud/webhook/4ed97bf4-31bd-446a-adcf-d3521166ad1b";

function App() {
  const [isAuthed, setIsAuthed] = useState(
    () => sessionStorage.getItem("praedix_outreach_auth") === "true"
  );
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const leads = useQuery(api.leads.list) ?? [];
  const saveBatch = useMutation(api.leads.saveBatch);

  const handleSearch = async (params: {
    sector: string;
    subSector: string;
    location: string;
    bedrijfsgrootte: string;
  }) => {
    setIsLoading(true);
    setError(null);
    setSelectedIds(new Set());

    try {
      const webhookSector =
        SECTOR_WEBHOOK_MAP[params.sector] || params.sector;

      const payload = {
        location: params.location,
        sector: webhookSector,
        subSector: params.subSector || undefined,
        leadCount: 40,
        reviews: true,
        bedrijfsgrootte: params.bedrijfsgrootte || undefined,
        groeiIndicatie: false,
      };

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook fout (HTTP ${response.status})`);
      }

      const data = await response.json();
      const rawLeads = Array.isArray(data) ? data : data.leads || [];

      // Verwerk en sla op in Convex
      const processedLeads = rawLeads
        .filter((l: any) => {
          const name = l.name || l.title || l.bedrijfsnaam;
          const hasContact = l.primaryEmail || l.email || l.phone || l.phoneUnformatted || l.telefoon || l.telefoonnummer;
          return name && hasContact;
        })
        .map((l: any) => ({
          bedrijfsnaam: l.name || l.title || l.bedrijfsnaam || "Onbekend",
          categorie: l.bedrijfscategorie || l.categoryName || l.categorie || webhookSector,
          subCategorie: l.subSector || params.subSector || undefined,
          stad: l.city || l.stad || params.location,
          telefoon: l.telefoonnummer || l.phoneUnformatted || l.phone || l.telefoon || undefined,
          email: l.primaryEmail || l.email || undefined,
          website: l.website || undefined,
          reviewScore: l.reviewScore || undefined,
          reviewCount: l.reviewCount || undefined,
          bedrijfsgrootte: params.bedrijfsgrootte || undefined,
          leadScore: berekenLeadScore({
            website: l.website,
            email: l.primaryEmail || l.email,
            telefoon: l.telefoonnummer || l.phoneUnformatted || l.phone || l.telefoon,
            reviewScore: l.reviewScore,
            reviewCount: l.reviewCount,
          }),
          sector: params.sector,
          bron: "zoektool" as const,
        }));

      if (processedLeads.length > 0) {
        const result = await saveBatch({ leads: processedLeads });
        console.log(`${result.nieuwe} nieuwe leads, ${result.overgeslagen} overgeslagen`);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError(
        err instanceof Error ? err.message : "Er ging iets mis bij het zoeken"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllWithEmail = useCallback(() => {
    const ids = leads.filter((l) => l.email).map((l) => l._id);
    setSelectedIds(new Set(ids));
  }, [leads]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedLeads = leads.filter((l) => selectedIds.has(l._id));

  if (!isAuthed) {
    return <PasswordGate onAuth={() => setIsAuthed(true)} />;
  }

  return (
    <div className="min-h-screen p-4 lg:p-6 max-w-[1400px] mx-auto flex flex-col gap-5">
      {/* Header */}
      <header className="flex items-center gap-3">
        <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
          <path
            d="M20 80V20h30c16.57 0 30 13.43 30 30s-13.43 30-30 30H20z"
            fill="#31edae"
          />
          <path d="M20 80V50h30c0 16.57-13.43 30-30 30z" fill="#28c896" />
        </svg>
        <div>
          <h1 className="text-lg font-semibold text-white leading-tight">
            Praedix Lead Outreach
          </h1>
          <p className="text-xs text-white/35">
            Leads zoeken en outreach beheren
          </p>
        </div>
      </header>

      {/* Stats */}
      <StatsOverzicht />

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-5 flex-1">
        {/* Zoekformulier */}
        <div className="lg:w-[340px] shrink-0">
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 sticky top-5">
            <h2 className="text-sm font-semibold text-white mb-4">
              Leads zoeken
            </h2>
            <LeadZoekForm onSearch={handleSearch} isLoading={isLoading} />
          </div>
        </div>

        {/* Resultaten */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <LeadsResultaat
            leads={leads}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onSelectAllWithEmail={selectAllWithEmail}
            onClearSelection={clearSelection}
          />

          {/* Outreach Panel */}
          {selectedIds.size > 0 && (
            <OutreachPanel
              selectedLeads={selectedLeads}
              onDone={clearSelection}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
