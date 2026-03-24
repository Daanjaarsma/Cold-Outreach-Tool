import { useState, useMemo, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import {
  ChevronUp,
  ChevronDown,
  Plus,
  Phone,
  Mail,
  Globe,
  Copy,
  Check,
  Download,
  Trash2,
  X,
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

function ContactPopup({
  lead,
  onClose,
}: {
  lead: Lead;
  onClose: () => void;
}) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const hasContact = lead.telefoon || lead.email || lead.website;

  return (
    <div
      ref={popupRef}
      className="absolute z-50 top-full right-0 mt-1 bg-[#2a2a2a] border border-white/[0.1] rounded-xl p-4 shadow-xl min-w-[280px]"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">
          Contactgegevens
        </p>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/60 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {!hasContact && (
        <p className="text-xs text-white/30">Geen contactgegevens beschikbaar</p>
      )}

      <div className="flex flex-col gap-2.5">
        {lead.telefoon && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Phone className="w-3.5 h-3.5 text-[#31edae] shrink-0" />
              <a
                href={`tel:${lead.telefoon}`}
                className="text-sm text-white hover:text-[#31edae] transition-colors truncate"
              >
                {formatDutchPhone(lead.telefoon)}
              </a>
            </div>
            <button
              onClick={() => copyToClipboard(lead.telefoon!, "telefoon")}
              className="text-white/30 hover:text-white/60 transition-colors cursor-pointer shrink-0"
              title="Kopieer telefoonnummer"
            >
              {copiedField === "telefoon" ? (
                <Check className="w-3.5 h-3.5 text-[#31edae]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}

        {lead.email && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Mail className="w-3.5 h-3.5 text-[#31edae] shrink-0" />
              <span className="text-sm text-white truncate">{lead.email}</span>
            </div>
            <button
              onClick={() => copyToClipboard(lead.email!, "email")}
              className="text-white/30 hover:text-white/60 transition-colors cursor-pointer shrink-0"
              title="Kopieer e-mailadres"
            >
              {copiedField === "email" ? (
                <Check className="w-3.5 h-3.5 text-[#31edae]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}

        {lead.website && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Globe className="w-3.5 h-3.5 text-[#31edae] shrink-0" />
              <a
                href={
                  lead.website.startsWith("http")
                    ? lead.website
                    : `https://${lead.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-white hover:text-[#31edae] transition-colors truncate"
              >
                {lead.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            </div>
            <button
              onClick={() => copyToClipboard(lead.website!, "website")}
              className="text-white/30 hover:text-white/60 transition-colors cursor-pointer shrink-0"
              title="Kopieer website URL"
            >
              {copiedField === "website" ? (
                <Check className="w-3.5 h-3.5 text-[#31edae]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
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
  const [openContactId, setOpenContactId] = useState<string | null>(null);

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
                    <div className="relative">
                      <button
                        onClick={() =>
                          setOpenContactId(
                            openContactId === lead._id ? null : lead._id
                          )
                        }
                        className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer",
                          openContactId === lead._id
                            ? "bg-[#31edae] text-black"
                            : "bg-white/[0.06] text-white/40 hover:bg-white/[0.12] hover:text-white/70"
                        )}
                        title="Contactgegevens bekijken"
                      >
                        <Plus
                          className={cn(
                            "w-3.5 h-3.5 transition-transform",
                            openContactId === lead._id && "rotate-45"
                          )}
                        />
                      </button>
                      {openContactId === lead._id && (
                        <ContactPopup
                          lead={lead}
                          onClose={() => setOpenContactId(null)}
                        />
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
