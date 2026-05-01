"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { apiFetch } from "@/lib/api/apiFetch";
import { updateStaff } from "@/lib/api/staff";
import { fetchDistinctTeamNames } from "@/lib/api/shifts";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import PageLoading from "@/components/ui/PageLoading";
import DesktopRecommended from "@/components/ui/DesktopRecommended";

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
  shiftsManagement: boolean;
  managedTeams: string[];
  sergioAccess: boolean;
  permissions: StaffPagePermission[];
};

type StaffPagePermissionsResponse = {
  items: StaffPermissionsItem[];
};

const PAGE_KEY_LABELS: Record<string, string> = {
  le_mie_assegnazioni: "Le mie ass.",
  eventi: "Events",
  vision: "Vision",
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
  const [teamNameOptions, setTeamNameOptions] = useState<string[]>([]);
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

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const t = await fetchDistinctTeamNames();
        if (!c) setTeamNameOptions(t);
      } catch {
        if (!c) setTeamNameOptions([]);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const pageKeysOrdered = useMemo(() => {
    if (items.length === 0) return [];
    return items[0].permissions.map((p) => p.pageKey);
  }, [items]);

  const isSystemMaster = (item: StaffPermissionsItem): boolean =>
    String(item.userLevel ?? "").toUpperCase() === "MASTER";

  const isFreelanceOrProvider = (item: StaffPermissionsItem): boolean => {
    const u = String(item.userLevel ?? "").toUpperCase();
    return u === "FREELANCE" || u === "PROVIDER";
  };

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
    if (row && (isSystemMaster(row) || isFreelanceOrProvider(row))) return;
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

  const handleShiftsToggle = async (
    staffId: number,
    current: boolean
  ) => {
    const row = items.find((r) => r.staffId === staffId);
    if (row && (isSystemMaster(row) || isFreelanceOrProvider(row))) return;

    const next = !current;
    const savingKey = `shifts:${staffId}`;
    setActionError(null);
    setSaving(savingKey, true);

    const prevItems = items;
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.staffId === staffId
          ? {
              ...item,
              shiftsManagement: next,
              managedTeams: next ? item.managedTeams : [],
            }
          : item
      )
    );

    try {
      await updateStaff(staffId, {
        shiftsManagement: next,
        managedTeams: next ? row?.managedTeams ?? [] : [],
      });
    } catch (e) {
      setItems(prevItems);
      setActionError(
        e instanceof Error ? e.message : "Errore salvataggio turni."
      );
    } finally {
      setSaving(savingKey, false);
    }
  };

  const handleManagedTeamsChange = async (
    staffId: number,
    teams: string[]
  ) => {
    const row = items.find((r) => r.staffId === staffId);
    if (row && (isSystemMaster(row) || isFreelanceOrProvider(row))) return;

    const savingKey = `shiftsTeams:${staffId}`;
    setActionError(null);
    setSaving(savingKey, true);

    const prevItems = items;
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.staffId === staffId
          ? { ...item, managedTeams: teams }
          : item
      )
    );

    try {
      await updateStaff(staffId, {
        shiftsManagement: true,
        managedTeams: teams,
      });
    } catch (e) {
      setItems(prevItems);
      setActionError(
        e instanceof Error ? e.message : "Errore salvataggio team gestiti."
      );
    } finally {
      setSaving(savingKey, false);
    }
  };

  const handleSergioToggle = async (staffId: number, current: boolean) => {
    const row = items.find((r) => r.staffId === staffId);
    if (row && (isSystemMaster(row) || isFreelanceOrProvider(row))) return;

    const next = !current;
    const savingKey = `sergio:${staffId}`;
    setActionError(null);
    setSaving(savingKey, true);

    const prevItems = items;
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.staffId === staffId ? { ...item, sergioAccess: next } : item
      )
    );

    try {
      await updateStaff(staffId, { sergioAccess: next });
    } catch (e) {
      setItems(prevItems);
      setActionError(
        e instanceof Error ? e.message : "Error saving Sergio access."
      );
    } finally {
      setSaving(savingKey, false);
    }
  };

  const handleFinanceToggle = async (
    staffId: number,
    currentVisibility: "HIDDEN" | "VISIBLE"
  ) => {
    const row = items.find((r) => r.staffId === staffId);
    if (row && (isSystemMaster(row) || isFreelanceOrProvider(row))) return;

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
      <PageHeader title="Permessi Master" />
      <DesktopRecommended />

      {loadError ? (
        <p className="mt-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
          {loadError}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
          <PageLoading />
        </div>
      ) : null}

      {!loading && !loadError && items.length === 0 ? (
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-6 text-center text-sm text-pitch-gray">
          Nessuno staff attivo da configurare.
        </div>
      ) : null}

      {!loading && !loadError && items.length > 0 ? (
        <>
          {actionError ? (
            <p className="mt-2 text-xs text-red-300">{actionError}</p>
          ) : null}
          <ResponsiveTable
            className="mt-6 rounded-lg border border-pitch-gray-dark"
            minWidth="900px"
          >
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-pitch-gray-dark bg-[#0d0d0d]">
                <th className="sticky left-0 z-10 min-w-[160px] whitespace-nowrap bg-[#0d0d0d] px-3 py-2 text-left font-medium text-pitch-gray">
                  Nome
                </th>
                <th className="min-w-[120px] whitespace-nowrap bg-[#0d0d0d] px-3 py-2 text-left font-medium text-pitch-gray">
                  User level
                </th>
                <th className="min-w-[160px] whitespace-nowrap bg-[#0d0d0d] px-3 py-2 text-left font-medium text-pitch-gray">
                  Visib. finanziaria
                </th>
                <th className="min-w-[200px] whitespace-nowrap bg-[#0d0d0d] px-3 py-2 text-left font-medium text-pitch-gray">
                  Turni
                </th>
                <th className="min-w-[120px] whitespace-nowrap bg-[#0d0d0d] px-3 py-2 text-left font-medium text-pitch-gray">
                  Sergio
                </th>
                {pageKeysOrdered.map((pk) => (
                  <th
                    key={pk}
                    className="min-w-[120px] whitespace-nowrap px-3 py-2 text-left font-medium text-pitch-gray"
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
                  <td className="sticky left-0 z-10 min-w-[160px] whitespace-nowrap bg-pitch-bg px-3 py-2 align-top">
                    <div className="font-medium text-pitch-white">
                      {row.name}
                    </div>
                    {isFreelanceOrProvider(row) ? (
                      <div className="mt-1 text-xs text-pitch-gray">
                        Permissions not applicable
                      </div>
                    ) : null}
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
                  <td className="whitespace-nowrap px-4 py-2 text-xs align-top">
                    {(() => {
                      const masterRow = isSystemMaster(row);
                      const restrictedRow = isFreelanceOrProvider(row);
                      const financeChecked = masterRow
                        ? true
                        : restrictedRow
                          ? false
                          : row.financeVisibility === "VISIBLE";
                      return (
                    <ToggleSwitch
                      checked={financeChecked}
                      disabled={
                        masterRow ||
                        restrictedRow ||
                        savingKeys.has(`finance:${row.staffId}`)
                      }
                      tooltip="Financial visibility"
                      onChange={(checked) => {
                        const isVis = row.financeVisibility === "VISIBLE";
                        if (checked !== isVis) {
                          void handleFinanceToggle(
                            row.staffId,
                            row.financeVisibility
                          );
                        }
                      }}
                    />
                      );
                    })()}
                  </td>
                  <td className="min-w-[200px] px-4 py-2 text-xs align-top">
                    <div className="flex flex-col gap-2">
                      {(() => {
                        const masterRow = isSystemMaster(row);
                        const restrictedRow = isFreelanceOrProvider(row);
                        const shiftsChecked = masterRow
                          ? true
                          : restrictedRow
                            ? false
                            : row.shiftsManagement;
                        return (
                      <ToggleSwitch
                        checked={shiftsChecked}
                        disabled={
                          masterRow ||
                          restrictedRow ||
                          savingKeys.has(`shifts:${row.staffId}`)
                        }
                        tooltip="Shifts management"
                        onChange={(checked) => {
                          if (checked !== row.shiftsManagement) {
                            void handleShiftsToggle(
                              row.staffId,
                              row.shiftsManagement
                            );
                          }
                        }}
                      />
                        );
                      })()}
                      {row.shiftsManagement &&
                      !isFreelanceOrProvider(row) &&
                      !isSystemMaster(row) ? (
                        <select
                          multiple
                          size={Math.min(6, Math.max(3, teamNameOptions.length))}
                          value={row.managedTeams}
                          disabled={savingKeys.has(`shiftsTeams:${row.staffId}`)}
                          onChange={(e) => {
                            const selected = Array.from(
                              e.target.selectedOptions,
                              (o) => o.value
                            );
                            void handleManagedTeamsChange(row.staffId, selected);
                          }}
                          className="w-full max-w-[220px] rounded border border-pitch-gray-dark bg-pitch-bg px-2 py-1 text-[11px] text-pitch-white"
                        >
                          {teamNameOptions.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-xs align-top">
                    <ToggleSwitch
                      checked={row.sergioAccess}
                      disabled={
                        isSystemMaster(row) ||
                        isFreelanceOrProvider(row) ||
                        savingKeys.has(`sergio:${row.staffId}`)
                      }
                      tooltip="Sergio access"
                      onChange={(checked) => {
                        if (checked !== row.sergioAccess) {
                          void handleSergioToggle(row.staffId, row.sergioAccess);
                        }
                      }}
                    />
                  </td>
                  {row.permissions.map((perm) => (
                    <td key={perm.pageKey} className="whitespace-nowrap px-4 py-2 text-xs">
                      {isFreelanceOrProvider(row) ? (
                        perm.pageKey === "le_mie_assegnazioni" ? (
                          <span
                            className={`inline-flex min-w-[90px] cursor-not-allowed items-center justify-center rounded border px-2 py-1.5 text-xs font-semibold opacity-60 ${accessCellClass(
                              "edit"
                            )}`}
                            aria-hidden
                          >
                            edit
                          </span>
                        ) : (
                          <span
                            className="inline-flex min-w-[90px] cursor-not-allowed items-center justify-center rounded border border-pitch-gray-dark/40 bg-pitch-gray-dark/15 px-2 py-1.5 text-xs font-semibold text-pitch-gray opacity-60"
                            aria-hidden
                          >
                            —
                          </span>
                        )
                      ) : isSystemMaster(row) ? (
                        <span
                          className={`inline-flex min-w-[90px] cursor-not-allowed items-center justify-center rounded border px-2 py-1.5 text-xs font-semibold opacity-60 ${accessCellClass(
                            "edit"
                          )}`}
                          aria-hidden
                        >
                          edit
                        </span>
                      ) : (
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
                          className={`inline-flex min-w-[90px] items-center justify-center rounded border px-2 py-1.5 text-xs font-semibold transition-colors duration-150 ease-out ${accessCellClass(
                            perm.accessLevel
                          )} hover:opacity-90`}
                        >
                          {perm.accessLevel === "none" ? "—" : perm.accessLevel}
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </ResponsiveTable>
        </>
      ) : null}

    </>
  );
}
