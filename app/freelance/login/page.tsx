"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Legacy: /freelance/login ora reindirizza sempre al login unificato.
function FreelanceLoginRedirectInner() {
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

export default function FreelanceLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-pitch-bg">
          <p className="text-sm text-pitch-gray">Caricamento…</p>
        </main>
      }
    >
      <FreelanceLoginRedirectInner />
    </Suspense>
  );
}
