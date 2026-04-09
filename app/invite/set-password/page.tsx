"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useId,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api/config";

const MIN_LEN = 8;

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

function InviteSetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectAfterLogin = searchParams.get("redirect");

  const passwordId = useId();
  const confirmId = useId();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const buildLoginHref = useCallback(() => {
    const q = redirectAfterLogin?.trim()
      ? `?redirect=${encodeURIComponent(redirectAfterLogin.trim())}`
      : "";
    return `/login${q}`;
  }, [redirectAfterLogin]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_LEN) {
      setError(`La password deve avere almeno ${MIN_LEN} caratteri`);
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${getApiBaseUrl()}/api/auth/invite/set-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            password,
            confirmPassword,
          }),
        }
      );

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };

      if (res.status === 401) {
        setError(
          data.error ||
            "Sessione invito scaduta o non valida. Apri di nuovo il link dall’email."
        );
        return;
      }
      if (res.status === 403) {
        setError(data.error || "Accesso non consentito.");
        return;
      }
      if (!res.ok) {
        setError(
          data.error || `Operazione non riuscita (${res.status}). Riprova.`
        );
        return;
      }

      router.replace(buildLoginHref());
    } catch {
      setError("Errore di rete. Controlla la connessione.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pitch-bg px-4">
      <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 shadow-lg">
        <div className="mb-6 text-center">
          <div className="text-2xl font-bold text-pitch-accent">PITCH</div>
          <p className="mt-2 text-sm text-pitch-gray">
            Crea la tua password per completare l’accesso al gestionale.
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
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((s) => !s)}
          />

          {error ? (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-60"
          >
            {loading ? "Salvataggio…" : "Conferma"}
          </button>
        </form>
      </div>
    </main>
  );
}

export default function InviteSetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-pitch-bg">
          <p className="text-sm text-pitch-gray">Caricamento…</p>
        </main>
      }
    >
      <InviteSetPasswordContent />
    </Suspense>
  );
}
