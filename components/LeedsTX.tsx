"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import { fetchLookupValues } from "@/lib/api/lookupValues";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PageLoading from "@/components/ui/PageLoading";
import DesktopRecommended from "@/components/ui/DesktopRecommended";
import {
  fetchLeedsTx,
  patchLeedsTx,
  type LeedsTxBluePayload,
  type LeedsTxRow,
} from "@/lib/api/leedsTx";

const BLUE_COLS: { key: keyof LeedsTxRow; label: string }[] = [
  { key: "pod_tx", label: "POD TX" },
  { key: "pod_phone_number", label: "POD Phone" },
  { key: "mcr_phone_number", label: "MCR Phone" },
  { key: "ld_initials", label: "LD Initials" },
  { key: "ld_name", label: "LD Name" },
];

void BLUE_COLS;

function displayCell(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${day}/${m}/${y}`;
}

function formatTime(t: string | null): string {
  if (!t) return "—";
  return t.slice(0, 5);
}

export default function LeedsTX() {
  const [rows, setRows] = useState<LeedsTxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leedsAccess, setLeedsAccess] = useState(false);
  const [userLevel, setUserLevel] = useState("");
  const [editing, setEditing] = useState<{
    eventId: string;
    field: keyof LeedsTxRow;
    value: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [podTxOptions, setPodTxOptions] = useState<string[]>([]);
  const [mcrPhoneOptions, setMcrPhoneOptions] = useState<string[]>([]);
  const [filterCompetition, setFilterCompetition] = useState<string>("");
  const [filterMd, setFilterMd] = useState<string>("");
  const [filterDate, setFilterDate] = useState<string>("");

  const [editModal, setEditModal] = useState<LeedsTxRow | null>(null);
  const [editForm, setEditForm] = useState({
    mcr_lineup_gmt: "",
    pod_lineup_gmt: "",
    party_line: "",
    live_prod_coordinator: "",
    coordinator_contact: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, data, lookups] = await Promise.all([
        fetchAuthMe(),
        fetchLeedsTx(),
        fetchLookupValues(),
      ]);
      const allLookups = lookups as { category: string; value: string }[];
      setPodTxOptions(
        allLookups.filter((l) => l.category === "pod_tx").map((l) => l.value)
      );
      setMcrPhoneOptions(
        allLookups
          .filter((l) => l.category === "mcr_phone_number")
          .map((l) => l.value)
      );
      setLeedsAccess(!!(me as { leeds_access?: boolean }).leeds_access);
      setUserLevel((me.user_level ?? "").toUpperCase());
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canEditGreen = ["MASTER", "MANAGER"].includes(userLevel);
  const canEditBlue = leedsAccess;
  const filteredRows = rows.filter((row) => {
    if (filterCompetition && row.competition_name !== filterCompetition) return false;
    if (filterMd && String(row.matchday ?? "") !== filterMd) return false;
    if (filterDate && row.date !== filterDate) return false;
    return true;
  });
  const competitionOptions = [
    ...new Set(rows.map((r) => r.competition_name).filter(Boolean)),
  ] as string[];
  const mdOptions = [...new Set(rows.map((r) => r.matchday).filter((v) => v != null))]
    .sort((a, b) => Number(a) - Number(b))
    .map(String);

  const openEditModal = (row: LeedsTxRow) => {
    setEditModal(row);
    setEditForm({
      mcr_lineup_gmt: row.mcr_lineup_gmt ?? "",
      pod_lineup_gmt: row.pod_lineup_gmt ?? "",
      party_line: row.party_line ?? "",
      live_prod_coordinator: row.live_prod_coordinator ?? "",
      coordinator_contact: row.live_prod_coordinator_contact ?? "",
    });
    setEditError(null);
  };

  const closeEditModal = () => {
    if (editSaving) return;
    setEditModal(null);
    setEditError(null);
  };

  const submitEditModal = async () => {
    if (!editModal) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await patchLeedsTx(editModal.event_id, {
        override_mcr_lineup_gmt: editForm.mcr_lineup_gmt || null,
        override_pod_lineup_gmt: editForm.pod_lineup_gmt || null,
        override_party_line: editForm.party_line || null,
        override_live_prod_coordinator: editForm.live_prod_coordinator || null,
        override_live_prod_contact: editForm.coordinator_contact || null,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.event_id === editModal.event_id
            ? {
                ...r,
                mcr_lineup_gmt: editForm.mcr_lineup_gmt || r.mcr_lineup_gmt,
                pod_lineup_gmt: editForm.pod_lineup_gmt || r.pod_lineup_gmt,
                party_line: editForm.party_line || r.party_line,
                live_prod_coordinator:
                  editForm.live_prod_coordinator || r.live_prod_coordinator,
                live_prod_coordinator_contact:
                  editForm.coordinator_contact || r.live_prod_coordinator_contact,
              }
            : r
        )
      );
      setEditModal(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setEditSaving(false);
    }
  };

  const startEdit = (
    eventId: string,
    field: keyof LeedsTxRow,
    current: string | null
  ) => {
    setEditing({ eventId, field, value: current ?? "" });
  };

  const commitEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await patchLeedsTx(editing.eventId, {
        [editing.field]: editing.value || null,
      } as LeedsTxBluePayload);
      setRows((prev) =>
        prev.map((r) =>
          r.event_id === editing.eventId
            ? { ...r, [editing.field]: editing.value || null }
            : r
        )
      );
      setEditing(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => setEditing(null);

  const EditableCell = ({
    row,
    field,
    canEdit,
    colorClass,
    options,
    widthClass,
  }: {
    row: LeedsTxRow;
    field: keyof LeedsTxRow;
    canEdit: boolean;
    colorClass: string;
    options?: string[];
    widthClass: string;
  }) => {
    const isEditing = editing?.eventId === row.event_id && editing?.field === field;
    const value = row[field] as string | null;

    if (isEditing) {
      if (options && options.length > 0) {
        return (
          <td
            className={`whitespace-nowrap px-2 py-1 ${widthClass}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1">
              <select
                autoFocus
                className="rounded border border-pitch-accent bg-pitch-gray-dark px-2 py-1 text-xs text-pitch-white focus:outline-none"
                value={editing.value}
                onChange={(e) =>
                  setEditing((prev) =>
                    prev ? { ...prev, value: e.target.value } : null
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelEdit();
                }}
                disabled={saving}
              >
                <option value="">—</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void commitEdit();
                }}
                disabled={saving}
                className="text-xs text-pitch-accent hover:underline"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  cancelEdit();
                }}
                disabled={saving}
                className="text-xs text-pitch-gray hover:underline"
              >
                ✕
              </button>
            </div>
          </td>
        );
      }
      return (
        <td
          className={`whitespace-nowrap px-2 py-1 ${widthClass}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1">
            <input
              autoFocus
              className="w-32 rounded border border-pitch-accent bg-pitch-gray-dark px-2 py-1 text-xs text-pitch-white focus:outline-none"
              value={editing.value}
              onChange={(e) =>
                setEditing((prev) =>
                  prev ? { ...prev, value: e.target.value } : null
                )
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              disabled={saving}
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void commitEdit();
              }}
              disabled={saving}
              className="text-xs text-pitch-accent hover:underline"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                cancelEdit();
              }}
              disabled={saving}
              className="text-xs text-pitch-gray hover:underline"
            >
              ✕
            </button>
          </div>
        </td>
      );
    }

    return (
      <td
        className={`whitespace-nowrap px-4 py-3 text-xs ${colorClass} ${
          canEdit ? "cursor-pointer hover:bg-white/5" : ""
        } ${widthClass}`}
        onClick={() => (canEdit ? startEdit(row.event_id, field, value) : undefined)}
        title={canEdit ? "Click per modificare" : undefined}
      >
        {displayCell(value)}
        {canEdit && value == null && (
          <span className="ml-1 text-[10px] opacity-40">+</span>
        )}
      </td>
    );
  };

  if (loading) return <PageLoading />;

  return (
    <>
      <PageHeader title="Leeds TX" />
      <DesktopRecommended />
      {error && (
        <p className="mt-4 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <div className="mb-4 flex items-center gap-4 text-xs text-pitch-gray">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-emerald-800 bg-emerald-950"></span>
          Cologno
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-blue-800 bg-blue-950"></span>
          Leeds
        </span>
        {canEditGreen && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm border border-amber-800 bg-amber-950"></span>
            Override manuale
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filterCompetition}
          onChange={(e) => setFilterCompetition(e.target.value)}
          className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-white focus:border-pitch-accent focus:outline-none"
        >
          <option value="">All competitions</option>
          {competitionOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filterMd}
          onChange={(e) => setFilterMd(e.target.value)}
          className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-white focus:border-pitch-accent focus:outline-none"
        >
          <option value="">All MD</option>
          {mdOptions.map((m) => (
            <option key={m} value={m}>
              MD {m}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-white focus:border-pitch-accent focus:outline-none"
        />
        {(filterCompetition || filterMd || filterDate) && (
          <button
            onClick={() => {
              setFilterCompetition("");
              setFilterMd("");
              setFilterDate("");
            }}
            className="text-xs text-pitch-gray hover:text-pitch-white"
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-xs text-pitch-gray">
          {filteredRows.length} / {rows.length} events
        </span>
      </div>

      <ResponsiveTable minWidth="2400px">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
            Nessun evento MATCH o STUDIO SHOW trovato.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className="w-[120px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Competition</th>
                <th className="w-[48px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">MD</th>
                <th className="w-[100px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Date</th>
                <th className="w-[110px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Home</th>
                <th className="w-[110px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Away</th>
                <th className="w-[72px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">KO Italy</th>
                <th className="w-[72px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">KO GMT</th>
                <th className="w-[100px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">MCR Lineup GMT</th>
                <th className="w-[100px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">POD Lineup GMT</th>
                <th className="w-[100px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Facilities</th>
                <th className="w-[80px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Party Line</th>
                <th className="w-[160px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Live Prod. Coordinator</th>
                <th className="w-[140px] whitespace-nowrap overflow-hidden text-ellipsis bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Coordinator Contact</th>
                <th className="w-[180px] whitespace-nowrap overflow-hidden text-ellipsis bg-blue-950/30 px-4 py-3 text-left text-xs font-medium text-blue-400">POD TX</th>
                <th className="w-[110px] whitespace-nowrap overflow-hidden text-ellipsis bg-blue-950/30 px-4 py-3 text-left text-xs font-medium text-blue-400">POD Phone</th>
                <th className="w-[180px] whitespace-nowrap overflow-hidden text-ellipsis bg-blue-950/30 px-4 py-3 text-left text-xs font-medium text-blue-400">MCR Phone</th>
                <th className="w-[80px] whitespace-nowrap overflow-hidden text-ellipsis bg-blue-950/30 px-4 py-3 text-left text-xs font-medium text-blue-400">LD Initials</th>
                <th className="w-[130px] whitespace-nowrap overflow-hidden text-ellipsis bg-blue-950/30 px-4 py-3 text-left text-xs font-medium text-blue-400">LD Name</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr
                  key={row.event_id}
                  className="cursor-pointer border-b border-pitch-gray-dark/50 transition-colors hover:bg-pitch-gray-dark/20"
                  onClick={() => (canEditGreen ? openEditModal(row) : undefined)}
                >
                  <td className="w-[120px] whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">
                    {displayCell(row.competition_name)}
                  </td>
                  <td className="w-[48px] whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.matchday)}</td>
                  <td className="w-[100px] whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{formatDate(row.date)}</td>
                  <td className="w-[110px] whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.home_team)}</td>
                  <td className="w-[110px] whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.away_team)}</td>
                  <td className="w-[72px] whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{formatTime(row.ko_italy_time)}</td>
                  <td className="w-[72px] whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">{displayCell(row.ko_gmt_time)}</td>
                  <td className="w-[100px] whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">{displayCell(row.mcr_lineup_gmt)}</td>
                  <td className="w-[100px] whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">{displayCell(row.pod_lineup_gmt)}</td>
                  <td className="w-[100px] px-4 py-3 text-xs text-pitch-gray-light whitespace-nowrap bg-emerald-950/10">
                    {displayCell(row.facilities)}
                  </td>
                  <td className="w-[80px] px-4 py-3 text-xs text-pitch-accent whitespace-nowrap bg-emerald-950/10 font-medium">
                    {displayCell(row.party_line)}
                  </td>
                  <td className="w-[160px] px-4 py-3 text-xs text-pitch-gray-light whitespace-nowrap bg-emerald-950/10">
                    {displayCell(row.live_prod_coordinator)}
                  </td>
                  <td className="w-[140px] px-4 py-3 text-xs text-pitch-gray-light whitespace-nowrap bg-emerald-950/10">
                    {displayCell(row.live_prod_coordinator_contact)}
                  </td>
                  <EditableCell row={row} field="pod_tx" canEdit={canEditBlue} colorClass="text-blue-300 bg-blue-950/10" options={podTxOptions} widthClass="w-[180px]" />
                  <EditableCell row={row} field="pod_phone_number" canEdit={canEditBlue} colorClass="bg-blue-950/10 text-blue-300" widthClass="w-[110px]" />
                  <EditableCell row={row} field="mcr_phone_number" canEdit={canEditBlue} colorClass="text-blue-300 bg-blue-950/10" options={mcrPhoneOptions} widthClass="w-[180px]" />
                  <EditableCell row={row} field="ld_initials" canEdit={canEditBlue} colorClass="bg-blue-950/10 text-blue-300" widthClass="w-[80px]" />
                  <EditableCell row={row} field="ld_name" canEdit={canEditBlue} colorClass="bg-blue-950/10 text-blue-300" widthClass="w-[130px]" />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ResponsiveTable>

      {editModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeEditModal}
        >
          <div
            className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-bg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-base font-semibold text-pitch-white">
              {editModal.home_team ?? editModal.show_name} vs {editModal.away_team}
            </h3>
            <p className="mb-4 text-xs text-pitch-gray">
              {formatDate(editModal.date)} — {formatTime(editModal.ko_italy_time)} Italy / {editModal.ko_gmt_time} GMT
            </p>
            {editError && (
              <p className="mb-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-200">
                {editError}
              </p>
            )}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">MCR Lineup GMT</label>
                <input
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  value={editForm.mcr_lineup_gmt}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, mcr_lineup_gmt: e.target.value }))
                  }
                  placeholder="es. 14:00"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">POD Lineup GMT</label>
                <input
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  value={editForm.pod_lineup_gmt}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, pod_lineup_gmt: e.target.value }))
                  }
                  placeholder="es. 14:15"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">Party Line</label>
                <input
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  value={editForm.party_line}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, party_line: e.target.value }))
                  }
                  placeholder="es. PL24"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">Live Prod. Coordinator</label>
                <input
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  value={editForm.live_prod_coordinator}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, live_prod_coordinator: e.target.value }))
                  }
                  placeholder={editModal.live_prod_coordinator ?? "auto"}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">Coordinator Contact</label>
                <input
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                  value={editForm.coordinator_contact}
                  onChange={(e) =>
                    setEditForm((p) => ({ ...p, coordinator_contact: e.target.value }))
                  }
                  placeholder={editModal.live_prod_coordinator_contact ?? "auto"}
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEditModal}
                disabled={editSaving}
                className="rounded border border-pitch-gray-dark px-4 py-2 text-sm text-pitch-gray-light hover:bg-pitch-gray-dark"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitEditModal()}
                disabled={editSaving}
                className="rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50"
              >
                {editSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
