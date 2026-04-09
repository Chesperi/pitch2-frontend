"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/**
 * URL assoluto per il link nell’email Supabase (deve coincidere con una voce in
 * Authentication → Redirect URLs).
 * In produzione: NEXT_PUBLIC_SITE_URL=https://apppitch.it
 * → redirectTo esatto: https://apppitch.it/reset-password
 */
function getResetPasswordRedirectUrl(): string {
  const fromEnv =
    typeof process.env.NEXT_PUBLIC_SITE_URL === "string"
      ? process.env.NEXT_PUBLIC_SITE_URL.trim().replace(/\/+$/, "")
      : "";
  const origin =
    fromEnv ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "https://apppitch.it";
  const base = origin.replace(/\/+$/, "");
  return `${base}/reset-password`;
}

function isValidHttpOrHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Inserisci la tua email");
      return;
    }

    setLoading(true);
    try {
      const redirectTo = getResetPasswordRedirectUrl();

      if (!redirectTo || !isValidHttpOrHttpsUrl(redirectTo)) {
        setError(
          "URL di reindirizzamento non valido. Imposta NEXT_PUBLIC_SITE_URL con un indirizzo assoluto (es. https://apppitch.it) e verifica che corrisponda a Redirect URLs in Supabase."
        );
        return;
      }

      console.log("[forgot-password] resetPasswordForEmail", {
        email: trimmed,
        redirectTo,
      });

      const { error: supaError } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        { redirectTo }
      );

      if (supaError) {
        console.error("[forgot-password] resetPasswordForEmail error", supaError);
        setError(supaError.message || "Richiesta non riuscita.");
        return;
      }

      setMessage(
        "Se l’email è registrata in Supabase, riceverai a breve un link per reimpostare la password. Controlla anche lo spam."
      );
    } catch (err) {
      console.error("[forgot-password] resetPasswordForEmail catch", err);
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
            Inserisci la tua email per ricevere il link di reimpostazione.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-pitch-gray-light">
              Email
            </label>
            <input
              type="email"
              className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-green-400">{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-60"
          >
            {loading ? "Invio in corso..." : "Invia link"}
          </button>

          <button
            type="button"
            className="mt-2 w-full text-sm text-pitch-gray hover:underline"
            onClick={() => router.push("/login")}
          >
            Torna al login
          </button>
        </form>
      </div>
    </main>
  );
}
