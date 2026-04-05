"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useFreelanceContext } from "@/hooks/useFreelanceContext";

function FreelanceDashboardContent() {
  const router = useRouter();
  const { loading, error, staffIdFromToken, userStaffId } =
    useFreelanceContext();
  const didRedirect = useRef(false);

  useEffect(() => {
    if (loading || error != null) return;
    if (didRedirect.current) return;
    didRedirect.current = true;

    const effectiveStaffId = staffIdFromToken ?? userStaffId;
    const hasStaff =
      effectiveStaffId != null && Number.isFinite(Number(effectiveStaffId));
    const qs = hasStaff
      ? `?staffId=${encodeURIComponent(String(effectiveStaffId))}`
      : "";
    router.replace(`/le-mie-assegnazioni${qs}`);
  }, [loading, error, staffIdFromToken, userStaffId, router]);

  if (error) {
    return <div className="p-6 text-red-400">{error}</div>;
  }

  return (
    <div className="p-6 text-sm text-neutral-400">
      Reindirizzamento in corso…
    </div>
  );
}

export default function FreelanceDashboardPage() {
  return (
    <Suspense fallback={
      <div className="p-6 text-sm text-neutral-400">Caricamento…</div>
    }>
      <FreelanceDashboardContent />
    </Suspense>
  );
}
