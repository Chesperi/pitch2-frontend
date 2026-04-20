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
  roles?: Array<{ roleCode: string; isPrimary?: boolean }>;
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
    roles: Array.isArray(raw.roles)
      ? raw.roles.reduce<Array<{ roleCode: string; isPrimary?: boolean }>>(
          (acc, role) => {
            const rec =
              role != null && typeof role === "object"
                ? (role as Record<string, unknown>)
                : null;
            if (!rec) return acc;
            const roleCode =
              rec.roleCode != null && String(rec.roleCode).trim() !== ""
                ? String(rec.roleCode).trim()
                : rec.role_code != null && String(rec.role_code).trim() !== ""
                  ? String(rec.role_code).trim()
                  : "";
            if (!roleCode) return acc;
            acc.push({
              roleCode,
              isPrimary: Boolean(rec.isPrimary ?? rec.is_primary),
            });
            return acc;
          },
          []
        )
      : undefined,
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

function displayAssignmentsStatusUi(
  status: string | null | undefined
): string {
  const u = String(status ?? "").trim().toUpperCase();
  if (u === "DRAFT") return "Draft";
  if (u === "READY") return "Ready";
  if (u === "SENT") return "Sent";
  if (u === "CONFIRMED") return "Confirmed";
  return String(status ?? "").trim() || "—";
}

function requirementsCoverageLine(event: AccreditoEvent): ReactNode {
  const covered = event.coveredAssignments;
  const total = event.totalAssignments;
  if (covered == null || total == null || total <= 0) return null;
  const colorClass = covered === total ? "text-green-400" : "text-amber-400";
  return (
    <div className={`mt-0.5 text-xs ${colorClass}`}>
      {covered === total ? "✓ " : ""}
      {covered}/{total} covered requirements
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
      setItemsError(
        err instanceof Error ? err.message : "Error loading accreditations"
      );
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
      setAddError("Error searching staff");
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
    const roleCode =
      staff.roles?.find((r) => r.isPrimary)?.roleCode ??
      staff.roles?.[0]?.roleCode ??
      "";
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
      setAddError("Select event and person.");
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
      setAddError(err instanceof Error ? err.message : "Error saving accreditation");
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
      <PageHeader title="Accreditations" />

      <section className="mt-4 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-semibold text-pitch-white">
            Ready for accreditation
          </h2>
          <SearchBar
            placeholder="Search match, show or competition..."
            onSearchChange={setEventSearch}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-pitch-gray-dark text-left text-pitch-gray">
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2">Competition</th>
                <th className="px-3 py-2">MD</th>
                <th className="px-3 py-2">Date &amp; KO</th>
                <th className="px-3 py-2">Assignments</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {eventsLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-pitch-gray">
                    Loading events...
                  </td>
                </tr>
              ) : filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-pitch-gray">
                    No events available.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((event) => (
                  <tr key={event.id} className="border-b border-pitch-gray-dark/50">
                    <td className="px-3 py-2 text-pitch-gray-light">
                      <div>{eventTitle(event)}</div>
                      {requirementsCoverageLine(event)}
                    </td>
                    <td className="px-3 py-2 text-pitch-gray-light">
                      {event.competitionName || "—"}
                    </td>
                    <td className="px-3 py-2 text-pitch-gray-light">{event.matchDay ?? "—"}</td>
                    <td className="px-3 py-2 text-pitch-gray-light">{formatKo(event.koItaly)}</td>
                    <td className="px-3 py-2 text-pitch-gray-light">
                      {displayAssignmentsStatusUi(event.assignmentsStatus)}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => setSelectedEventId(event.id)}
                        className="rounded border border-pitch-accent px-2 py-1 text-xs text-pitch-accent hover:bg-pitch-accent/10"
                      >
                        Manage
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
                {exporting === "pdf" ? "Exporting..." : "Export PDF"}
              </button>
              <button
                type="button"
                onClick={() => void onExportXlsx()}
                disabled={exporting != null}
                className="rounded border border-pitch-gray px-3 py-1.5 text-xs text-pitch-white hover:bg-pitch-gray-dark disabled:opacity-50"
              >
                {exporting === "xlsx" ? "Exporting..." : "Export Excel"}
              </button>
              <button
                type="button"
                onClick={() => setAddOpen((v) => !v)}
                className="rounded bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-pitch-bg hover:bg-yellow-200"
              >
                Add extra accreditation
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
                  placeholder="Search staff..."
                  className="w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                />
                <button
                  type="button"
                  onClick={() => void searchStaff()}
                  disabled={staffLoading || staffQuery.trim().length < 2}
                  className="rounded border border-pitch-gray px-3 py-2 text-xs text-pitch-white disabled:opacity-50"
                >
                  {staffLoading ? "Search..." : "Search"}
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
                  <option value="">Select person...</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.surname} {s.name}
                      {s.roles?.[0]?.roleCode ? ` - ${s.roles[0].roleCode}` : ""}
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
                  placeholder="Role"
                  className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                />
                <input
                  type="text"
                  value={formAreas}
                  onChange={(e) => setFormAreas(e.target.value)}
                  placeholder="Areas"
                  className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                />
                <input
                  type="text"
                  value={formPlates}
                  onChange={(e) => setFormPlates(e.target.value)}
                  placeholder="Plate"
                  className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                />
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Notes"
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
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void onCreateAccredito()}
                  disabled={savingAdd || !selectedStaffId}
                  className="rounded bg-pitch-accent px-3 py-1.5 text-xs font-semibold text-pitch-bg disabled:opacity-50"
                >
                  {savingAdd ? "Saving..." : "Save accreditation"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-pitch-gray-dark text-left text-pitch-gray">
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Company</th>
                  <th className="px-3 py-2">Last name</th>
                  <th className="px-3 py-2">First name</th>
                  <th className="px-3 py-2">Place of birth</th>
                  <th className="px-3 py-2">Date of birth</th>
                  <th className="px-3 py-2">Areas</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Plate</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {itemsLoading ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-4 text-center text-pitch-gray">
                      Loading accreditations...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-4 text-center text-pitch-gray">
                      No accreditations found.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr
                      key={`${row.staffId}-${row.assignmentId ?? "na"}-${row.accreditationId ?? "na"}`}
                      className="border-b border-pitch-gray-dark/50"
                    >
                      <td className="px-3 py-2 text-pitch-gray-light">
                        {row.assignmentId != null ? (
                          <span className="rounded-full border border-[#818cf8]/30 bg-[#1a1a2e] px-2 py-0.5 text-[10px] text-[#818cf8]">
                            Assignment
                          </span>
                        ) : (
                          <span className="rounded-full border border-[#fb923c]/30 bg-[#2e1e0a] px-2 py-0.5 text-[10px] text-[#fb923c]">
                            Extra
                          </span>
                        )}
                      </td>
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
                            {removingId === row.accreditationId ? "Removing..." : "Remove extra"}
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
            <span>Areas legend ({ownerCode})</span>
            <span className="text-pitch-gray">{areasLegendOpen ? "▼" : "▶"}</span>
          </button>
          {areasLegendOpen ? (
            <div className="mt-3 space-y-4">
              {areasLoading ? (
                <p className="text-sm text-pitch-gray">Loading legend...</p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-pitch-gray-dark text-left text-pitch-gray">
                          <th className="px-3 py-2">Role</th>
                          <th className="px-3 py-2">Assigned areas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaMappings.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-3 text-pitch-gray">
                              No areas mapping available.
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
                          <th className="px-3 py-2">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        {areaLegends.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="px-3 py-3 text-pitch-gray">
                              No legend available.
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
