"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PageLoading from "@/components/ui/PageLoading";
import DesktopRecommended from "@/components/ui/DesktopRecommended";
import { fetchLeedsTx, patchLeedsTx, type LeedsTxRow } from "@/lib/api/leedsTx";

const BLUE_COLS: { key: keyof LeedsTxRow; label: string }[] = [
  { key: "pod_tx", label: "POD TX" },
  { key: "pod_phone_number", label: "POD Phone" },
  { key: "ld_initials", label: "LD Initials" },
  { key: "ld_name", label: "LD Name" },
];

void BLUE_COLS;

function displayCell(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  return String(v);
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
  const canEditBlue = leedsAccess;

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
      } as Record<string, string | null>);
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
        <td className="whitespace-nowrap px-2 py-1">
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
              onClick={() => void commitEdit()}
              disabled={saving}
              className="text-xs text-pitch-accent hover:underline"
            >
              ✓
            </button>
            <button
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
          Cologno (auto)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm border border-blue-800 bg-blue-950"></span>
          Leeds (editabile)
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
                  className="border-b border-pitch-gray-dark/50 transition-colors hover:bg-pitch-gray-dark/20"
                >
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">
                    {displayCell(row.competition_name)}
                  </td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.matchday)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.date)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.home_team)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.away_team)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.ko_italy_time)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">{displayCell(row.ko_gmt_time)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">{displayCell(row.mcr_lineup_gmt)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-white">{displayCell(row.pod_lineup_gmt)}</td>
                  <EditableCell row={row} field="facilities" canEdit={false} colorClass="bg-emerald-950/10 text-pitch-gray-light" />
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs font-medium text-pitch-accent">{displayCell(row.party_line)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.live_prod_coordinator)}</td>
                  <td className="whitespace-nowrap bg-emerald-950/10 px-4 py-3 text-xs text-pitch-gray-light">{displayCell(row.live_prod_coordinator_contact)}</td>
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
    </>
  );
}
