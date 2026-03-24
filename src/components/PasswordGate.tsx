import { useState } from "react";
import { Lock } from "lucide-react";

const PASSWORD = "praedix2026";

export function PasswordGate({ onAuth }: { onAuth: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value === PASSWORD) {
      sessionStorage.setItem("praedix_outreach_auth", "true");
      onAuth();
    } else {
      setError(true);
      setTimeout(() => setError(false), 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white/[0.03] border border-white/[0.06] rounded-2xl p-8 flex flex-col items-center gap-6"
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 100 100" fill="none">
            <path
              d="M20 80V20h30c16.57 0 30 13.43 30 30s-13.43 30-30 30H20z"
              fill="#31edae"
            />
            <path d="M20 80V50h30c0 16.57-13.43 30-30 30z" fill="#28c896" />
          </svg>
          <span className="text-xl font-semibold text-white">
            Praedix <span className="text-white/40 font-normal">Lead Outreach</span>
          </span>
        </div>

        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Lock className="w-4 h-4" />
          <span>Voer het wachtwoord in om toegang te krijgen</span>
        </div>

        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Wachtwoord"
          className={`w-full px-4 py-3 rounded-xl bg-white/[0.06] border text-white placeholder-white/30 outline-none transition-colors ${
            error
              ? "border-red-500/50 bg-red-500/5"
              : "border-white/[0.06] focus:border-[#31edae]"
          }`}
          autoFocus
        />

        {error && (
          <p className="text-red-400 text-sm -mt-4">Onjuist wachtwoord</p>
        )}

        <button
          type="submit"
          className="w-full py-3 rounded-xl bg-[#31edae] text-black font-semibold hover:bg-[#28c896] transition-colors cursor-pointer"
        >
          Inloggen
        </button>
      </form>
    </div>
  );
}
