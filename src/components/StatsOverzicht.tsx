import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Users, Mail, Send, MessageSquare } from "lucide-react";

export function StatsOverzicht() {
  const stats = useQuery(api.leads.stats);

  const cards = [
    {
      label: "Totaal leads",
      value: stats?.totaal ?? 0,
      icon: Users,
      color: "text-white",
    },
    {
      label: "Met e-mail",
      value: stats?.metEmail ?? 0,
      icon: Mail,
      color: "text-[#31edae]",
    },
    {
      label: "Benaderd",
      value: stats?.benaderd ?? 0,
      icon: Send,
      color: "text-blue-400",
    },
    {
      label: "Geantwoord",
      value: stats?.geantwoord ?? 0,
      icon: MessageSquare,
      color: "text-green-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-center gap-3"
        >
          <div className={`p-2 rounded-lg bg-white/[0.04] ${card.color}`}>
            <card.icon className="w-5 h-5" />
          </div>
          <div className="text-left">
            <p className="text-2xl font-semibold text-white">{card.value}</p>
            <p className="text-xs text-white/40">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
