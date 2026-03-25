import { useState, useCallback, Component, type ReactNode } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { PasswordGate } from "./components/PasswordGate";
import { StatsOverzicht } from "./components/StatsOverzicht";
import { LeadZoekForm } from "./components/LeadZoekForm";
import { LeadsResultaat } from "./components/LeadsResultaat";
import { berekenLeadScore } from "./lib/utils";

class DashboardErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      const isConvexError = this.state.error.message.includes("CONVEX");
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 flex flex-col items-center gap-4">
            <div className="text-[#31edae] text-2xl">⚠</div>
            <h2 className="text-white font-semibold">
              {isConvexError ? "Database verbinding mislukt" : "Er ging iets mis"}
            </h2>
            <p className="text-white/50 text-sm text-center">
              {isConvexError
                ? "Convex functies zijn niet beschikbaar. Probeer de pagina opnieuw te laden."
                : this.state.error.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-[#31edae] text-black font-semibold hover:bg-[#28c896] transition-colors cursor-pointer"
            >
              Opnieuw laden
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Dashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const leads = useQuery(api.leads.list) ?? [];
  const existingPlaceIds = useQuery(api.leads.getPlaceIds) ?? [];
  const saveBatch = useMutation(api.leads.saveBatch);

  const handleSearch = async (params: {
    sector: string;
    subSector: string;
    location: string;
    bedrijfsgrootte: string;
    leadCount: number;
  }) => {
    setIsLoading(true);
    setError(null);
    setSelectedIds(new Set());

    try {
      const payload = {
        location: params.location,
        sector: params.sector,
        subSector: params.subSector || undefined,
        leadCount: params.leadCount,
        bedrijfsgrootte: params.bedrijfsgrootte || undefined,
        excludePlaceIds: existingPlaceIds.length > 0 ? existingPlaceIds : undefined,
      };

      console.log(`[SEARCH] Sector: ${params.sector}, Grootte: ${params.bedrijfsgrootte || "alle"}, Locatie: ${params.location}`);

      const response = await fetch("/api/scrape-leads", {
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
          categorie: l.bedrijfscategorie || l.categoryName || l.categorie || params.sector,
          subCategorie: l.subSector || params.subSector || undefined,
          stad: l.city || l.stad || params.location,
          telefoon: l.telefoonnummer || l.phoneUnformatted || l.phone || l.telefoon || undefined,
          email: l.primaryEmail || l.email || undefined,
          emailBron: l.emailBron || ((l.primaryEmail || l.email) ? "scraped" : undefined),
          website: l.website || undefined,
          reviewScore: l.reviewScore || undefined,
          reviewCount: l.reviewCount || undefined,
          bedrijfsgrootte: params.bedrijfsgrootte || undefined,
          leadScore: berekenLeadScore({
            website: l.website,
            email: l.primaryEmail || l.email,
            emailBron: l.emailBron,
            telefoon: l.telefoonnummer || l.phoneUnformatted || l.phone || l.telefoon,
            reviewScore: l.reviewScore,
            reviewCount: l.reviewCount,
            categorie: l.categorie || l.categoryName,
            sector: params.sector,
          }),
          sector: params.sector,
          bron: "zoektool" as const,
          placeId: l.placeId || undefined,
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

        </div>
      </div>
    </div>
  );
}

function App() {
  const [isAuthed, setIsAuthed] = useState(
    () => sessionStorage.getItem("praedix_outreach_auth") === "true"
  );

  if (!isAuthed) {
    return <PasswordGate onAuth={() => setIsAuthed(true)} />;
  }

  return (
    <DashboardErrorBoundary>
      <Dashboard />
    </DashboardErrorBoundary>
  );
}

export default App;
