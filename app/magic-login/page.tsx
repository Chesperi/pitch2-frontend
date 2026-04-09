"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy: /magic-login non è più la pagina di login staff.
 * Reindirizza a /login mantenendo la query string (es. ?redirect=… da vecchi bookmark).
 */
function MagicLoginRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(qs ? `/login?${qs}` : "/login");
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-pitch-bg px-4">
      <p className="text-sm text-pitch-gray">
        Reindirizzamento alla pagina di accesso…
      </p>
    </main>
  );
}

export default function MagicLoginLegacyRedirectPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-pitch-bg">
          <p className="text-sm text-pitch-gray">Caricamento…</p>
        </main>
      }
    >
      <MagicLoginRedirectInner />
    </Suspense>
  );
}
