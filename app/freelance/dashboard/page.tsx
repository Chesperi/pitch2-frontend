"use client";

import { Suspense } from "react";
import { useFreelanceContext } from "@/hooks/useFreelanceContext";

function FreelanceDashboardContent() {
  const { loading, error, staffIdFromToken, userStaffId } =
    useFreelanceContext();

  if (loading) return null;

  if (error) {
    return <div className="p-6 text-red-400">{error}</div>;
  }

  // staffId effettivo su cui filtrare
  const effectiveStaffId = staffIdFromToken ?? userStaffId;

  return (
    <div className="p-6 text-white">
      {/* Qui, usando effectiveStaffId, carica e mostra le designazioni di quella persona */}
      Dashboard freelance – staffId: {effectiveStaffId ?? "—"}
    </div>
  );
}

export default function FreelanceDashboardPage() {
  return (
    <Suspense fallback={null}>
      <FreelanceDashboardContent />
    </Suspense>
  );
}
