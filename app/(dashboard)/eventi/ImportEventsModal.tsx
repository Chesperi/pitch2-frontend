"use client";

import { useCallback, useMemo, useState } from "react";
import {
  fetchImportPreview,
  fetchApiSportsImportPreview,
  fetchPdfImportPreview,
  confirmImport,
} from "@/lib/api/eventsImport";
import type { ImportPreviewItem } from "@/lib/types";

type CompetitionOption =
  | {
      provider: "football-data";
      code: string;
      label: string;
    }
  | {
      provider: "api-sports";
      code: string;
      label: string;
      sport: "football" | "volleyball";
      leagueId: number;
    };

const COMPETITION_OPTIONS: CompetitionOption[] = [
  { provider: "football-data", code: "SA", label: "Serie A" },
  { provider: "football-data", code: "SB", label: "Serie B" },
  { provider: "football-data", code: "PD", label: "LaLiga" },
  { provider: "football-data", code: "PPL", label: "Primeira Liga" },
  { provider: "football-data", code: "FAC", label: "FA Cup" },
  {
    provider: "api-sports",
    code: "APS-FOOTBALL-144",
    label: "Jupiler Pro League",
    sport: "football",
    leagueId: 144,
  },
  {
    provider: "api-sports",
    code: "APS-FOOTBALL-139",
    label: "Serie A Women",
    sport: "football",
    leagueId: 139,
  },
  {
    provider: "api-sports",
    code: "APS-VOLLEYBALL-97",
    label: "SuperLega",
    sport: "volleyball",
    leagueId: 97,
  },
  {
    provider: "api-sports",
    code: "APS-VOLLEYBALL-89",
    label: "Serie A1 Women",
    sport: "volleyball",
    leagueId: 89,
  },
  {
    provider: "api-sports",
    code: "APS-VOLLEYBALL-88",
    label: "Serie A2",
    sport: "volleyball",
    leagueId: 88,
  },
  {
    provider: "api-sports",
    code: "APS-VOLLEYBALL-90",
    label: "Serie A2 Women",
    sport: "volleyball",
    leagueId: 90,
  },
  {
    provider: "api-sports",
    code: "APS-VOLLEYBALL-248",
    label: "Champions League Volley",
    sport: "volleyball",
    leagueId: 248,
  },
  {
    provider: "api-sports",
    code: "APS-VOLLEYBALL-183",
    label: "Nations League Volley",
    sport: "volleyball",
    leagueId: 183,
  },
];

type SourceTab = "api" | "pdf";

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
  onImported: (result: { imported: number; zonaCreated: number }) => void;
};

export function ImportEventsModal({ open, onClose, onImported }: Props) {
  const [sourceTab, setSourceTab] = useState<SourceTab>("api");
  const [step, setStep] = useState<1 | 2>(1);
  const [competitionCode, setCompetitionCode] = useState<string>("SA");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [parsingPdf, setParsingPdf] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setSourceTab("api");
    setStep(1);
    setPreview([]);
    setSelected(new Set());
    setPdfFile(null);
    setError(null);
    setLoadingPreview(false);
    setParsingPdf(false);
    setImporting(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const selectTab = (t: SourceTab) => {
    setSourceTab(t);
    setError(null);
    if (step === 2) {
      setStep(1);
      setPreview([]);
      setSelected(new Set());
    }
  };

  const selectableRows = useMemo(
    () => preview.filter((r) => !r.already_exists),
    [preview]
  );

  const handleSearch = async () => {
    setError(null);
    if (!dateFrom.trim() || !dateTo.trim()) {
      setError("Please enter start and end date.");
      return;
    }
    setLoadingPreview(true);
    try {
      const selectedCompetition = COMPETITION_OPTIONS.find(
        (option) => option.code === competitionCode
      );
      if (!selectedCompetition) {
        throw new Error("Unsupported competition selected.");
      }

      const dateFromTrimmed = dateFrom.trim();
      const dateToTrimmed = dateTo.trim();
      let rows: ImportPreviewItem[] = [];
      if (selectedCompetition.provider === "football-data") {
        rows = await fetchImportPreview({
          competitionCode: selectedCompetition.code,
          dateFrom: dateFromTrimmed,
          dateTo: dateToTrimmed,
        });
      } else {
        const fromDate = new Date(`${dateFromTrimmed}T00:00:00`);
        if (Number.isNaN(fromDate.getTime())) {
          throw new Error("Invalid start date.");
        }
        const year = fromDate.getFullYear();
        const month = fromDate.getMonth() + 1;
        const season = month >= 7 ? year : year - 1;
        rows = await fetchApiSportsImportPreview({
          leagueId: selectedCompetition.leagueId,
          sport: selectedCompetition.sport,
          season,
          dateFrom: dateFromTrimmed,
          dateTo: dateToTrimmed,
        });
      }
      setPreview(rows);
      setSelected(new Set());
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error loading preview");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handlePdfParse = async () => {
    setError(null);
    if (!pdfFile) {
      setError("Select a PDF file.");
      return;
    }
    setParsingPdf(true);
    try {
      const rows = await fetchPdfImportPreview(pdfFile);
      setPreview(rows);
      setSelected(new Set());
      setStep(2);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF parse error");
    } finally {
      setParsingPdf(false);
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
      setError("Select at least one match to import.");
      return;
    }
    setError(null);
    setImporting(true);
    try {
      const { imported, zona_created } = await confirmImport(toSend);
      onImported({ imported, zonaCreated: zona_created });
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import error");
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
            Import matches
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-pitch-gray-dark px-3 py-1 text-sm text-pitch-gray-light hover:bg-pitch-gray-dark/50"
          >
            Close
          </button>
        </div>

        <div className="mb-4 flex gap-1 border-b border-pitch-gray-dark">
          <button
            type="button"
            onClick={() => selectTab("api")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              sourceTab === "api"
                ? "border-b-2 border-[#FFFA00] text-pitch-white"
                : "border-b-2 border-transparent text-pitch-gray hover:text-pitch-gray-light"
            }`}
          >
            API
          </button>
          <button
            type="button"
            onClick={() => selectTab("pdf")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              sourceTab === "pdf"
                ? "border-b-2 border-[#FFFA00] text-pitch-white"
                : "border-b-2 border-transparent text-pitch-gray hover:text-pitch-gray-light"
            }`}
          >
            PDF Serie A
          </button>
        </div>

        {error ? (
          <p className="mb-3 rounded border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            {sourceTab === "api" ? (
              <>
                <p className="text-sm text-pitch-gray">
                  Step 1 — Search parameters
                </p>
                <div>
                  <label className="mb-1 block text-xs text-pitch-gray">
                    Competition
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
                      Date from
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
                      Date to
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
                  {loadingPreview ? "Loading…" : "Search matches"}
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-pitch-gray">
                  Step 1 — Upload Serie A PDF (anticipi/posticipi)
                </p>
                <div>
                  <label className="mb-1 block text-xs text-pitch-gray">
                    PDF file
                  </label>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setPdfFile(f);
                    }}
                    className={inputClass}
                  />
                </div>
                <button
                  type="button"
                  disabled={parsingPdf}
                  onClick={() => void handlePdfParse()}
                  className="rounded bg-[#FFFA00] px-4 py-2 text-sm font-medium text-black hover:opacity-90 disabled:opacity-50"
                >
                  {parsingPdf ? "Parsing PDF…" : "Parse PDF"}
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-pitch-gray">
                Step 2 — Preview ({preview.length} matches)
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded border border-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-white hover:bg-pitch-gray-dark/40"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={selectAll}
                  className="rounded border border-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-white hover:bg-pitch-gray-dark/40"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="rounded border border-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-white hover:bg-pitch-gray-dark/40"
                >
                  Deselect all
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
                      KO
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-pitch-gray">
                      MD
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-pitch-gray">
                      Suggested fields
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
                            className="dazn-checkbox h-4 w-4 disabled:cursor-not-allowed"
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
                              Already exists
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
                ? "Importing…"
                : `Import selected (${selected.size})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
