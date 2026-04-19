"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import {
  fetchEvents,
  fetchEventById,
  createEvent,
  updateEvent,
  bulkUpdateEventsStatus,
  bulkPermanentDeleteEvents,
  type EventItem,
  type EventAssignmentsStatus,
  type CreateEventPayload,
  type EventFilters,
} from "@/lib/api/events";
import { getApiBaseUrl } from "@/lib/api/config";
import { downloadBackendFile } from "@/lib/utils/downloadFile";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import { ImportEventsModal } from "./ImportEventsModal";
import { fetchLookupValues } from "@/lib/api/lookupValues";
import { apiFetch } from "@/lib/api/apiFetch";
import type { LookupValue } from "@/lib/types";
import type { ReactNode } from "react";
import StatusBadge from "@/components/ui/StatusBadge";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PrimaryButton from "@/components/ui/PrimaryButton";
import PageLoading from "@/components/ui/PageLoading";
import EmptyState from "@/components/ui/EmptyState";

function formatKoItaly(koItaly: string | null): string {
  if (!koItaly) return "—";
  const direct = koItaly.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (direct) {
    const [, y, m, d, hh, mm] = direct;
    const parsed = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(parsed);
  }
  try {
    const date = new Date(koItaly);
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  } catch {
    return koItaly;
  }
}

function toDatetimeLocalValueFromEvent(event: EventItem): string {
  const rawDate = (event as EventItem & { date?: string }).date;
  const rawKoTime = (event as EventItem & { koItalyTime?: string; ko_italy_time?: string })
    .koItalyTime ?? (event as EventItem & { ko_italy_time?: string }).ko_italy_time;
  const date = typeof rawDate === "string" ? rawDate.trim() : "";
  const koTime = typeof rawKoTime === "string" ? rawKoTime.trim() : "";
  if (date && koTime) {
    return `${date}T${koTime.slice(0, 5)}`;
  }

  const ko = event.koItaly?.trim() ?? "";
  if (!ko) return "";
  const direct = ko.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
  if (direct) return `${direct[1]}T${direct[2]}`;

  const d = new Date(ko);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function eventStatusBadgeEl(status: string | null): ReactNode {
  const value = status?.toUpperCase() ?? "";
  if (value === "TBC" || value === "TBD") {
    return <StatusBadge variant="pending" label="To confirm" />;
  }
  if (value === "OK") {
    return <StatusBadge variant="complete" label="OK" />;
  }
  if (value === "CONFIRMED") {
    return <StatusBadge variant="confirmed" label="Confirmed" />;
  }
  if (value === "CANCELLED" || value === "CANCELED") {
    return <StatusBadge variant="cancelled" label="Cancelled" />;
  }
  if (!status?.trim()) {
    return <span className="text-xs text-pitch-gray">—</span>;
  }
  return (
    <span className="rounded-full bg-pitch-gray-dark px-2 py-0.5 text-xs text-pitch-gray-light">
      {status}
    </span>
  );
}

function assignmentsStatusBadgeEl(
  status: EventAssignmentsStatus | null | undefined
): ReactNode {
  if (!status) {
    return <span className="text-xs text-pitch-gray">—</span>;
  }
  switch (status) {
    case "DRAFT":
      return <StatusBadge variant="draft" label="Draft" />;
    case "READY_TO_SEND":
      return <StatusBadge variant="pending" label="Ready" />;
    case "SENT":
      return <StatusBadge variant="accepted" label="Sent" />;
    default:
      return (
        <span className="rounded-full bg-pitch-gray-dark px-2 py-0.5 text-xs text-pitch-gray-light">
          {status}
        </span>
      );
  }
}

const CATEGORY_OPTIONS = ["MATCH", "STUDIO SHOW", "MEDIA CONTENT", "OTHER"];
const STATUS_OPTIONS = ["TBC", "TBD", "OK", "CONFIRMED", "CANCELLED"];

function EventFormLookupSelect({
  label,
  value,
  onChange,
  options,
  prependOptions = [],
  inputClassName,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  options: LookupValue[];
  prependOptions?: string[];
  inputClassName: string;
}) {
  const v = value ?? "";
  const mergedOptions = [
    ...prependOptions,
    ...options.map((o) => o.value),
  ].filter((value, idx, arr) => arr.indexOf(value) === idx);
  const inList = mergedOptions.includes(v);
  return (
    <div>
      <label className="mb-1 block text-xs text-pitch-gray">{label}</label>
      <select
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className={inputClassName}
      >
        <option value="">— select —</option>
        {mergedOptions.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
        {v && !inList ? (
          <option value={v}>{v} (not in list)</option>
        ) : null}
      </select>
    </div>
  );
}

function EventModal({
  event,
  onClose,
  onSaved,
}: {
  event: EventItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CreateEventPayload>(() =>
    event
      ? {
          category: event.category,
          competitionName: event.competitionName,
          competitionCode: event.competitionCode ?? "",
          matchDay: event.matchDay,
          homeTeamNameShort: event.homeTeamNameShort,
          awayTeamNameShort: event.awayTeamNameShort,
          venueName: event.venueName ?? "",
          venueCity: event.venueCity ?? "",
          venueAddress: event.venueAddress ?? "",
          koItaly: toDatetimeLocalValueFromEvent(event),
          preDurationMinutes: event.preDurationMinutes,
          standardOnsite: event.standardOnsite ?? "",
          standardCologno: event.standardCologno ?? "",
          showName: event.showName ?? "",
          status: event.status,
          rightsHolder: event.rightsHolder ?? "",
          facilities: event.facilities ?? "",
          studio: event.studio ?? "",
          notes: event.notes ?? "",
          isTopMatch: Boolean(event.isTopMatch),
        }
      : {
          category: "MATCH",
          competitionName: "",
          competitionCode: "",
          matchDay: "",
          homeTeamNameShort: "",
          awayTeamNameShort: "",
          venueName: "",
          venueCity: "",
          venueAddress: "",
          koItaly: "",
          preDurationMinutes: 0,
          standardOnsite: "",
          standardCologno: "",
          showName: "",
          status: "TBC",
          rightsHolder: "",
          facilities: "",
          studio: "",
          notes: "",
          isTopMatch: false,
        }
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState<"pdf" | "xlsx" | null>(null);
  const [lookupOnsite, setLookupOnsite] = useState<LookupValue[]>([]);
  const [lookupCologno, setLookupCologno] = useState<LookupValue[]>([]);
  const [lookupFacilities, setLookupFacilities] = useState<LookupValue[]>([]);
  const [lookupStudio, setLookupStudio] = useState<LookupValue[]>([]);
  const [lookupShow, setLookupShow] = useState<LookupValue[]>([]);
  const [lookupRightsHolder, setLookupRightsHolder] = useState<LookupValue[]>(
    []
  );
  const isMediaContent = form.category === "MEDIA CONTENT";
  const isStudioShow = form.category === "STUDIO SHOW";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [a, b, c, d, e, f] = await Promise.all([
          fetchLookupValues("standard_onsite"),
          fetchLookupValues("standard_cologno"),
          fetchLookupValues("facilities"),
          fetchLookupValues("studio"),
          fetchLookupValues("show"),
          fetchLookupValues("rights_holder"),
        ]);
        if (!cancelled) {
          setLookupOnsite(a);
          setLookupCologno(b);
          setLookupFacilities(c);
          setLookupStudio(d);
          setLookupShow(e);
          setLookupRightsHolder(f);
        }
      } catch {
        if (!cancelled) {
          setLookupOnsite([]);
          setLookupCologno([]);
          setLookupFacilities([]);
          setLookupStudio([]);
          setLookupShow([]);
          setLookupRightsHolder([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: CreateEventPayload = {
        ...form,
        competitionCode: form.competitionCode || undefined,
        venueName: form.venueName || undefined,
        venueCity: form.venueCity || undefined,
        venueAddress: form.venueAddress || undefined,
        standardOnsite: form.standardOnsite || undefined,
        standardCologno: form.standardCologno || undefined,
        showName: form.showName || undefined,
        rightsHolder: form.rightsHolder?.trim() || null,
        facilities: form.facilities?.trim() || null,
        studio: form.studio?.trim() || null,
        notes: form.notes?.trim() || null,
        isTopMatch: form.isTopMatch ?? false,
      };
      if (event) {
        await updateEvent(event.id, payload);
      } else {
        await createEvent(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    const ok = window.confirm(
      "This will permanently delete the event. This action cannot be undone. Are you sure?"
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await apiFetch(
        `/api/events/${encodeURIComponent(event.id)}/permanent`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error deleting event");
    } finally {
      setDeleting(false);
    }
  };

  const handleAccreditiDownloadInModal = async (type: "pdf" | "xlsx") => {
    if (!event) return;
    setExporting(type);
    try {
      await downloadAccreditiExport(event.id, type);
    } finally {
      setExporting(null);
    }
  };

  const inputClass =
    "w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-6">
        <h3 className="mb-4 text-lg font-semibold text-pitch-white">
          {event ? "Edit event" : "New event"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className={
              form.category === "MATCH"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-3"
                : "grid grid-cols-1 gap-4 sm:grid-cols-2"
            }
          >
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className={inputClass}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">Status</label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value }))
                }
                className={inputClass}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            {form.category === "MATCH" ? (
              <div className="flex flex-col justify-end">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-pitch-white">
                  <input
                    type="checkbox"
                    checked={form.isTopMatch ?? false}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isTopMatch: e.target.checked }))
                    }
                    className="rounded border-pitch-gray-dark"
                  />
                  Top match
                </label>
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">
              {isMediaContent
                ? "Competition / Project"
                : isStudioShow
                  ? "Competition / Partner"
                  : "Competition"}
            </label>
            <input
              type="text"
              value={form.competitionName}
              onChange={(e) =>
                setForm((f) => ({ ...f, competitionName: e.target.value }))
              }
              className={inputClass}
              required
            />
          </div>
          {!isMediaContent ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  {isStudioShow ? "Episode" : "Matchday"}
                </label>
                <input
                  type="text"
                  value={form.matchDay}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, matchDay: e.target.value }))
                  }
                  className={inputClass}
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {!isStudioShow ? (
                  <div>
                  <label className="mb-1 block text-xs text-pitch-gray">
                    Home team
                  </label>
                  <input
                    type="text"
                    value={form.homeTeamNameShort}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, homeTeamNameShort: e.target.value }))
                    }
                    className={inputClass}
                    required
                  />
                  </div>
                ) : null}
                {!isStudioShow ? (
                  <div>
                  <label className="mb-1 block text-xs text-pitch-gray">
                    Away team
                  </label>
                  <input
                    type="text"
                    value={form.awayTeamNameShort}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, awayTeamNameShort: e.target.value }))
                    }
                    className={inputClass}
                    required
                  />
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                KO date/time (ISO)
              </label>
              <input
                type="datetime-local"
                value={form.koItaly ? form.koItaly.slice(0, 16) : ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    koItaly: e.target.value,
                  }))
                }
                className={inputClass}
                required={!isStudioShow}
              />
            </div>
            {!isMediaContent ? (
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  PRE (minutes)
                </label>
                <input
                  type="number"
                  value={form.preDurationMinutes}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      preDurationMinutes: parseInt(e.target.value, 10) || 0,
                    }))
                  }
                  className={inputClass}
                  min={0}
                />
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EventFormLookupSelect
              label="Standard onsite"
              value={form.standardOnsite}
              onChange={(v) =>
                setForm((f) => ({ ...f, standardOnsite: v }))
              }
              options={lookupOnsite}
              inputClassName={inputClass}
            />
            <EventFormLookupSelect
              label="Standard Cologno"
              value={form.standardCologno}
              onChange={(v) =>
                setForm((f) => ({ ...f, standardCologno: v }))
              }
              options={lookupCologno}
              inputClassName={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {!isMediaContent ? (
              <>
                {!isStudioShow ? (
                  <div>
                  <label className="mb-1 block text-xs text-pitch-gray">
                    Venue name
                  </label>
                  <input
                    type="text"
                    value={form.venueName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, venueName: e.target.value }))
                    }
                    className={inputClass}
                  />
                  </div>
                ) : null}
                {!isStudioShow ? (
                  <div>
                  <label className="mb-1 block text-xs text-pitch-gray">
                    Venue city
                  </label>
                  <input
                    type="text"
                    value={form.venueCity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, venueCity: e.target.value }))
                    }
                    className={inputClass}
                  />
                  </div>
                ) : null}
              </>
            ) : null}
            <EventFormLookupSelect
              label="Show"
              value={form.showName}
              onChange={(v) => setForm((f) => ({ ...f, showName: v }))}
              options={lookupShow}
              inputClassName={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <EventFormLookupSelect
              label="Facilities"
              value={form.facilities ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, facilities: v }))}
              options={lookupFacilities}
              inputClassName={inputClass}
            />
            {!isMediaContent && !isStudioShow ? (
              <EventFormLookupSelect
                label="Rights holder"
                value={form.rightsHolder ?? ""}
                onChange={(v) => setForm((f) => ({ ...f, rightsHolder: v }))}
                options={lookupRightsHolder}
                inputClassName={inputClass}
              />
            ) : null}
            <EventFormLookupSelect
              label="Studio"
              value={form.studio ?? ""}
              onChange={(v) => setForm((f) => ({ ...f, studio: v }))}
              options={lookupStudio}
              prependOptions={["-"]}
              inputClassName={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">
              Event notes
            </label>
            <textarea
              value={form.notes ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              rows={3}
              className={inputClass}
            />
          </div>
          {event ? (
            <div className="rounded border border-pitch-gray-dark/60 p-3">
              <div className="mb-2 text-xs text-pitch-gray">Accreditations</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={exportBtnClass}
                  disabled={exporting != null}
                  onClick={() => void handleAccreditiDownloadInModal("pdf")}
                >
                  {exporting === "pdf" ? "PDF…" : "PDF"}
                </button>
                <button
                  type="button"
                  className={exportBtnClass}
                  disabled={exporting != null}
                  onClick={() => void handleAccreditiDownloadInModal("xlsx")}
                >
                  {exporting === "xlsx" ? "XLSX…" : "XLSX"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 pt-4">
            <div>
              {event ? (
                <button
                  type="button"
                  onClick={() => void handleDelete()}
                  disabled={deleting || saving}
                  className="rounded border border-red-400 px-4 py-2 text-sm text-red-400 hover:bg-red-900/20 disabled:opacity-50"
                >
                  {deleting ? "Deleting permanently…" : "Delete permanently"}
                </button>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-pitch-gray-dark px-4 py-2 text-sm text-pitch-gray-light hover:bg-pitch-gray-dark"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function BulkDeleteModal({
  count,
  deleting,
  onCancel,
  onConfirm,
}: {
  count: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-md rounded-lg border border-pitch-gray-dark bg-pitch-bg p-5">
        <h3 className="text-base font-semibold text-pitch-white">
          Conferma eliminazione
        </h3>
        <p className="mt-2 text-sm text-pitch-gray-light">
          Eliminare definitivamente {count} eventi? Questa operazione non è reversibile.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded border border-red-700 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/30 disabled:opacity-50"
          >
            {deleting ? "Eliminazione..." : "Elimina selezionati"}
          </button>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 50;

const filterSelectClass =
  "rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

const exportBtnClass =
  "rounded border border-pitch-gray-dark px-2 py-1 text-[11px] font-medium text-pitch-white hover:bg-pitch-gray-dark disabled:cursor-not-allowed disabled:opacity-50";

async function downloadAccreditiExport(
  eventId: string,
  type: "pdf" | "xlsx"
): Promise<void> {
  const base = getApiBaseUrl();
  const enc = encodeURIComponent(eventId);
  const path =
    type === "pdf"
      ? `/api/accrediti/${enc}/pdf`
      : `/api/accrediti/${enc}/export-xlsx`;
  const url = new URL(path, base).toString();
  const filename =
    type === "pdf"
      ? `accrediti-event-${eventId}.pdf`
      : `accrediti-event-${eventId}.xlsx`;

  await downloadBackendFile({
    url,
    filename,
    onError: () => {
      alert("Error downloading file");
    },
  });
}

export default function EventiPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<EventFilters>({
    category: undefined,
    assignmentsStatus: undefined,
  });
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["ALL"]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["ALL"]);
  const [selectedAssignmentStatuses, setSelectedAssignmentStatuses] = useState<string[]>(["ALL"]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFlash, setImportFlash] = useState<string | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [autoMatchingCombos, setAutoMatchingCombos] = useState(false);

  const canImportMatches =
    userLevel != null &&
    ["MANAGER", "MASTER"].includes(userLevel.toUpperCase().trim());
  const canAutoMatchCombos = canImportMatches;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const me = await fetchAuthMe();
        if (!cancelled) {
          setUserLevel((me.user_level ?? "").toUpperCase().trim() || null);
        }
      } catch {
        if (!cancelled) setUserLevel(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const { items, total: t } = await fetchEvents({
        page,
        pageSize: PAGE_SIZE,
        filters,
      });
      setEvents(items);
      setTotal(t);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = events.filter((e) => {
      const st = (e.status ?? "").toUpperCase().trim();
      const withToConfirm = st === "TBC" || st === "TBD";
      const withCancelled = st === "CANCELED" || st === "CANCELLED";
      const isAll = selectedStatuses.length === 0 || selectedStatuses.includes("ALL");
      const statusMatch =
        isAll ||
        selectedStatuses.some((s) => {
          if (s === "TO_CONFIRM") return withToConfirm;
          if (s === "CANCELLED") return withCancelled;
          return st === s;
        });
      if (!statusMatch) return false;

      const catRaw = (e.category ?? "").toUpperCase().trim();
      const catNorm = catRaw.replace(/_/g, " ");
      const categoryAll =
        selectedCategories.length === 0 || selectedCategories.includes("ALL");
      const categoryMatch =
        categoryAll ||
        selectedCategories.some((c) => catNorm === c || catRaw === c);
      if (!categoryMatch) return false;

      const asg = (e.assignmentsStatus ?? "").toUpperCase().trim();
      const assignmentAll =
        selectedAssignmentStatuses.length === 0 ||
        selectedAssignmentStatuses.includes("ALL");
      const assignmentMatch =
        assignmentAll || selectedAssignmentStatuses.some((s) => s === asg);
      if (!assignmentMatch) return false;

      if (!q) return true;
      return (
        e.competitionName?.toLowerCase().includes(q) ||
        e.homeTeamNameShort?.toLowerCase().includes(q) ||
        e.awayTeamNameShort?.toLowerCase().includes(q) ||
        e.showName?.toLowerCase().includes(q)
      );
    });
    return list;
  }, [events, search, selectedStatuses, selectedCategories, selectedAssignmentStatuses]);

  useEffect(() => {
    setSelectedEventIds(new Set());
  }, [events, page, search, selectedStatuses, selectedCategories, selectedAssignmentStatuses]);

  const orderedEvents = useMemo(() => {
    const isCancelled = (ev: EventItem) => {
      const s = (ev.status ?? "").toUpperCase().trim();
      return s === "CANCELED" || s === "CANCELLED";
    };
    const activeEvents = filteredEvents.filter((e) => !isCancelled(e));
    const cancelledEvents = filteredEvents.filter((e) => isCancelled(e));
    return [...activeEvents, ...cancelledEvents];
  }, [filteredEvents]);

  const allVisibleSelected =
    orderedEvents.length > 0 &&
    orderedEvents.every((e) => selectedEventIds.has(e.id));

  const handleToggleSelectAllVisible = () => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const e of orderedEvents) next.delete(e.id);
      } else {
        for (const e of orderedEvents) next.add(e.id);
      }
      return next;
    });
  };

  const handleToggleRowSelection = (eventId: string) => {
    setSelectedEventIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const handleBulkSetOk = async () => {
    if (selectedEventIds.size === 0) return;
    setBulkUpdating(true);
    try {
      await bulkUpdateEventsStatus({
        eventIds: Array.from(selectedEventIds),
        status: "OK",
      });
      setSelectedEventIds(new Set());
      await loadEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk update failed");
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleOpenBulkDeleteModal = () => {
    if (selectedEventIds.size === 0) return;
    setShowBulkDeleteModal(true);
  };

  const handleBulkDelete = async () => {
    if (selectedEventIds.size === 0) return;
    setBulkDeleting(true);
    try {
      await bulkPermanentDeleteEvents({
        eventIds: Array.from(selectedEventIds),
      });
      setSelectedEventIds(new Set());
      setShowBulkDeleteModal(false);
      await loadEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleAutoMatchCombos = async () => {
    setAutoMatchingCombos(true);
    try {
      const res = await apiFetch("/api/events/auto-match-combos", {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      const payload = (await res.json()) as {
        matched: number;
        unmatched: number;
        unmatchedEvents?: Array<{
          id: string;
          homeTeam: string | null;
          awayTeam: string | null;
          onsite: string | null;
          cologno: string | null;
          facilities: string | null;
          studio: string | null;
        }>;
      };

      let message = `${payload.matched} eventi collegati al combo standard. ${payload.unmatched} eventi senza corrispondenza.`;
      if (payload.unmatched > 0 && Array.isArray(payload.unmatchedEvents)) {
        const lines = payload.unmatchedEvents.map((e) => {
          const match =
            e.homeTeam || e.awayTeam
              ? `${e.homeTeam ?? "—"} vs ${e.awayTeam ?? "—"}`
              : "—";
          return `- ${e.id} | ${match} | onsite=${e.onsite ?? "—"} | cologno=${e.cologno ?? "—"} | facilities=${e.facilities ?? "—"} | studio=${e.studio ?? "—"}`;
        });
        message += `\n\nEventi senza match:\n${lines.join("\n")}`;
      }
      alert(message);
      await loadEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Auto-match failed");
    } finally {
      setAutoMatchingCombos(false);
    }
  };

  const showModal = isCreateModalOpen || editingEvent !== null;

  return (
    <>
      <PageHeader
        title="Events"
        actions={
          <div className="flex flex-wrap gap-2">
            {canImportMatches ? (
              <PrimaryButton
                type="button"
                variant="secondary"
                onClick={() => setImportModalOpen(true)}
                className="border-pitch-accent text-pitch-accent hover:bg-pitch-accent/10"
              >
                Import matches
              </PrimaryButton>
            ) : null}
            <PrimaryButton
              type="button"
              variant="primary"
              onClick={() => {
                setEditingEvent(null);
                setIsCreateModalOpen(true);
              }}
            >
              New event
            </PrimaryButton>
          </div>
        }
      />
      {importFlash ? (
        <p className="mt-2 rounded border border-green-900/40 bg-green-950/30 px-3 py-2 text-sm text-green-200">
          {importFlash}
        </p>
      ) : null}
      <ImportEventsModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={({ imported, zonaCreated }) => {
          setImportFlash(
            zonaCreated > 0
              ? `${imported} matches imported, ${zonaCreated} Zona events created`
              : `${imported} matches imported`
          );
          window.setTimeout(() => setImportFlash(null), 5000);
          void loadEvents();
        }}
      />
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <SearchBar
            placeholder="Search events..."
            onSearchChange={setSearch}
          />
        </div>
        {canAutoMatchCombos ? (
          <div>
            <button
              type="button"
              onClick={() => void handleAutoMatchCombos()}
              disabled={autoMatchingCombos}
              className="rounded border border-pitch-accent px-3 py-2 text-sm font-medium text-pitch-accent hover:bg-pitch-accent/10 disabled:opacity-50"
            >
              {autoMatchingCombos ? "Auto-matching..." : "Auto-match standards"}
            </button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">Status</label>
            <div className="flex flex-wrap gap-1.5 rounded border border-pitch-gray-dark bg-pitch-gray-dark p-1.5">
              {[
                { id: "ALL", label: "All" },
                { id: "TBC", label: "TBC" },
                { id: "TBD", label: "TBD" },
                { id: "OK", label: "OK" },
                { id: "CONFIRMED", label: "Confirmed" },
                { id: "TO_CONFIRM", label: "To confirm" },
                { id: "CANCELLED", label: "Cancelled" },
              ].map((opt) => {
                const active = selectedStatuses.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedStatuses((prev) => {
                        if (opt.id === "ALL") return ["ALL"];
                        const base = prev.filter((s) => s !== "ALL");
                        const has = base.includes(opt.id);
                        const next = has ? base.filter((s) => s !== opt.id) : [...base, opt.id];
                        return next.length === 0 ? ["ALL"] : next;
                      });
                    }}
                    className={`rounded px-2 py-1 text-xs ${
                      active
                        ? "bg-pitch-accent text-pitch-bg"
                        : "text-pitch-gray-light hover:bg-pitch-gray-dark/50 hover:text-pitch-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">
              Category
            </label>
            <div className="flex flex-wrap gap-1.5 rounded border border-pitch-gray-dark bg-pitch-gray-dark p-1.5">
              {[
                { id: "ALL", label: "All" },
                { id: "MATCH", label: "MATCH" },
                { id: "STUDIO SHOW", label: "STUDIO SHOW" },
                { id: "MEDIA CONTENT", label: "MEDIA CONTENT" },
                { id: "OTHER", label: "OTHER" },
              ].map((opt) => {
                const active = selectedCategories.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategories((prev) => {
                        if (opt.id === "ALL") return ["ALL"];
                        const base = prev.filter((s) => s !== "ALL");
                        const has = base.includes(opt.id);
                        const next = has ? base.filter((s) => s !== opt.id) : [...base, opt.id];
                        return next.length === 0 ? ["ALL"] : next;
                      });
                    }}
                    className={`rounded px-2 py-1 text-xs ${
                      active
                        ? "bg-pitch-accent text-pitch-bg"
                        : "text-pitch-gray-light hover:bg-pitch-gray-dark/50 hover:text-pitch-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">
              Assignment status
            </label>
            <div className="flex flex-wrap gap-1.5 rounded border border-pitch-gray-dark bg-pitch-gray-dark p-1.5">
              {[
                { id: "ALL", label: "All" },
                { id: "DRAFT", label: "Draft" },
                { id: "READY_TO_SEND", label: "Ready" },
                { id: "SENT", label: "Sent" },
              ].map((opt) => {
                const active = selectedAssignmentStatuses.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedAssignmentStatuses((prev) => {
                        if (opt.id === "ALL") return ["ALL"];
                        const base = prev.filter((s) => s !== "ALL");
                        const has = base.includes(opt.id);
                        const next = has ? base.filter((s) => s !== opt.id) : [...base, opt.id];
                        return next.length === 0 ? ["ALL"] : next;
                      });
                    }}
                    className={`rounded px-2 py-1 text-xs ${
                      active
                        ? "bg-pitch-accent text-pitch-bg"
                        : "text-pitch-gray-light hover:bg-pitch-gray-dark/50 hover:text-pitch-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {selectedEventIds.size > 0 ? (
        <div className="mt-4 flex items-center justify-between rounded border border-pitch-gray-dark bg-pitch-gray-dark/40 px-4 py-3">
          <span className="text-sm text-pitch-gray-light">
            {selectedEventIds.size} eventi selezionati
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => void handleBulkSetOk()}
              className="min-h-[40px] rounded bg-pitch-accent px-3 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50"
            >
              {bulkUpdating ? "Updating..." : "Imposta Standard OK"}
            </button>
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={handleOpenBulkDeleteModal}
              className="min-h-[40px] rounded border border-red-700 px-3 py-2 text-sm font-medium text-red-300 hover:bg-red-900/30 disabled:opacity-50"
            >
              Elimina selezionati
            </button>
          </div>
        </div>
      ) : null}
      {total > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-pitch-gray-light">
          <span>
            Page {page + 1} of {Math.max(1, Math.ceil(total / PAGE_SIZE))} (
            {total} events)
          </span>
          <button
            type="button"
            disabled={page <= 0 || isLoading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="min-h-[40px] rounded border border-pitch-gray-dark px-3 py-2 text-pitch-white hover:bg-pitch-gray-dark disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={
              isLoading || (page + 1) * PAGE_SIZE >= total
            }
            onClick={() => setPage((p) => p + 1)}
            className="min-h-[40px] rounded border border-pitch-gray-dark px-3 py-2 text-pitch-white hover:bg-pitch-gray-dark disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
      <div className="mt-6">
        {isLoading ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
            <PageLoading />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
            <EmptyState message="Nessun evento trovato" icon="calendar" />
          </div>
        ) : (
          <ResponsiveTable minWidth="1260px">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAllVisible}
                    className="h-4 w-4 rounded border-pitch-gray-dark"
                    aria-label="Seleziona tutti gli eventi visibili"
                  />
                </th>
                <th className="min-w-[140px] px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Match
                </th>
                <th className="min-w-[100px] px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Competition
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Rights
                </th>
                <th className="min-w-[40px] px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  MD
                </th>
                <th className="min-w-[130px] px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  KO
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  PRE
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Standard Onsite
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Standard Cologno
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Facilities
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Studio
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Show
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Assignments
                </th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const isCancelled = (ev: EventItem) => {
                  const s = (ev.status ?? "").toUpperCase().trim();
                  return s === "CANCELED" || s === "CANCELLED";
                };
                const activeEvents = orderedEvents.filter((e) => !isCancelled(e));
                const cancelledEvents = orderedEvents.filter((e) => isCancelled(e));
                return orderedEvents.flatMap((event, idx) => {
                const rows = [];
                const eventCategory = (event.category ?? "").toUpperCase().trim();
                const match =
                  eventCategory === "STUDIO SHOW"
                    ? event.showName?.trim() || event.competitionName?.trim() || "—"
                    : event.homeTeamNameShort && event.awayTeamNameShort
                      ? `${event.homeTeamNameShort} vs ${event.awayTeamNameShort}`
                      : event.homeTeamNameShort ??
                        event.awayTeamNameShort ??
                        "—";
                const rightsTrimmed = event.rightsHolder?.trim() ?? "";
                if (cancelledEvents.length > 0 && idx === activeEvents.length) {
                  rows.push(
                    <tr key="cancelled-separator" className="border-y border-pitch-gray-dark/80 bg-pitch-gray-dark/20">
                      <td colSpan={14} className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-pitch-gray">
                        Cancelled events
                      </td>
                    </tr>
                  );
                }
                rows.push(
                  <tr
                    key={event.id}
                    onClick={() =>
                      void (async () => {
                        setIsCreateModalOpen(false);
                        const full = await fetchEventById(event.id).catch(() => null);
                        setEditingEvent(full ?? event);
                      })()
                    }
                    className="cursor-pointer border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEventIds.has(event.id)}
                        onChange={() => handleToggleRowSelection(event.id)}
                        className="h-4 w-4 rounded border-pitch-gray-dark"
                        aria-label={`Seleziona evento ${event.id}`}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-white">
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {event.isTopMatch ? (
                          <span className="mr-1 rounded bg-yellow-400 px-1 text-xs font-bold text-black">
                            TOP
                          </span>
                        ) : null}
                        <span>{match}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.competitionName}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.category}
                    </td>
                    <td
                      className={`max-w-[7rem] truncate px-4 py-3 text-sm ${
                        rightsTrimmed === "SKY/DAZN"
                          ? "text-red-400"
                          : "text-pitch-gray-light"
                      }`}
                      title={rightsTrimmed || undefined}
                    >
                      {rightsTrimmed ? rightsTrimmed : "—"}
                    </td>
                    <td className="min-w-[40px] px-4 py-3 text-sm text-pitch-gray-light">
                      {event.matchDay?.trim()
                        ? event.matchDay
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {formatKoItaly(event.koItaly)}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      <span
                        className={
                          event.preDurationMinutes === 75
                            ? "text-red-400"
                            : event.preDurationMinutes === 60
                              ? "text-blue-400"
                              : event.preDurationMinutes === 45
                                ? "text-green-400"
                                : event.preDurationMinutes === 30
                                  ? "text-white"
                                  : event.preDurationMinutes === 15
                                    ? "text-yellow-300"
                                    : ""
                        }
                      >
                        {event.preDurationMinutes}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.standardOnsite ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.standardCologno ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.facilities ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.studio ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.showName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {eventStatusBadgeEl(event.status)}
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {assignmentsStatusBadgeEl(event.assignmentsStatus)}
                    </td>
                  </tr>
                );
                return rows;
                });
              })()}
            </tbody>
          </table>
          </ResponsiveTable>
        )}
      </div>

      {showModal && (
        <EventModal
          event={editingEvent}
          onClose={() => {
            setEditingEvent(null);
            setIsCreateModalOpen(false);
          }}
          onSaved={loadEvents}
        />
      )}
      {showBulkDeleteModal ? (
        <BulkDeleteModal
          count={selectedEventIds.size}
          deleting={bulkDeleting}
          onCancel={() => setShowBulkDeleteModal(false)}
          onConfirm={() => void handleBulkDelete()}
        />
      ) : null}
    </>
  );
}
