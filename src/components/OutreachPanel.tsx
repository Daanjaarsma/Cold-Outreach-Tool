import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { Send, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

const OUTREACH_URL = "/api/send-outreach";

type Lead = Doc<"leads">;

interface OutreachPanelProps {
  selectedLeads: Lead[];
  onDone: () => void;
}

export function OutreachPanel({ selectedLeads, onDone }: OutreachPanelProps) {
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);

  const markBenaderd = useMutation(api.leads.markBenaderd);

  const outreachLeads = selectedLeads.filter(
    (l) => l.email && (l.sector === "e-commerce" || l.sector === "recruitment")
  );

  if (outreachLeads.length === 0) return null;

  const handleSend = async () => {
    setIsSending(true);
    setResult(null);

    try {
      const payload = {
        leads: outreachLeads.map((l) => ({
          bedrijfsnaam: l.bedrijfsnaam,
          email: l.email,
          website: l.website || "",
          stad: l.stad || "",
          categorie: l.categorie,
          subCategorie: l.subCategorie || "",
          telefoon: l.telefoon || "",
        })),
      };

      const response = await fetch(OUTREACH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        // Markeer leads als benaderd in Convex
        await markBenaderd({
          ids: outreachLeads.map((l) => l._id),
        });

        setResult({
          status: "success",
          message: `${outreachLeads.length} outreach email${outreachLeads.length !== 1 ? "s" : ""} verstuurd`,
        });
        setTimeout(() => {
          onDone();
          setResult(null);
        }, 3000);
      } else {
        setResult({
          status: "error",
          message: `Fout bij versturen (HTTP ${response.status})`,
        });
      }
    } catch {
      setResult({
        status: "error",
        message: "Verbindingsfout — controleer de webhook",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-[#31edae]/10">
          <Send className="w-5 h-5 text-[#31edae]" />
        </div>
        <div>
          <p className="text-sm font-medium text-white">
            {outreachLeads.length} lead
            {outreachLeads.length !== 1 ? "s" : ""} geselecteerd met email
          </p>
          <p className="text-xs text-white/40">
            Gepersonaliseerde emails worden gegenereerd met AI en verstuurd via Resend
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {result && (
          <div
            className={`flex items-center gap-1.5 text-sm ${
              result.status === "success" ? "text-[#31edae]" : "text-red-400"
            }`}
          >
            {result.status === "success" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {result.message}
          </div>
        )}

        <button
          onClick={handleSend}
          disabled={isSending}
          className="px-5 py-2.5 rounded-xl bg-[#31edae] text-black font-semibold hover:bg-[#28c896] transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Versturen...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Verstuur Cold Outreach
            </>
          )}
        </button>
      </div>
    </div>
  );
}
