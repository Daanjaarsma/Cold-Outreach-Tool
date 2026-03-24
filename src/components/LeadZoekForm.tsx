import { useState } from "react";
import { ShoppingCart, Users, Search, MapPin, Loader2 } from "lucide-react";
import { cn, SUB_SECTORS, BEDRIJFSGROOTTES } from "../lib/utils";

const LEAD_COUNTS = [20, 50, 100];

interface LeadZoekFormProps {
  onSearch: (params: {
    sector: string;
    subSector: string;
    location: string;
    bedrijfsgrootte: string;
    leadCount: number;
  }) => Promise<void>;
  isLoading: boolean;
}

export function LeadZoekForm({ onSearch, isLoading }: LeadZoekFormProps) {
  const [sector, setSector] = useState<"e-commerce" | "recruitment" | null>(null);
  const [subSector, setSubSector] = useState("");
  const [location, setLocation] = useState("");
  const [bedrijfsgrootte, setBedrijfsgrootte] = useState("");
  const [leadCount, setLeadCount] = useState(20);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sector || !location.trim()) return;
    onSearch({
      sector,
      subSector,
      location: location.trim(),
      bedrijfsgrootte,
      leadCount,
    });
  };

  const sectors = [
    {
      id: "e-commerce" as const,
      label: "E-commerce",
      desc: "Webshops, D2C, online verkoop",
      icon: ShoppingCart,
    },
    {
      id: "recruitment" as const,
      label: "Recruitment",
      desc: "Uitzendbureaus, werving & selectie",
      icon: Users,
    },
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <label className="text-sm font-medium text-white/60 mb-2 block">
          Sector
        </label>
        <div className="grid grid-cols-2 gap-3">
          {sectors.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setSector(s.id);
                setSubSector("");
              }}
              className={cn(
                "p-4 rounded-xl border transition-all cursor-pointer text-left flex flex-col gap-2",
                sector === s.id
                  ? "border-[#31edae] bg-[#31edae]/10"
                  : "border-white/[0.06] bg-white/[0.03] hover:border-white/[0.12]"
              )}
            >
              <s.icon
                className={cn(
                  "w-6 h-6",
                  sector === s.id ? "text-[#31edae]" : "text-white/40"
                )}
              />
              <div>
                <p
                  className={cn(
                    "font-semibold text-sm",
                    sector === s.id ? "text-[#31edae]" : "text-white"
                  )}
                >
                  {s.label}
                </p>
                <p className="text-xs text-white/35">{s.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {sector && (
        <div>
          <label className="text-sm font-medium text-white/60 mb-2 block">
            Sub-sector
          </label>
          <select
            value={subSector}
            onChange={(e) => setSubSector(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.06] text-white outline-none focus:border-[#31edae] transition-colors appearance-none cursor-pointer"
          >
            <option value="" className="bg-[#1e1e1e]">
              Alle sub-sectoren
            </option>
            {SUB_SECTORS[sector]?.map((ss) => (
              <option key={ss} value={ss} className="bg-[#1e1e1e]">
                {ss}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-white/60 mb-2 block">
          Locatie
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Bijv. Amsterdam, Rotterdam..."
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.06] border border-white/[0.06] text-white placeholder-white/30 outline-none focus:border-[#31edae] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-white/60 mb-2 block">
          Bedrijfsgrootte
        </label>
        <div className="flex flex-wrap gap-2">
          {BEDRIJFSGROOTTES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() =>
                setBedrijfsgrootte(bedrijfsgrootte === size ? "" : size)
              }
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                bedrijfsgrootte === size
                  ? "bg-[#31edae] text-black"
                  : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-white/60 mb-2 block">
          Aantal leads
        </label>
        <div className="flex flex-wrap gap-2">
          {LEAD_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              onClick={() => setLeadCount(count)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all cursor-pointer",
                leadCount === count
                  ? "bg-[#31edae] text-black"
                  : "bg-white/[0.06] text-white/60 hover:bg-white/[0.1]"
              )}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={!sector || !location.trim() || isLoading}
        className={cn(
          "w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer",
          !sector || !location.trim() || isLoading
            ? "bg-white/[0.06] text-white/30 cursor-not-allowed"
            : "bg-[#31edae] text-black hover:bg-[#28c896]"
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Leads zoeken...
          </>
        ) : (
          <>
            <Search className="w-5 h-5" />
            Zoek Leads
          </>
        )}
      </button>
    </form>
  );
}
