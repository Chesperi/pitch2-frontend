"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";

function FreelanceRedirectContent() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const redirectUrl = token
      ? `/freelance/dashboard?token=${encodeURIComponent(token)}`
      : "/freelance/dashboard";
    window.location.href = redirectUrl;
  }, [searchParams]);

  return null;
}

export default function FreelancePage() {
  return (
    <Suspense fallback={null}>
      <FreelanceRedirectContent />
    </Suspense>
  );
}
