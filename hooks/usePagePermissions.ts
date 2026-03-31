"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api/apiFetch";

export type PageAccessLevel = "none" | "view" | "edit";

export type MePermissionsResponse = {
  staffId: number;
  pagePermissions: { pageKey: string; accessLevel: PageAccessLevel }[];
};

/** pageKey (backend) → path dashboard */
export const PAGE_KEY_TO_ROUTE: Record<string, string> = {
  le_mie_assegnazioni: "/le-mie-assegnazioni",
  eventi: "/eventi",
  designazioni: "/designazioni",
  accrediti: "/accrediti",
  call_sheet: "/call-sheet",
  database: "/database",
  cookies_jar: "/cookies-jar",
  consuntivo: "/consuntivo",
  cronologia: "/cronologia",
  master: "/master",
};

export function usePagePermissions(): {
  loading: boolean;
  error: string | null;
  levelByPageKey: Record<string, PageAccessLevel>;
} {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelByPageKey, setLevelByPageKey] = useState<
    Record<string, PageAccessLevel>
  >({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/api/me/permissions", {
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text();
          let msg = `HTTP ${res.status}`;
          try {
            const j = JSON.parse(text) as { error?: string };
            if (j.error) msg = j.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        const data = (await res.json()) as MePermissionsResponse;
        if (cancelled) return;

        const map: Record<string, PageAccessLevel> = {};
        for (const p of data.pagePermissions ?? []) {
          if (
            p.pageKey &&
            (p.accessLevel === "none" ||
              p.accessLevel === "view" ||
              p.accessLevel === "edit")
          ) {
            map[p.pageKey] = p.accessLevel;
          }
        }
        setLevelByPageKey(map);
      } catch (e) {
        console.error("[usePagePermissions]", e);
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Errore permessi");
          setLevelByPageKey({});
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loading, error, levelByPageKey };
}
