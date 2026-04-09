"use client";

import {
  FormEvent,
  Suspense,
  useEffect,
  useId,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api/config";
import { supabase } from "@/lib/supabaseClient";

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
      />
    </svg>
  );
}

function EyeSlashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m12.486 12.486L21 21M9.879 9.879a3 3 0 1 0 4.243 4.243M9.879 9.879 3 3m4.242 4.242 3 3"
      />
    </svg>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  autoComplete: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
};

function PasswordField({
  id,
  label,
  autoComplete,
  value,
  onChange,
  show,
  onToggleShow,
}: PasswordFieldProps) {
  const toggleLabel = show ? "Nascondi password" : "Mostra password";
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-pitch-gray-light"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark py-2 pl-3 pr-11 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-pitch-gray hover:text-pitch-gray-light"
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {show ? (
            <EyeSlashIcon className="h-5 w-5" />
          ) : (
            <EyeIcon className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  );
}

type ResetFlow = "backend" | "supabase" | null;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordId = useId();
  const confirmId = useId();

  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetFlow, setResetFlow] = useState<ResetFlow>(null);
  const [backendToken, setBackendToken] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

  async function handleSubmit(e: FormEvent) {
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
    <main className="flex min-h-screen items-center justify-center bg-pitch-bg px-4">
      <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-pitch-accent">PITCH</div>
          <p className="mt-2 text-sm text-pitch-gray">
            Imposta una nuova password per il tuo account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordField
            id={passwordId}
            label="Nuova password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            show={showPassword}
            onToggleShow={() => setShowPassword((s) => !s)}
          />
          <PasswordField
            id={confirmId}
            label="Conferma password"
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((s) => !s)}
          />

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
