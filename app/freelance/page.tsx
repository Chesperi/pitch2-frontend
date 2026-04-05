"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Punto d’ingresso /freelance (es. link con ?token=).
 * Reindirizza a /freelance/dashboard dove useFreelanceContext valida token/sessione,
 * poi la dashboard reindirizza a /le-mie-assegnazioni (con ?staffId= se noto).
 */
function FreelanceRedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const token = searchParams.get("token");
    const path = token
      ? `/freelance/dashboard?token=${encodeURIComponent(token)}`
      : "/freelance/dashboard";
    router.replace(path);
  }, [searchParams, router]);

  return (
    <div className="p-6 text-sm text-neutral-400">Reindirizzamento…</div>
  );
}

export default function FreelancePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-sm text-neutral-400">Caricamento…</div>
      }
    >
      <FreelanceRedirectContent />
    </Suspense>
  );
}
