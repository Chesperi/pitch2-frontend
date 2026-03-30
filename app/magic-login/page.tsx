"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api/config";

export default function MagicLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBlockedMessage(null);

    if (!password) {
      setError("Inserisci la password");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password, rememberMe }),
      });

      if (res.status === 200) {
        router.push("/le-mie-assegnazioni");
        return;
      }

      const data = await res.json().catch(() => ({}));

      if (res.status === 400 || res.status === 401) {
        setError(data.error || "Password non valida");
      } else if (res.status === 429) {
        const seconds = data.retryAfterSeconds ?? 600;
        const minutes = Math.ceil(seconds / 60);
        setBlockedMessage(
          `Troppi tentativi di accesso. Riprova tra circa ${minutes} minuti.`
        );
      } else {
        setError("Errore inatteso. Riprova tra poco.");
      }
    } catch {
      setError("Errore di rete. Controlla la connessione.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pitch-bg">
      <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-pitch-accent">PITCH</div>
          <p className="mt-2 text-sm text-pitch-gray">
            Inserisci la tua password per accedere alle tue designazioni.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-pitch-gray-light">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-pitch-gray-light">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="rounded border-pitch-gray-dark bg-pitch-gray-dark text-pitch-accent focus:ring-pitch-accent"
              />
              Ricordami su questo dispositivo
            </label>

            <button
              type="button"
              className="text-sm text-pitch-accent hover:underline"
              onClick={() => router.push("/forgot-password")}
            >
              Hai dimenticato la password?
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {blockedMessage && (
            <p className="text-sm text-yellow-400">{blockedMessage}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-60"
          >
            {loading ? "Accesso in corso..." : "Accedi"}
          </button>
        </form>
      </div>
    </main>
  );
}
