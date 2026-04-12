"use client";

import { useCallback, useMemo, useState } from "react";
import {
  fetchImportPreview,
  confirmImport,
} from "@/lib/api/eventsImport";
import type { ImportPreviewItem } from "@/lib/types";

const COMPETITION_OPTIONS = [
  { code: "SA", label: "Serie A" },
  { code: "SB", label: "Serie B" },
  { code: "PD", label: "LaLiga" },
] as const;

function formatKoItaly(iso: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function suggestedSummary(sf: ImportPreviewItem["suggested_fields"]): string {
  const parts: string[] = [];
  if (sf.standard_onsite) parts.push(`O:${sf.standard_onsite}`);
  if (sf.standard_cologno) parts.push(`C:${sf.standard_cologno}`);
  if (sf.show_name) parts.push(`Show:${sf.show_name}`);
  if (
    sf.pre_duration_minutes != null &&
    !Number.isNaN(sf.pre_duration_minutes)
  ) {
    parts.push(`PRE:${sf.pre_duration_minutes}`);
  }
  return parts.length ? parts.join(" · ") : "—";
}

const inputClass =
  "w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Chiamato dopo import riuscito con numero di righe create. */
  onImported: (importedCount: number) => void;
};

export function ImportEventsModal({ open, onClose, onImported }: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [competitionCode, setCompetitionCode] = useState<string>("SA");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [preview, setPreview] = useState<ImportPreviewItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep(1);
    setPreview([]);
    setSelected(new Set());
    setError(null);
    setLoadingPreview(false);
    setImporting(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const selectableRows = useMemo(
    () => preview.filter((r) => !r.already_exists),
    [preview]
  );

  const handleSearch = async () => {
    setError(null);
    if (!dateFrom.trim() || !dateTo.trim()) {
      setError("Indica data inizio e fine.");
      return;
    }
    setLoadingPreview(true);
    try {
      const rows = await fetchImportPreview({
        competitionCode,
        dateFrom: dateFrom.trim(),
        dateTo: dateTo.trim(),
      });
      setPreview(rows);
      setSelected(new Set());
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento anteprima");
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleRow = (id: string, disabled: boolean) => {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(selectableRows.map((r) => r.external_match_id)));
  };

  const deselectAll = () => setSelected(new Set());

  const handleImport = async () => {
    const toSend = preview.filter(
      (r) => selected.has(r.external_match_id) && !r.already_exists
    );
    if (toSend.length === 0) {
      setError("Seleziona almeno una partita da importare.");
      return;
    }
    setError(null);
    setImporting(true);
    try {
      const { imported } = await confirmImport(toSend);
      onImported(imported);
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore durante l'import");
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 font-sans">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-pitch-white">
            Importa partite
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-pitch-gray-dark px-3 py-1 text-sm text-pitch-gray-light hover:bg-pitch-gray-dark/50"
          >
            Chiudi
          </button>
        </div>

        {error ? (
          <p className="mb-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <p className="text-sm text-pitch-gray">
              Step 1 — Parametri ricerca (API football-data.org)
            </p>
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                Competizione
              </label>
              <select
                value={competitionCode}
                onChange={(e) => setCompetitionCode(e.target.value)}
                className={inputClass}
              >
                {COMPETITION_OPTIONS.map((o) => (
                  <option key={o.code} value={o.code}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  Data da
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  Data a
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="button"
              disabled={loadingPreview}
              onClick={() => void handleSearch()}
              className="rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50"
            >
              {loadingPreview ? "Caricamento…" : "Cerca partite"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-pitch-gray">
                Step 2 — Anteprima ({preview.length} partite)
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded border border-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-white hover:bg-pitch-gray-dark/40"
                >
                  ← Indietro
                </button>
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded border border-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-white hover:bg-pitch-gray-dark/40"
                >
                  Seleziona tutto
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="rounded border border-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-white hover:bg-pitch-gray-dark/40"
                >
                  Deseleziona tutto
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-pitch-gray-dark">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-pitch-gray-dark bg-pitch-gray-dark/30">
                    <th className="w-10 px-2 py-2 text-left text-xs font-medium text-pitch-gray" />
                    <th className="px-3 py-2 text-left text-xs font-medium text-pitch-gray">
                      Match
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-pitch-gray">
                      Data KO
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-pitch-gray">
                      MD
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-pitch-gray">
                      Campi suggeriti
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-pitch-gray" />
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row) => {
                    const disabled = row.already_exists;
                    const checked = selected.has(row.external_match_id);
                    return (
                      <tr
                        key={row.external_match_id}
                        className={
                          disabled
                            ? "border-b border-pitch-gray-dark/40 opacity-50"
                            : "border-b border-pitch-gray-dark/40 hover:bg-pitch-gray-dark/20"
                        }
                      >
                        <td className="px-2 py-2 align-top">
                          <input
                            type="checkbox"
                            disabled={disabled}
                            checked={checked}
                            onChange={() =>
                              toggleRow(row.external_match_id, disabled)
                            }
                            className="h-4 w-4 accent-pitch-accent disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-3 py-2 text-pitch-white">
                          {row.home_team} vs {row.away_team}
                        </td>
                        <td className="px-3 py-2 text-pitch-gray-light">
                          {formatKoItaly(row.ko_italy)}
                        </td>
                        <td className="px-3 py-2 text-pitch-gray-light">
                          {row.matchday || "—"}
                        </td>
                        <td className="max-w-[280px] px-3 py-2 text-xs text-pitch-gray-light">
                          {suggestedSummary(row.suggested_fields)}
                        </td>
                        <td className="px-3 py-2">
                          {row.already_exists ? (
                            <span className="inline-flex rounded-full bg-pitch-gray-dark px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-pitch-gray">
                              Già presente
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              disabled={importing || selected.size === 0}
              onClick={() => void handleImport()}
              className="rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50"
            >
              {importing
                ? "Import in corso…"
                : `Importa selezionate (${selected.size})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
