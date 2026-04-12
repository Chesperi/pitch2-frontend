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
  permissions: StaffPagePermission[];
};

type StaffPagePermissionsResponse = {
  items: StaffPermissionsItem[];
};

type FinanceSelectValue = "default" | "allow" | "deny";

const PAGE_LABELS: Record<string, string> = {
  le_mie_assegnazioni: "My assignments",
  eventi: "Events",
  designazioni: "Assignments",
  accrediti: "Accreditations",
  call_sheet: "Call sheet",
  database: "Database",
  cookies_jar: "Cookies jar",
  consuntivo: "Summary",
  cronologia: "History",
  master: "Master",
};

function pageColumnLabel(pageKey: string): string {
  return PAGE_LABELS[pageKey] ?? pageKey;
}

const ACCESS_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: "none", label: "None" },
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
];

const FILTER_SELECT_CLASS =
  "min-w-[100px] rounded border border-pitch-gray-dark bg-pitch-gray-dark px-2 py-1.5 text-xs text-pitch-white focus:border-pitch-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

const FINANCE_SELECT_CLASS =
  "min-w-[130px] rounded border border-pitch-gray-dark bg-pitch-gray-dark px-2 py-1.5 text-xs text-pitch-white focus:border-pitch-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

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
  const [financeByStaff, setFinanceByStaff] = useState<
    Record<number, FinanceSelectValue>
  >({});

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

  const getFinanceValue = (staffId: number): FinanceSelectValue =>
    financeByStaff[staffId] ?? "default";

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

  const handleFinanceChange = async (
    staffId: number,
    value: FinanceSelectValue
  ) => {
    const current = getFinanceValue(staffId);
    if (current === value) return;

    const savingKey = `finance:${staffId}`;
    setActionError(null);
    setSaving(savingKey, true);

    const financeAccessOverride =
      value === "default" ? null : value === "allow" ? "allow" : "deny";

    setFinanceByStaff((prev) => ({ ...prev, [staffId]: value }));

    try {
      const res = await apiFetch(`/api/staff/${staffId}/finance-access`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financeAccessOverride }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res));
      }
    } catch (e) {
      setFinanceByStaff((prev) => ({ ...prev, [staffId]: "default" }));
      setActionError(
        e instanceof Error
          ? e.message
          : "Error saving financial access."
      );
    } finally {
      setSaving(savingKey, false);
    }
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
                <th className="sticky left-0 z-10 min-w-[200px] bg-pitch-gray-dark/40 px-3 py-2 text-left font-medium text-pitch-gray">
                  User
                </th>
                <th className="min-w-[140px] px-3 py-2 text-left font-medium text-pitch-gray">
                  Financial access
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
              {items.map((row) => (
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
                    <select
                      className={FINANCE_SELECT_CLASS}
                      value={getFinanceValue(row.staffId)}
                      onChange={(e) =>
                        handleFinanceChange(
                          row.staffId,
                          e.target.value as FinanceSelectValue
                        )
                      }
                      disabled={savingKeys.has(`finance:${row.staffId}`)}
                    >
                      <option value="default">Default</option>
                      <option value="allow">Allow</option>
                      <option value="deny">Deny</option>
                    </select>
                  </td>
                  {row.permissions.map((perm) => (
                    <td key={perm.pageKey} className="px-4 py-2 text-xs">
                      <select
                        className={FILTER_SELECT_CLASS}
                        value={perm.accessLevel}
                        onChange={(e) =>
                          handlePermissionChange(
                            row.staffId,
                            perm.pageKey,
                            e.target.value as AccessLevel
                          )
                        }
                        disabled={savingKeys.has(
                          `${row.staffId}:${perm.pageKey}`
                        )}
                      >
                        {ACCESS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
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
