"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api/config";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function validate() {
      if (!token) {
        setError("Token mancante o non valido.");
        setValidating(false);
        return;
      }
      try {
        const res = await fetch(
          `${getApiBaseUrl()}/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`
        );
        const data = await res.json().catch(() => ({}));
        if (data.valid) {
          setValid(true);
        } else {
          setError(data.error || "Link non valido o scaduto.");
        }
      } catch {
        setError("Errore di rete durante la validazione del link.");
      } finally {
        setValidating(false);
      }
    }
    validate();
  }, [token]);

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
    if (!token) {
      setSubmitError("Token non valido.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
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
