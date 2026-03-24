import { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  ChevronUp,
  ChevronDown,
  Phone,
  Mail,
  Globe,
  Copy,
  Check,
  Download,
  Trash2,
} from "lucide-react";
import { cn, formatDutchPhone, STATUSES, generateCSV } from "../lib/utils";

type Lead = Doc<"leads">;
type SortCol = "leadScore" | "bedrijfsnaam" | "stad" | "status";
type SortDir = "asc" | "desc";

interface LeadsResultaatProps {
  leads: Lead[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAllWithEmail: () => void;
  onClearSelection: () => void;
}

export function LeadsResultaat({
  leads,
  selectedIds,
  onToggleSelect,
  onSelectAllWithEmail,
  onClearSelection,
}: LeadsResultaatProps) {
  const [sortCol, setSortCol] = useState<SortCol>("leadScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const updateStatus = useMutation(api.leads.updateStatus);
  const softDelete = useMutation(api.leads.softDelete);

  const sorted = useMemo(() => {
    return [...leads].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "leadScore":
          cmp = a.leadScore - b.leadScore;
          break;
        case "bedrijfsnaam":
          cmp = a.bedrijfsnaam.localeCompare(b.bedrijfsnaam);
          break;
        case "stad":
          cmp = (a.stad || "").localeCompare(b.stad || "");
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [leads, sortCol, sortDir]);

  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "bedrijfsnaam" || col === "stad" ? "asc" : "desc");
    }
  };

  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 1500);
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "bg-[#31edae]/20 text-[#31edae]";
    if (score >= 40) return "bg-yellow-500/20 text-yellow-400";
    return "bg-red-500/20 text-red-400";
  };

  const getStatusBadge = (status: string) => {
    const s = STATUSES.find((st) => st.value === status);
    return s || { label: status, color: "bg-white/10 text-white/60" };
  };

  const SortIcon = ({ col }: { col: SortCol }) => (
    <span className="ml-1 inline-flex opacity-40">
      {sortCol === col ? (
        sortDir === "asc" ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ChevronDown className="w-3 h-3" />
      )}
    </span>
  );

  if (leads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-white/30 text-sm">
        Zoek leads om te beginnen
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAllWithEmail}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-white/60 hover:bg-white/[0.1] transition-colors cursor-pointer"
          >
            Selecteer alles met email
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={onClearSelection}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-white/40 hover:bg-white/[0.1] transition-colors cursor-pointer"
            >
              Deselecteer ({selectedIds.size})
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">
            {leads.length} lead{leads.length !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => generateCSV(leads)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-white/60 hover:bg-white/[0.1] transition-colors flex items-center gap-1 cursor-pointer"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.06]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white/[0.03] text-white/50 text-xs uppercase tracking-wider">
              <th className="p-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={selectedIds.size === leads.length && leads.length > 0}
                  onChange={() => {
                    if (selectedIds.size === leads.length) onClearSelection();
                    else leads.forEach((l) => onToggleSelect(l._id));
                  }}
                  className="accent-[#31edae] cursor-pointer"
                />
              </th>
              <th
                className="p-3 text-left cursor-pointer hover:text-white/70 transition-colors"
                onClick={() => handleSort("leadScore")}
              >
                Score
                <SortIcon col="leadScore" />
              </th>
              <th
                className="p-3 text-left cursor-pointer hover:text-white/70 transition-colors"
                onClick={() => handleSort("bedrijfsnaam")}
              >
                Bedrijfsnaam
                <SortIcon col="bedrijfsnaam" />
              </th>
              <th className="p-3 text-left">Sub-sector</th>
              <th
                className="p-3 text-left cursor-pointer hover:text-white/70 transition-colors"
                onClick={() => handleSort("stad")}
              >
                Stad
                <SortIcon col="stad" />
              </th>
              <th className="p-3 text-left">Grootte</th>
              <th className="p-3 text-left">Contact</th>
              <th
                className="p-3 text-left cursor-pointer hover:text-white/70 transition-colors"
                onClick={() => handleSort("status")}
              >
                Status
                <SortIcon col="status" />
              </th>
              <th className="p-3 text-left w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((lead) => {
              const statusBadge = getStatusBadge(lead.status);
              return (
                <tr
                  key={lead._id}
                  className={cn(
                    "border-t border-white/[0.04] hover:bg-white/[0.02] transition-colors",
                    selectedIds.has(lead._id) && "bg-[#31edae]/5"
                  )}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead._id)}
                      onChange={() => onToggleSelect(lead._id)}
                      className="accent-[#31edae] cursor-pointer"
                    />
                  </td>
                  <td className="p-3">
                    <span
                      className={cn(
                        "inline-flex px-2 py-0.5 rounded-md text-xs font-semibold",
                        getScoreColor(lead.leadScore)
                      )}
                    >
                      {lead.leadScore}
                    </span>
                  </td>
                  <td className="p-3 font-medium text-white">
                    {lead.bedrijfsnaam}
                  </td>
                  <td className="p-3 text-white/50 text-xs">
                    {lead.subCategorie || "-"}
                  </td>
                  <td className="p-3 text-white/50">{lead.stad || "-"}</td>
                  <td className="p-3 text-white/50 text-xs">
                    {lead.bedrijfsgrootte || "-"}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {lead.telefoon && (
                        <a
                          href={`tel:${lead.telefoon}`}
                          className="text-white/40 hover:text-[#31edae] transition-colors"
                          title={formatDutchPhone(lead.telefoon)}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {lead.email && (
                        <button
                          onClick={() => copyEmail(lead.email!)}
                          className="text-white/40 hover:text-[#31edae] transition-colors cursor-pointer"
                          title={lead.email}
                        >
                          {copiedEmail === lead.email ? (
                            <Check className="w-3.5 h-3.5 text-[#31edae]" />
                          ) : (
                            <Mail className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                      {lead.website && (
                        <a
                          href={
                            lead.website.startsWith("http")
                              ? lead.website
                              : `https://${lead.website}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white/40 hover:text-[#31edae] transition-colors"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    <select
                      value={lead.status}
                      onChange={(e) =>
                        updateStatus({ id: lead._id, status: e.target.value })
                      }
                      className={cn(
                        "text-xs font-medium px-2 py-1 rounded-md border-none outline-none cursor-pointer appearance-none",
                        statusBadge.color,
                        "bg-opacity-100"
                      )}
                    >
                      {STATUSES.map((s) => (
                        <option
                          key={s.value}
                          value={s.value}
                          className="bg-[#1e1e1e] text-white"
                        >
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => softDelete({ id: lead._id })}
                      className="text-white/20 hover:text-red-400 transition-colors cursor-pointer"
                      title="Verwijderen"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
