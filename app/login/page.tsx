"use client";

import { FormEvent, Suspense, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  assignmentsHomeForUserLevel,
  loginAndSync,
} from "@/lib/auth/pitch2Session";
import PrimaryButton from "@/components/ui/PrimaryButton";

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

/** Path relativo sicuro (stesso origin), es. da ?redirect= dopo invito. */
function safeInternalRedirect(raw: string | null): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//")) return null;
  return t;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const urlError = searchParams.get("error");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await loginAndSync(email, password, rememberMe);
      if (!result.ok) {
        setError(result.error || "Login non riuscito.");
        return;
      }

      // Se presente, onoriamo un redirect interno sicuro; altrimenti usiamo la home coerente col ruolo.
      const fromQuery = safeInternalRedirect(searchParams.get("redirect"));
      const fallback = assignmentsHomeForUserLevel(result.userLevel);
      router.replace(fromQuery ?? fallback);
    } catch (err) {
      console.error(err);
      setError("Errore di rete o imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-pitch-bg px-4">
      <div className="mx-auto w-full max-w-sm rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 shadow-lg">
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
            <label
              htmlFor="login-email"
              className="mb-1 block text-sm font-medium text-pitch-gray-light"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor={passwordId}
              className="mb-1 block text-sm font-medium text-pitch-gray-light"
            >
              Password
            </label>
            <div className="relative">
              <input
                id={passwordId}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark py-2 pl-3 pr-11 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-pitch-gray hover:text-pitch-gray-light"
                aria-label={
                  showPassword ? "Nascondi password" : "Mostra password"
                }
                title={showPassword ? "Nascondi password" : "Mostra password"}
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-5 w-5" />
                ) : (
                  <EyeIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-pitch-gray-light">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-pitch-gray-dark bg-pitch-gray-dark text-pitch-accent focus:ring-pitch-accent"
            />
            Ricordami su questo dispositivo
          </label>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <PrimaryButton
            type="submit"
            variant="primary"
            loading={loading}
            disabled={loading}
            className="min-h-[48px] w-full px-4 py-3"
          >
            {loading ? "Accesso in corso…" : "Accedi"}
          </PrimaryButton>
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
