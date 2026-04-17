"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api/apiFetch";

type AccessLevel = "none" | "view" | "edit";

type StaffPagePermission = {
  pageKey: string;
  accessLevel: AccessLevel;
};

type StaffPermissionsItem = {
  staffId: number;
  name: string;
  email: string;
  userLevel: string;
  financeVisibility: "HIDDEN" | "VISIBLE";
  permissions: StaffPagePermission[];
};

type StaffPagePermissionsResponse = {
  items: StaffPermissionsItem[];
};

const PAGE_KEY_LABELS: Record<string, string> = {
  le_mie_assegnazioni: "My assignments",
  eventi: "Events",
  designazioni: "Designations",
  accrediti: "Accreditations",
  call_sheet: "Call sheet",
  database: "Database",
  cookies_jar: "Cookies jar",
  consuntivo: "Scorecard",
  cronologia: "History",
  master: "Master",
};

function pageColumnLabel(pageKey: string): string {
  return PAGE_KEY_LABELS[pageKey] ?? pageKey;
}

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `Error ${res.status}`;
  } catch {
    return `Error ${res.status}`;
  }
}

export default function MasterPage() {
  const [items, setItems] = useState<StaffPermissionsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingKeys, setSavingKeys] = useState<Set<string>>(() => new Set());
  const setSaving = useCallback((key: string, on: boolean) => {
    setSavingKeys((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiFetch("/api/staff-page-permissions", {
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
      const data = (await res.json()) as StaffPagePermissionsResponse;
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Unable to load permissions."
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pageKeysOrdered = useMemo(() => {
    if (items.length === 0) return [];
    return items[0].permissions.map((p) => p.pageKey);
  }, [items]);

  const isSystemMaster = (item: StaffPermissionsItem): boolean =>
    item.userLevel === "MASTER" && item.name.trim().toUpperCase() === "ANDRISANO ANDREA";

  const nextAccessLevel = (value: AccessLevel): AccessLevel => {
    if (value === "none") return "view";
    if (value === "view") return "edit";
    return "none";
  };

  const handlePermissionChange = async (
    staffId: number,
    pageKey: string,
    next: AccessLevel
  ) => {
    const row = items.find((r) => r.staffId === staffId);
    const prev =
      row?.permissions.find((p) => p.pageKey === pageKey)?.accessLevel ??
      "none";
    if (prev === next) return;

    const prevItems = items;
    const savingKey = `${staffId}:${pageKey}`;
    setActionError(null);
    setSaving(savingKey, true);

    setItems((current) =>
      current.map((r) =>
        r.staffId !== staffId
          ? r
          : {
              ...r,
              permissions: r.permissions.map((p) =>
                p.pageKey === pageKey ? { ...p, accessLevel: next } : p
              ),
            }
      )
    );

    try {
      const res = await apiFetch("/api/staff-page-permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, pageKey, accessLevel: next }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
    } catch (e) {
      setItems(prevItems);
      setActionError(
        e instanceof Error
          ? e.message
          : "Error saving permissions."
      );
    } finally {
      setSaving(savingKey, false);
    }
  };

  const handleFinanceToggle = async (
    staffId: number,
    currentVisibility: "HIDDEN" | "VISIBLE"
  ) => {
    const nextVisibility = currentVisibility === "VISIBLE" ? "HIDDEN" : "VISIBLE";

    const savingKey = `finance:${staffId}`;
    setActionError(null);
    setSaving(savingKey, true);

    const prevItems = items;
    setItems((current) =>
      current.map((row) =>
        row.staffId === staffId
          ? { ...row, financeVisibility: nextVisibility }
          : row
      )
    );

    try {
      const res = await apiFetch(`/api/staff/${staffId}/finance-access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          financeAccessOverride: nextVisibility === "VISIBLE" ? "allow" : "deny",
        }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
    } catch (e) {
      setItems(prevItems);
      setActionError(
        e instanceof Error
          ? e.message
          : "Error saving financial access."
      );
    } finally {
      setSaving(savingKey, false);
    }
  };

  const levelRank: Record<string, number> = {
    MASTER: 0,
    MANAGER: 1,
    STAFF: 2,
    FREELANCE: 3,
    PROVIDER: 4,
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const ra = levelRank[a.userLevel] ?? 99;
      const rb = levelRank[b.userLevel] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name, "it");
    });
  }, [items]);

  const userLevelBadgeClass = (level: string): string => {
    const up = level.toUpperCase();
    if (up === "MASTER") return "bg-[#FFFA00] text-black";
    if (up === "MANAGER") return "bg-orange-500 text-black";
    if (up === "STAFF") return "bg-gray-300 text-black";
    if (up === "FREELANCE") return "bg-gray-700 text-white";
    if (up === "PROVIDER") return "bg-blue-500 text-white";
    return "bg-pitch-gray-dark text-pitch-white";
  };

  const accessCellClass = (value: AccessLevel): string => {
    if (value === "edit") {
      return "border-pitch-accent bg-pitch-accent/20 text-pitch-accent";
    }
    if (value === "view") {
      return "border-blue-400/60 bg-blue-500/10 text-blue-300";
    }
    return "border-pitch-gray-dark bg-pitch-gray-dark/30 text-pitch-gray";
  };

  return (
    <>
      <PageHeader title="Master permissions" />

      {loadError ? (
        <p className="mt-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-pitch-gray">Loading…</p>
      ) : null}

      {!loading && !loadError && items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-center text-sm text-pitch-gray">
          No active staff to configure.
        </div>
      ) : null}

      {!loading && !loadError && items.length > 0 ? (
        <>
          {actionError ? (
            <p className="mt-2 text-xs text-red-300">{actionError}</p>
          ) : null}
          <div className="mt-6 overflow-x-auto rounded-lg border border-pitch-gray-dark">
          <table className="w-full min-w-max border-collapse text-xs">
            <thead>
              <tr className="border-b border-pitch-gray-dark bg-pitch-gray-dark/30">
                <th className="sticky left-0 z-10 min-w-[220px] bg-pitch-gray-dark/40 px-3 py-2 text-left font-medium text-pitch-gray">
                  Full name
                </th>
                <th className="min-w-[120px] px-3 py-2 text-left font-medium text-pitch-gray">
                  User level
                </th>
                <th className="min-w-[160px] px-3 py-2 text-left font-medium text-pitch-gray">
                  Finance visibility
                </th>
                {pageKeysOrdered.map((pk) => (
                  <th
                    key={pk}
                    className="min-w-[120px] px-3 py-2 text-left font-medium text-pitch-gray"
                  >
                    {pageColumnLabel(pk)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((row) => (
                <tr
                  key={row.staffId}
                  className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/10"
                >
                  <td className="sticky left-0 z-10 bg-pitch-bg px-3 py-2 align-top">
                    <div className="font-medium text-pitch-white">
                      {row.name}
                    </div>
                    <div className="text-[11px] text-pitch-gray">
                      {row.email || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${userLevelBadgeClass(
                        row.userLevel
                      )}`}
                    >
                      {row.userLevel}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <button
                      type="button"
                      onClick={() =>
                        handleFinanceToggle(row.staffId, row.financeVisibility)
                      }
                      disabled={
                        isSystemMaster(row) || savingKeys.has(`finance:${row.staffId}`)
                      }
                      className={`inline-flex min-w-[120px] items-center justify-center rounded border px-2 py-1.5 text-xs font-semibold transition ${
                        row.financeVisibility === "VISIBLE"
                          ? "border-pitch-accent bg-pitch-accent/20 text-pitch-accent"
                          : "border-pitch-gray-dark bg-pitch-gray-dark/30 text-pitch-gray"
                      } ${
                        isSystemMaster(row)
                          ? "cursor-not-allowed opacity-50"
                          : "hover:opacity-90"
                      }`}
                    >
                      {row.financeVisibility}
                    </button>
                  </td>
                  {row.permissions.map((perm) => (
                    <td key={perm.pageKey} className="px-4 py-2 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          handlePermissionChange(
                            row.staffId,
                            perm.pageKey,
                            nextAccessLevel(perm.accessLevel)
                          )
                        }
                        disabled={
                          isSystemMaster(row) ||
                          savingKeys.has(`${row.staffId}:${perm.pageKey}`)
                        }
                        className={`inline-flex min-w-[90px] items-center justify-center rounded border px-2 py-1.5 text-xs font-semibold transition ${accessCellClass(
                          perm.accessLevel
                        )} ${
                          isSystemMaster(row)
                            ? "cursor-not-allowed opacity-50"
                            : "hover:opacity-90"
                        }`}
                      >
                        {perm.accessLevel === "none" ? "—" : perm.accessLevel}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      ) : null}

    </>
  );
}
