"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  assignmentsHomeForUserLevel,
  fetchPitch2MeFromBrowser,
  pickUserLevel,
  postSupabaseSessionToBackend,
} from "@/lib/auth/pitch2Session";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const urlError = searchParams.get("error");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signErr) {
        setError(signErr.message);
        return;
      }

      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError("Sessione non disponibile dopo il login.");
        return;
      }

      const sessionRes = await postSupabaseSessionToBackend(accessToken);

      if (!sessionRes.ok) {
        const text = await sessionRes.text().catch(() => "");
        setError(text || `Errore server (${sessionRes.status})`);
        return;
      }

      const me = await fetchPitch2MeFromBrowser();
      if (!me.ok || !me.data) {
        setError("Impossibile recuperare il profilo. Riprova.");
        return;
      }

      const path = assignmentsHomeForUserLevel(pickUserLevel(me.data));
      router.replace(path);
    } catch (err) {
      console.error(err);
      setError("Errore di rete o imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pitch-bg px-4">
      <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-pitch-accent">PITCH</div>
          <p className="mt-2 text-sm text-pitch-gray">Accedi con email e password</p>
        </div>

        {urlError ? (
          <p className="mb-4 rounded border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            Accesso non completato ({urlError}). Riprova.
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-pitch-gray-light">
              Email
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-pitch-gray-light">
              Password
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
            />
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-60"
          >
            {loading ? "Accesso in corso…" : "Accedi"}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-pitch-gray">
          <Link href="/forgot-password" className="text-pitch-accent hover:underline">
            Hai dimenticato la password?
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-pitch-bg">
          <p className="text-sm text-pitch-gray">Caricamento…</p>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
