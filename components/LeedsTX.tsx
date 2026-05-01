"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PageLoading from "@/components/ui/PageLoading";
import DesktopRecommended from "@/components/ui/DesktopRecommended";
import {
  fetchLeedsTx,
  patchLeedsTx,
  type LeedsTxBluePayload,
  type LeedsTxGreenOverridePayload,
  type LeedsTxRow,
} from "@/lib/api/leedsTx";

const BLUE_COLS: { key: keyof LeedsTxRow; label: string }[] = [
  { key: "pod_tx", label: "POD TX" },
  { key: "pod_phone_number", label: "POD Phone" },
  { key: "ld_initials", label: "LD Initials" },
  { key: "ld_name", label: "LD Name" },
];

void BLUE_COLS;

const GREEN_EDIT_FIELD_TO_OVERRIDE: Partial<
  Record<keyof LeedsTxRow, keyof LeedsTxGreenOverridePayload>
> = {
  facilities: "override_facilities",
  party_line: "override_party_line",
  live_prod_coordinator: "override_live_prod_coordinator",
  live_prod_coordinator_contact: "override_live_prod_contact",
};

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

  const [editModal, setEditModal] = useState<LeedsTxRow | null>(null);
  const [editForm, setEditForm] = useState({
    mcr_lineup_gmt: "",
    pod_lineup_gmt: "",
    party_line: "",
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, data] = await Promise.all([fetchAuthMe(), fetchLeedsTx()]);
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
  const canPatchGreen = ["MASTER", "MANAGER", "STAFF"].includes(userLevel);
  const canEditBlue = leedsAccess;

  const openEditModal = (row: LeedsTxRow) => {
    setEditModal(row);
    setEditForm({
      mcr_lineup_gmt: row.mcr_lineup_gmt ?? "",
      pod_lineup_gmt: row.pod_lineup_gmt ?? "",
      party_line: row.party_line ?? "",
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
      });
      setRows((prev) =>
        prev.map((r) =>
          r.event_id === editModal.event_id
            ? {
                ...r,
                mcr_lineup_gmt: editForm.mcr_lineup_gmt || r.mcr_lineup_gmt,
                pod_lineup_gmt: editForm.pod_lineup_gmt || r.pod_lineup_gmt,
                party_line: editForm.party_line || r.party_line,
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
      const overrideKey = GREEN_EDIT_FIELD_TO_OVERRIDE[editing.field];
      const payload = overrideKey
        ? ({ [overrideKey]: editing.value || null } as LeedsTxGreenOverridePayload)
        : ({ [editing.field]: editing.value || null } as LeedsTxBluePayload);
      await patchLeedsTx(editing.eventId, payload);
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
  }: {
    row: LeedsTxRow;
    field: keyof LeedsTxRow;
    canEdit: boolean;
    colorClass: string;
  }) => {
    const isEditing = editing?.eventId === row.event_id && editing?.field === field;
    const value = row[field] as string | null;

    if (isEditing) {
      return (
        <td
          className="whitespace-nowrap px-2 py-1"
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
              onClick={() => void commitEdit()}
              disabled={saving}
              className="text-xs text-pitch-accent hover:underline"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={cancelEdit}
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
        }`}
        onClick={(e) => {
          e.stopPropagation();
          if (canEdit) startEdit(row.event_id, field, value);
        }}
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

      <ResponsiveTable minWidth="2400px">
        {rows.length === 0 ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
            Nessun evento MATCH o STUDIO SHOW trovato.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Competition</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">MD</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Date</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Home</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Away</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">KO Italy</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">KO GMT</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">MCR Lineup GMT</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">POD Lineup GMT</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Facilities</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Party Line</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Live Prod. Coordinator</th>
                <th className="whitespace-nowrap bg-emerald-950/30 px-4 py-3 text-left text-xs font-medium text-emerald-400">Coordinator Contact</th>
                <th className="whitespace-nowrap bg-blue-950/30 px-4 py-3 text-left text-xs font-medium text-blue-400">POD TX</th>
                <th className="whitespace-nowrap bg-blue-950/30 px-4 py-3 text-left text-xs font-medium text-blue-400">POD Phone</th>
                <th className="whitespace-nowrap bg-blue-950/30 px-4 py-3 text-left text-xs font-medium text-blue-400">LD Initials</th>
                <th className="whitespace-nowrap bg-blue-950/30 px-4 py-3 text-left text-xs font-medium text-blue-400">LD Name</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.event_id}
                  className="cursor-pointer border-b border-pitch-gray-dark/50 transition-colors hover:bg-pitch-gray-dark/20"
                  onClick={() => (canEditGreen ? openEditModal(row) : undefined)}
                >
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">
                    {displayCell(row.competition_name)}
                  </td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.matchday)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{formatDate(row.date)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.home_team)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.away_team)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{formatTime(row.ko_italy_time)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">{displayCell(row.ko_gmt_time)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">{displayCell(row.mcr_lineup_gmt)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">{displayCell(row.pod_lineup_gmt)}</td>
                  <EditableCell row={row} field="facilities" canEdit={canPatchGreen} colorClass="bg-emerald-950/10 text-pitch-gray-light" />
                  <EditableCell row={row} field="party_line" canEdit={canPatchGreen} colorClass="bg-emerald-950/10 font-medium text-pitch-accent" />
                  <EditableCell row={row} field="live_prod_coordinator" canEdit={canPatchGreen} colorClass="bg-emerald-950/10 text-pitch-gray-light" />
                  <EditableCell row={row} field="live_prod_coordinator_contact" canEdit={canPatchGreen} colorClass="bg-emerald-950/10 text-pitch-gray-light" />
                  <EditableCell row={row} field="pod_tx" canEdit={canEditBlue} colorClass="bg-blue-950/10 text-blue-300" />
                  <EditableCell row={row} field="pod_phone_number" canEdit={canEditBlue} colorClass="bg-blue-950/10 text-blue-300" />
                  <EditableCell row={row} field="ld_initials" canEdit={canEditBlue} colorClass="bg-blue-950/10 text-blue-300" />
                  <EditableCell row={row} field="ld_name" canEdit={canEditBlue} colorClass="bg-blue-950/10 text-blue-300" />
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
