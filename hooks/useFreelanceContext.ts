"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { getApiBaseUrl } from "@/lib/api/config";

type FreelanceContext = {
  loading: boolean;
  error: string | null;
  staffIdFromToken: number | null;
  userStaffId: number | null;
};

export function useFreelanceContext(): FreelanceContext {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffIdFromToken, setStaffIdFromToken] = useState<number | null>(null);
  const [userStaffId, setUserStaffId] = useState<number | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    const run = async () => {
      try {
        let resolvedStaffId: number | null = null;

        // 1) risolvi token (se presente)
        if (token) {
          const res = await fetch(
            `${getApiBaseUrl()}/api/magic-links/resolve?token=${encodeURIComponent(token)}`
          );
          if (res.ok) {
            const data = (await res.json()) as { staffId: number };
            resolvedStaffId = data.staffId;
            setStaffIdFromToken(resolvedStaffId);
          } else {
            setError("Il link non è più valido.");
            setLoading(false);
            return;
          }
        }

        // 2) verifica utente Supabase
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          const loginUrl = token
            ? `/freelance/login?token=${encodeURIComponent(token)}`
            : "/freelance/login";
          window.location.href = loginUrl;
          return;
        }

        const supaStaffId =
          (data.user.user_metadata as Record<string, unknown>)?.staff_id ?? null;
        const metaStaffId =
          typeof supaStaffId === "number"
            ? supaStaffId
            : supaStaffId
              ? Number(supaStaffId)
              : null;
        setUserStaffId(metaStaffId);

        // 3) se c'è token e staffId non coincide, errore (ma utente è loggato)
        if (
          token &&
          resolvedStaffId != null &&
          metaStaffId != null &&
          resolvedStaffId !== metaStaffId
        ) {
          setError("Questo link non corrisponde al tuo account.");
        }
      } catch (e) {
        console.error(e);
        setError("Errore di autenticazione.");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [searchParams]);

  return { loading, error, staffIdFromToken, userStaffId };
}
