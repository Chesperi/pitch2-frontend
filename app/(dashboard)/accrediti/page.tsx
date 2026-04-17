"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import { apiFetch } from "@/lib/api/apiFetch";
import {
  createAccredito,
  deactivateAccredito,
  fetchAccreditationAreas,
  fetchAccreditiStaffOnsite,
  fetchAccreditiEvents,
  type AccreditoEvent,
  type AccreditoOnsiteItem,
} from "@/lib/api/accrediti";

type StaffSearchItem = {
  id: number;
  surname: string;
  name: string;
  company: string | null;
  defaultRoleCode: string | null;
  plates: string | null;
  notes: string | null;
};

function normalizeStaffSearchItem(raw: Record<string, unknown>): StaffSearchItem {
  return {
    id: Number(raw.id ?? 0),
    surname: String(raw.surname ?? ""),
    name: String(raw.name ?? ""),
    company:
      raw.company != null && String(raw.company).trim() !== ""
        ? String(raw.company)
        : null,
    defaultRoleCode:
      raw.defaultRoleCode != null && String(raw.defaultRoleCode).trim() !== ""
        ? String(raw.defaultRoleCode)
        : raw.default_role_code != null && String(raw.default_role_code).trim() !== ""
          ? String(raw.default_role_code)
          : null,
    plates:
      raw.plates != null && String(raw.plates).trim() !== ""
        ? String(raw.plates)
        : null,
    notes:
      raw.notes != null && String(raw.notes).trim() !== ""
        ? String(raw.notes)
        : null,
  };
}

function formatKo(ko: string | null | undefined): string {
  if (!ko) return "—";
  const d = new Date(ko);
  return Number.isNaN(d.getTime()) ? ko : d.toLocaleString("it-IT");
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

function eventTitle(event: AccreditoEvent): string {
  const home = event.homeTeamNameShort?.trim();
  const away = event.awayTeamNameShort?.trim();
  const show = event.showName?.trim();
  if (home || away) return `${home ?? "—"} vs ${away ?? "—"}`;
  if (show) return show;
  return event.competitionName || event.id;
}

function requirementsCoverageLine(event: AccreditoEvent): ReactNode {
  const covered = event.coveredAssignments;
  const total = event.totalAssignments;
  if (covered == null || total == null || total <= 0) return null;
  const colorClass = covered === total ? "text-green-400" : "text-amber-400";
  return (
    <div className={`mt-0.5 text-xs ${colorClass}`}>
      {covered === total ? "✓ " : ""}
      {covered}/{total} requirements coperti
    </div>
  );
}

function normalizeOwnerCode(team: string | null | undefined): string {
  const v = String(team ?? "").trim().toLowerCase();
  if (v.includes("inter")) return "inter";
  if (v.includes("milan")) return "milan";
  if (v.includes("napoli")) return "napoli";
  return "lega";
}

async function downloadBlob(blob: Blob, fileName: string): Promise<void> {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AccreditiPage() {
  const [events, setEvents] = useState<AccreditoEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [items, setItems] = useState<AccreditoOnsiteItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [areasLegendOpen, setAreasLegendOpen] = useState(false);
  const [areaMappings, setAreaMappings] = useState<{ roleCode: string; areas: string }[]>([]);
  const [areaLegends, setAreaLegends] = useState<{ areaCode: string; description: string }[]>([]);
  const [areasLoading, setAreasLoading] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [staffQuery, setStaffQuery] = useState("");
  const [staffOptions, setStaffOptions] = useState<StaffSearchItem[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [formRoleCode, setFormRoleCode] = useState("");
  const [formAreas, setFormAreas] = useState("");
  const [formPlates, setFormPlates] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [savingAdd, setSavingAdd] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );

  const ownerCode = useMemo(
    () => normalizeOwnerCode(selectedEvent?.homeTeamNameShort ?? null),
    [selectedEvent]
  );

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) => {
      const haystack = [eventTitle(event), event.competitionName, event.showName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [events, eventSearch]);

  async function loadEvents() {
    setEventsLoading(true);
    try {
      const data = await fetchAccreditiEvents();
      setEvents(data);
      if (!selectedEventId && data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    } finally {
      setEventsLoading(false);
    }
  }

  async function loadAccrediti(eventId: string) {
    setItemsLoading(true);
    setItemsError(null);
    try {
      const rows = await fetchAccreditiStaffOnsite(eventId);
      setItems(rows);
    } catch (err) {
      setItems([]);
      setItemsError(err instanceof Error ? err.message : "Errore caricamento accrediti");
    } finally {
      setItemsLoading(false);
    }
  }

  async function loadAreas(owner: string) {
    setAreasLoading(true);
    try {
      const payload = await fetchAccreditationAreas(owner);
      setAreaMappings(payload.mappings);
      setAreaLegends(payload.legends);
    } catch {
      setAreaMappings([]);
      setAreaLegends([]);
    } finally {
      setAreasLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    void loadAccrediti(selectedEventId);
  }, [selectedEventId]);

  useEffect(() => {
    if (!selectedEvent) return;
    void loadAreas(ownerCode);
  }, [selectedEvent, ownerCode]);

  async function searchStaff() {
    const q = staffQuery.trim();
    if (q.length < 2) return;
    setStaffLoading(true);
    try {
      const res = await apiFetch(`/api/staff/search?q=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Staff search failed: ${res.status}`);
      const data = (await res.json()) as
        | { items?: Record<string, unknown>[] }
        | Record<string, unknown>[];
      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
          ? data.items
          : [];
      const normalized = rows.map((r) => normalizeStaffSearchItem(r));
      setStaffOptions(normalized);
    } catch {
      setStaffOptions([]);
      setAddError("Errore nella ricerca staff");
    } finally {
      setStaffLoading(false);
    }
  }

  function onStaffPicked(staffId: number | null) {
    setSelectedStaffId(staffId);
    const staff = staffOptions.find((s) => s.id === staffId) ?? null;
    if (!staff) {
      setFormRoleCode("");
      setFormAreas("");
      setFormPlates("");
      setFormNotes("");
      return;
    }
    const roleCode = staff.defaultRoleCode ?? "";
    setFormRoleCode(roleCode);
    const mappedAreas =
      areaMappings.find(
        (m) => m.roleCode.toUpperCase() === roleCode.toUpperCase()
      )?.areas ?? "";
    setFormAreas(mappedAreas);
    setFormPlates(staff.plates ?? "");
    setFormNotes(staff.notes ?? "");
  }

  async function onCreateAccredito() {
    if (!selectedEventId || !selectedStaffId) {
      setAddError("Seleziona evento e persona.");
      return;
    }
    setSavingAdd(true);
    setAddError(null);
    try {
      await createAccredito({
        eventId: selectedEventId,
        staffId: selectedStaffId,
        roleCode: formRoleCode || null,
        areas: formAreas || null,
        plates: formPlates || null,
        notes: formNotes || null,
      });
      await loadAccrediti(selectedEventId);
      setAddOpen(false);
      setSelectedStaffId(null);
      setStaffQuery("");
      setStaffOptions([]);
      setFormRoleCode("");
      setFormAreas("");
      setFormPlates("");
      setFormNotes("");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Errore salvataggio accredito");
    } finally {
      setSavingAdd(false);
    }
  }

  async function onRemoveAccredito(id: number) {
    setRemovingId(id);
    try {
      await deactivateAccredito(id);
      if (selectedEventId) {
        await loadAccrediti(selectedEventId);
      }
    } finally {
      setRemovingId(null);
    }
  }

  async function onExportPdf() {
    if (!selectedEventId) return;
    setExporting("pdf");
    try {
      const res = await apiFetch(`/api/accrediti/${encodeURIComponent(selectedEventId)}/pdf`);
      if (!res.ok) throw new Error(`Failed to export PDF: ${res.status}`);
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match?.[1] ?? `accrediti-${selectedEventId}.pdf`;
      const blob = await res.blob();
      await downloadBlob(blob, fileName);
    } finally {
      setExporting(null);
    }
  }

  async function onExportXlsx() {
    if (!selectedEventId) return;
    setExporting("xlsx");
    try {
      const res = await apiFetch(
        `/api/accrediti/${encodeURIComponent(selectedEventId)}/export-xlsx`
      );
      if (!res.ok) throw new Error(`Failed to export XLSX: ${res.status}`);
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const fileName = match?.[1] ?? `accrediti-${selectedEventId}.xlsx`;
      const blob = await res.blob();
      await downloadBlob(blob, fileName);
    } finally {
      setExporting(null);
    }
  }

  return (
    <>
      <PageHeader title="Accrediti" />

      <section className="mt-4 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-pitch-white">
            Pronti per accredito
          </h2>
          <SearchBar
            placeholder="Cerca match/show o competizione..."
            onSearchChange={setEventSearch}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-pitch-gray-dark text-left text-pitch-gray">
                <th className="px-3 py-2">Data KO</th>
                <th className="px-3 py-2">Match / Show</th>
                <th className="px-3 py-2">Competizione</th>
                <th className="px-3 py-2">Assignment status</th>
                <th className="px-3 py-2">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {eventsLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-pitch-gray">
                    Caricamento eventi...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-pitch-gray">
                    Nessun evento disponibile.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="border-b border-pitch-gray-dark/50">
                    <td className="px-3 py-2 text-pitch-gray-light">{formatKo(event.koItaly)}</td>
                    <td className="px-3 py-2 text-pitch-gray-light">
                      <div>{eventTitle(event)}</div>
                      {requirementsCoverageLine(event)}
                    </td>
                    <td className="px-3 py-2 text-pitch-gray-light">
                      {event.competitionName || "—"}
                    </td>
                    <td className="px-3 py-2 text-pitch-gray-light">
                      {event.assignmentsStatus}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedEventId(event.id)}
                        className="rounded border border-pitch-accent px-2 py-1 text-xs text-pitch-accent hover:bg-pitch-accent/10"
                      >
                        Gestisci accrediti
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {selectedEvent ? (
        <section className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-pitch-white">
                {eventTitle(selectedEvent)}
              </h3>
              <div className="text-sm text-pitch-gray-light">
                KO: {formatKo(selectedEvent.koItaly)} •{" "}
                {selectedEvent.venueName ?? "—"}
                {selectedEvent.venueCity ? `, ${selectedEvent.venueCity}` : ""}
              </div>
              <div className="text-sm text-pitch-gray-light">
                Competition: {selectedEvent.competitionName ?? "—"}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onExportPdf()}
                disabled={exporting != null}
                className="rounded border border-pitch-gray px-3 py-1.5 text-xs text-pitch-white hover:bg-pitch-gray-dark disabled:opacity-50"
              >
                {exporting === "pdf" ? "Esportazione..." : "Esporta PDF"}
              </button>
              <button
                type="button"
                onClick={() => void onExportXlsx()}
                disabled={exporting != null}
                className="rounded border border-pitch-gray px-3 py-1.5 text-xs text-pitch-white hover:bg-pitch-gray-dark disabled:opacity-50"
              >
                {exporting === "xlsx" ? "Esportazione..." : "Esporta Excel"}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                className="rounded bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-pitch-bg hover:bg-yellow-200"
              >
                Aggiungi accredito extra
              </button>
            </div>
          </div>

          {addOpen ? (
            <div className="mt-4 rounded-lg border border-pitch-gray-dark bg-pitch-bg/30 p-3">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  type="text"
                  value={staffQuery}
                  onChange={(e) => setStaffQuery(e.target.value)}
                  placeholder="Cerca persona staff..."
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                />
                <button
                  type="button"
                  onClick={() => void searchStaff()}
                  disabled={staffLoading || staffQuery.trim().length < 2}
                  className="rounded border border-pitch-gray px-3 py-2 text-xs text-pitch-white disabled:opacity-50"
                >
                  {staffLoading ? "Ricerca..." : "Cerca"}
                </button>
              </div>

              {staffOptions.length > 0 ? (
                <select
                  value={selectedStaffId ?? ""}
                  onChange={(e) =>
                    onStaffPicked(
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                  className="mt-3 w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                >
                  <option value="">Seleziona persona...</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.surname} {s.name}
                      {s.defaultRoleCode ? ` - ${s.defaultRoleCode}` : ""}
                      {s.company ? ` (${s.company})` : ""}
                    </option>
                  ))}
                </select>
              ) : null}

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  type="text"
                  value={formRoleCode}
                  onChange={(e) => setFormRoleCode(e.target.value)}
                  placeholder="Ruolo"
                  className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                />
                <input
                  type="text"
                  value={formAreas}
                  onChange={(e) => setFormAreas(e.target.value)}
                  placeholder="Aree"
                  className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                />
                <input
                  type="text"
                  value={formPlates}
                  onChange={(e) => setFormPlates(e.target.value)}
                  placeholder="Targa"
                  className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                />
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Note"
                  className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                />
              </div>

              {addError ? (
                <p className="mt-2 text-xs text-red-300">{addError}</p>
              ) : null}

              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded border border-pitch-gray px-3 py-1.5 text-xs text-pitch-gray-light"
                >
                  Chiudi
                </button>
                <button
                  type="button"
                  onClick={() => void onCreateAccredito()}
                  disabled={savingAdd || !selectedStaffId}
                  className="rounded bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-pitch-bg disabled:opacity-50"
                >
                  {savingAdd ? "Salvataggio..." : "Salva accredito"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-pitch-gray-dark text-left text-pitch-gray">
                  <th className="px-3 py-2">Azienda</th>
                  <th className="px-3 py-2">Cognome</th>
                  <th className="px-3 py-2">Nome</th>
                  <th className="px-3 py-2">Luogo nascita</th>
                  <th className="px-3 py-2">Data nascita</th>
                  <th className="px-3 py-2">Aree</th>
                  <th className="px-3 py-2">Ruolo</th>
                  <th className="px-3 py-2">Targa</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {itemsLoading ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-4 text-center text-pitch-gray">
                      Caricamento accrediti...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-4 text-center text-pitch-gray">
                      Nessun accredito presente.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={`${row.staffId}-${row.assignmentId ?? "na"}-${row.accreditationId ?? "na"}`}
                      className="border-b border-pitch-gray-dark/50"
                    >
                      <td className="px-3 py-2 text-pitch-gray-light">{row.company ?? "—"}</td>
                      <td className="px-3 py-2 text-pitch-gray-light">{row.surname ?? "—"}</td>
                      <td className="px-3 py-2 text-pitch-gray-light">{row.name ?? "—"}</td>
                      <td className="px-3 py-2 text-pitch-gray-light">
                        {row.placeOfBirth ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-pitch-gray-light">
                        {formatDate(row.dateOfBirth)}
                      </td>
                      <td className="px-3 py-2 text-pitch-gray-light">{row.areas ?? "—"}</td>
                      <td className="px-3 py-2 text-pitch-gray-light">{row.roleCode ?? "—"}</td>
                      <td className="px-3 py-2 text-pitch-gray-light">{row.plates ?? "—"}</td>
                      <td className="px-3 py-2 text-pitch-gray-light">{row.notes ?? "—"}</td>
                      <td className="px-3 py-2">
                        {row.accreditationId != null ? (
                          <button
                            type="button"
                            onClick={() => void onRemoveAccredito(row.accreditationId!)}
                            disabled={removingId === row.accreditationId}
                            className="rounded border border-red-500 px-2 py-1 text-xs text-red-400 disabled:opacity-50"
                          >
                            {removingId === row.accreditationId ? "Rimozione..." : "Rimuovi extra"}
                          </button>
                        ) : (
                          <span className="text-pitch-gray">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {itemsError ? (
              <p className="mt-2 text-xs text-red-300">{itemsError}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {selectedEvent ? (
        <section className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-4">
          <button
            type="button"
            onClick={() => setAreasLegendOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-pitch-white"
          >
            <span>Legenda aree ({ownerCode})</span>
            <span className="text-pitch-gray">{areasLegendOpen ? "▼" : "▶"}</span>
          </button>
          {areasLegendOpen ? (
            <div className="mt-3 space-y-4">
              {areasLoading ? (
                <p className="text-sm text-pitch-gray">Caricamento legenda...</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-pitch-gray-dark text-left text-pitch-gray">
                          <th className="px-3 py-2">Ruolo</th>
                          <th className="px-3 py-2">Aree assegnate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaMappings.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-3 text-pitch-gray">
                              Nessuna mappatura aree disponibile.
                            </td>
                          </tr>
                        ) : (
                          areaMappings.map((m) => (
                            <tr key={`${m.roleCode}-${m.areas}`} className="border-b border-pitch-gray-dark/50">
                              <td className="px-3 py-2 text-pitch-gray-light">{m.roleCode}</td>
                              <td className="px-3 py-2 text-pitch-gray-light">{m.areas}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-pitch-gray-dark text-left text-pitch-gray">
                          <th className="px-3 py-2">Area code</th>
                          <th className="px-3 py-2">Descrizione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaLegends.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-3 text-pitch-gray">
                              Nessuna legenda disponibile.
                            </td>
                          </tr>
                        ) : (
                          areaLegends.map((legend) => (
                            <tr key={`${legend.areaCode}-${legend.description}`} className="border-b border-pitch-gray-dark/50">
                              <td className="px-3 py-2 text-pitch-gray-light">{legend.areaCode}</td>
                              <td className="px-3 py-2 text-pitch-gray-light">{legend.description}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
