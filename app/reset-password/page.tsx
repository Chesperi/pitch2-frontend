"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api/config";
import { supabase } from "@/lib/supabaseClient";

type ResetFlow = "backend" | "supabase" | null;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetFlow, setResetFlow] = useState<ResetFlow>(null);
  const [backendToken, setBackendToken] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const code = searchParams.get("code");
    const token = searchParams.get("token");
    let timer: ReturnType<typeof setTimeout> | undefined;
    let subscription: { unsubscribe: () => void } | undefined;

    (async () => {
      if (code) {
        const { error: exErr } = await supabase.auth.exchangeCodeForSession(
          code
        );
        if (cancelled) return;
        if (exErr) {
          setError(exErr.message);
          setValid(false);
        } else {
          setValid(true);
          setResetFlow("supabase");
        }
        setValidating(false);
        return;
      }

      if (token) {
        try {
          const res = await fetch(
            `${getApiBaseUrl()}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`
          );
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (data.valid) {
            setValid(true);
            setResetFlow("backend");
            setBackendToken(token);
          } else {
            setError(data.error || "Link non valido o scaduto.");
          }
        } catch {
          if (!cancelled) {
            setError("Errore di rete durante la validazione del link.");
          }
        } finally {
          if (!cancelled) setValidating(false);
        }
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionData.session?.user) {
        setValid(true);
        setResetFlow("supabase");
        setValidating(false);
        return;
      }

      const { data: subData } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (cancelled || !session?.user) return;
          if (
            event === "PASSWORD_RECOVERY" ||
            event === "SIGNED_IN" ||
            event === "INITIAL_SESSION"
          ) {
            setValid(true);
            setResetFlow("supabase");
            setValidating(false);
          }
        }
      );
      subscription = subData.subscription;

      timer = setTimeout(async () => {
        if (cancelled) return;
        const { data: again } = await supabase.auth.getSession();
        if (cancelled) return;
        if (again.session?.user) {
          setValid(true);
          setResetFlow("supabase");
        } else {
          setError(
            "Link non valido o scaduto. Apri il link dall’email di Supabase oppure richiedine uno nuovo da «Hai dimenticato la password?»."
          );
          setValid(false);
        }
        setValidating(false);
      }, 2500);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      subscription?.unsubscribe();
    };
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setSubmitMessage(null);

    if (!password || password.length < 8) {
      setSubmitError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setSubmitError("Le password non coincidono.");
      return;
    }

    if (resetFlow === "backend" && !backendToken) {
      setSubmitError("Token non valido.");
      return;
    }
    if (resetFlow !== "backend" && resetFlow !== "supabase") {
      setSubmitError("Sessione di reset non disponibile. Richiedi un nuovo link.");
      return;
    }

    setLoading(true);
    try {
      if (resetFlow === "supabase") {
        const { error: upErr } = await supabase.auth.updateUser({
          password,
        });
        if (upErr) {
          setSubmitError(upErr.message || "Impossibile aggiornare la password.");
          return;
        }
        setSubmitMessage("Password aggiornata. Reindirizzamento al login…");
        setTimeout(() => router.push("/login"), 1500);
        return;
      }

      const res = await fetch(`${getApiBaseUrl()}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: backendToken, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success) {
        setSubmitMessage("Password aggiornata con successo. Reindirizzamento...");
        setTimeout(() => router.push("/le-mie-assegnazioni"), 1500);
      } else {
        setSubmitError(data.error || "Impossibile aggiornare la password.");
      }
    } catch {
      setSubmitError("Errore di rete. Riprova tra poco.");
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-pitch-bg">
        <p className="text-sm text-pitch-gray">Verifica del link...</p>
      </div>
    );
  }

  if (!valid) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-pitch-bg">
        <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 shadow-lg">
          <p className="text-sm text-red-400">
            {error || "Link non valido o scaduto."}
          </p>
          <button
            type="button"
            className="mt-4 text-sm text-pitch-accent hover:underline"
            onClick={() => router.push("/forgot-password")}
          >
            Richiedi un nuovo link
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pitch-bg">
      <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-pitch-accent">PITCH</div>
          <p className="mt-2 text-sm text-pitch-gray">
            Imposta una nuova password per il tuo account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-pitch-gray-light">
              Nuova password
            </label>
            <input
              type="password"
              className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-pitch-gray-light">
              Conferma password
            </label>
            <input
              type="password"
              className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-400">{submitError}</p>
          )}
          {submitMessage && (
            <p className="text-sm text-green-400">{submitMessage}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-60"
          >
            {loading ? "Salvataggio..." : "Salva nuova password"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-pitch-bg">
          <p className="text-sm text-pitch-gray">Caricamento...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
