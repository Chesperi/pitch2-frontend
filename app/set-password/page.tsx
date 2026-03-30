"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  assignmentsHomeForUserLevel,
  fetchPitch2MeFromBrowser,
  pickUserLevel,
  postSupabaseSessionToBackend,
} from "@/lib/auth/pitch2Session";

/**
 * Utente già autenticato su Supabase (sessione browser dopo magic link).
 * TODO: opzionale — se l’utente non ha sessione Supabase, redirect a /login.
 */
export default function SetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    setLoading(true);
    try {
      const { error: upErr } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (upErr) {
        setError(upErr.message);
        return;
      }

      const { data: after } = await supabase.auth.getSession();
      const s = after.session;
      if (!s?.access_token) {
        setError("Sessione non disponibile dopo l’aggiornamento. Accedi di nuovo.");
        return;
      }

      const sessionRes = await postSupabaseSessionToBackend(s.access_token);

      if (!sessionRes.ok) {
        setError("Impossibile sincronizzare la sessione con il server. Riprova.");
        return;
      }

      const me = await fetchPitch2MeFromBrowser();
      if (!me.ok || !me.data) {
        router.replace("/login?error=me");
        return;
      }

      const path = assignmentsHomeForUserLevel(pickUserLevel(me.data));
      router.replace(path);
    } catch (err) {
      console.error(err);
      setError("Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pitch-bg px-4">
      <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 shadow-lg">
        <h1 className="text-center text-xl font-bold text-pitch-accent">Imposta password</h1>
        <p className="mt-2 text-center text-sm text-pitch-gray">
          Scegli una password per i prossimi accessi da questo o altri dispositivi.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm text-pitch-gray-light">Nuova password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-pitch-gray-light">Conferma password</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-60"
          >
            {loading ? "Salvataggio…" : "Salva e continua"}
          </button>
        </form>
      </div>
    </main>
  );
}
