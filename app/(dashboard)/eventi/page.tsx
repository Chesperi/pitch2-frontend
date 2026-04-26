"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchEvents,
  fetchEventById,
  createEvent,
  updateEvent,
  bulkUpdateEventsStatus,
  bulkUpdateEventsFields,
  bulkPermanentDeleteEvents,
  type EventItem,
  type EventAssignmentsStatus,
  type CreateEventPayload,
} from "@/lib/api/events";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import { ImportEventsModal } from "./ImportEventsModal";
import { fetchLookupValues } from "@/lib/api/lookupValues";
import { apiFetch } from "@/lib/api/apiFetch";
import type { LookupValue } from "@/lib/types";
import type { ReactNode } from "react";
import { Check, Link, MoreVertical, Trash2, Upload } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PageLoading from "@/components/ui/PageLoading";
import EmptyState from "@/components/ui/EmptyState";
import MonthCalendar from "@/components/ui/MonthCalendar";
import ComposableFilters, {
  type ActiveFilter,
  type FilterOption,
} from "@/components/ui/ComposableFilters";
import {
  DB_TBODY_TR_COMPACT,
  DB_TD_CELL,
  DB_TD_FIRST,
  DB_TH_CELL,
  DB_TH_FIRST,
} from "@/app/(dashboard)/database/dbSectionStyles";

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

function eventDayIso(event: EventItem): string {
  const rawDate = (event as EventItem & { date?: string }).date;
  if (typeof rawDate === "string" && rawDate.trim()) return rawDate.slice(0, 10);
  const rawKo = event.koItaly?.trim() ?? "";
  if (rawKo.length >= 10) return rawKo.slice(0, 10);
  return "";
}

function eventTitle(event: EventItem): string {
  const category = normalizeCategory(event.category);
  if (category === "STUDIO_SHOW") {
    return event.showName?.trim() || event.competitionName?.trim() || "—";
  }
  if (event.homeTeamNameShort && event.awayTeamNameShort) {
    return `${event.homeTeamNameShort} vs ${event.awayTeamNameShort}`;
  }
  return event.homeTeamNameShort ?? event.awayTeamNameShort ?? event.showName ?? "—";
}

function eventKoHour(event: EventItem): string {
  const raw = event.koItaly?.trim() ?? "";
  if (!raw) return "—";
  const direct = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (direct) return `${direct[4]}:${direct[5]}`;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function statusPillStyle(status: string | null): { bg: string; text: string } {
  const s = (status ?? "").toUpperCase().trim();
  if (s === "OK" || s === "CONFIRMED") return { bg: "#1a2e1a", text: "#4ade80" };
  if (s === "TBC" || s === "TBD") return { bg: "#2e2a10", text: "#FFFA00" };
  if (s === "CANCELLED" || s === "CANCELED") return { bg: "#2e1a1a", text: "#f87171" };
  return { bg: "#1f1f1f", text: "#aaa" };
}

function statusDotColor(status: string | null): string {
  const s = (status ?? "").toUpperCase().trim();
  if (s === "OK" || s === "CONFIRMED") return "#4ade80";
  if (s === "TBC" || s === "TBD") return "#FFFA00";
  if (s === "CANCELLED" || s === "CANCELED") return "#f87171";
  return "#666666";
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

const CATEGORY_OPTIONS = [
  { value: "MATCH", label: "MATCH" },
  { value: "STUDIO_SHOW", label: "STUDIO SHOW" },
  { value: "MEDIA_CONTENT", label: "MEDIA CONTENT" },
  { value: "OTHER", label: "OTHER" },
];
const STATUS_OPTIONS = ["TBC", "TBD", "OK", "CONFIRMED", "CANCELLED"];

function normalizeCategoryValue(category: string | null | undefined): string {
  const normalized = (category ?? "").toUpperCase().trim().replace(/\s+/g, "_");
  return normalized || "MATCH";
}

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
  const buildInitialForm = (source: EventItem | null): CreateEventPayload =>
    source
      ? {
          category: normalizeCategoryValue(
            source.category ?? (source as EventItem & { categoria?: string }).categoria
          ),
          competitionName: source.competitionName,
          competitionCode: source.competitionCode ?? "",
          matchDay: source.matchDay,
          homeTeamNameShort: source.homeTeamNameShort,
          awayTeamNameShort: source.awayTeamNameShort,
          venueName: source.venueName ?? "",
          venueCity: source.venueCity ?? "",
          venueAddress: source.venueAddress ?? "",
          koItaly: toDatetimeLocalValueFromEvent(source),
          preDurationMinutes: source.preDurationMinutes,
          standardOnsite: source.standardOnsite ?? "",
          standardCologno: source.standardCologno ?? "",
          showName: source.showName ?? "",
          projectType: source.projectType ?? "",
          status: source.status,
          rightsHolder: source.rightsHolder ?? "",
          facilities: source.facilities ?? "",
          studio: source.studio ?? "",
          notes: source.notes ?? "",
          isTopMatch: Boolean(source.isTopMatch),
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
          projectType: "",
          status: "TBC",
          rightsHolder: "",
          facilities: "",
          studio: "",
          notes: "",
          isTopMatch: false,
        };
  const [form, setForm] = useState<CreateEventPayload>(() => buildInitialForm(event));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lookupOnsite, setLookupOnsite] = useState<LookupValue[]>([]);
  const [lookupCologno, setLookupCologno] = useState<LookupValue[]>([]);
  const [lookupFacilities, setLookupFacilities] = useState<LookupValue[]>([]);
  const [lookupStudio, setLookupStudio] = useState<LookupValue[]>([]);
  const [lookupShow, setLookupShow] = useState<LookupValue[]>([]);
  const [lookupProjectType, setLookupProjectType] = useState<LookupValue[]>([]);
  const [lookupProjectTypeColor, setLookupProjectTypeColor] = useState<LookupValue[]>([]);
  const [lookupRightsHolder, setLookupRightsHolder] = useState<LookupValue[]>(
    []
  );
  const isMediaContent = form.category === "MEDIA_CONTENT";
  const isStudioShow = form.category === "STUDIO_SHOW";
  const isMatch = form.category === "MATCH";

  useEffect(() => {
    setForm(buildInitialForm(event));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [a, b, c, d, e, f, g, h] = await Promise.all([
          fetchLookupValues("standard_onsite"),
          fetchLookupValues("standard_cologno"),
          fetchLookupValues("facilities"),
          fetchLookupValues("studio"),
          fetchLookupValues("show"),
          fetchLookupValues("rights_holder"),
          fetchLookupValues("vision_project_type"),
          fetchLookupValues("vision_project_type_color"),
        ]);
        if (!cancelled) {
          setLookupOnsite(a);
          setLookupCologno(b);
          setLookupFacilities(c);
          setLookupStudio(d);
          setLookupShow(e);
          setLookupRightsHolder(f);
          setLookupProjectType(g);
          setLookupProjectTypeColor(h);
        }
      } catch {
        if (!cancelled) {
          setLookupOnsite([]);
          setLookupCologno([]);
          setLookupFacilities([]);
          setLookupStudio([]);
          setLookupShow([]);
          setLookupRightsHolder([]);
          setLookupProjectType([]);
          setLookupProjectTypeColor([]);
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
        projectType: form.projectType?.trim() || null,
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

  const inputClass =
    "w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";
  const projectTypeColorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of lookupProjectTypeColor) {
      const [name, color] = row.value.split(":");
      if (name && color) map.set(name.trim(), color.trim());
    }
    return map;
  }, [lookupProjectTypeColor]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-6">
        <h3 className="mb-4 text-lg font-semibold text-pitch-white">
          {event ? "Edit event" : "New event"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            className={
              isMatch
                ? "grid grid-cols-1 gap-4 sm:grid-cols-3"
                : "grid grid-cols-1 gap-4 sm:grid-cols-2"
            }
          >
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                Categoria
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: normalizeCategoryValue(e.target.value) }))
                }
                className={inputClass}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">Stato</label>
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
            {isMatch ? (
              <div className="flex flex-col justify-end">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-pitch-white">
                  <input
                    type="checkbox"
                    checked={form.isTopMatch ?? false}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isTopMatch: e.target.checked }))
                    }
                    className="dazn-checkbox"
                  />
                  Top match
                </label>
              </div>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">
              {isMediaContent ? "Client / Partner" : "Competition"}
            </label>
            <input
              type="text"
              value={form.competitionName}
              onChange={(e) =>
                setForm((f) => ({ ...f, competitionName: e.target.value }))
              }
              className={inputClass}
              placeholder={
                isMediaContent ? "es. EBAY, Nike, Serie A…" : undefined
              }
              required
            />
          </div>
          {!isMediaContent ? (
            <>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  Matchday
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
                {isMatch ? (
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
                {isMatch ? (
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
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">Episode</label>
                <input
                  type="text"
                  value={form.matchDay}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, matchDay: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="es. 1, 2, 3…"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">
                  Episode title
                </label>
                <input
                  type="text"
                  value={form.homeTeamNameShort}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, homeTeamNameShort: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="es. Episodio 1, Puntata Speciale…"
                  required
                />
              </div>
            </>
          )}
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
              label={isMediaContent ? "Show / Project name" : "Show name"}
              value={form.showName}
              onChange={(v) => setForm((f) => ({ ...f, showName: v }))}
              options={lookupShow}
              inputClassName={inputClass}
            />
            {isMediaContent ? (
              <div>
                <label className="mb-1 block text-xs text-pitch-gray">Project type</label>
                <div className="flex items-center gap-2">
                  <select
                    value={form.projectType ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        projectType: e.target.value,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">— select type —</option>
                    {lookupProjectType.map((opt) => (
                      <option key={opt.id} value={opt.value}>
                        {opt.value}
                      </option>
                    ))}
                  </select>
                  {form.projectType ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-pitch-gray-light">
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-[#2a2a2a]"
                        style={{
                          background:
                            projectTypeColorMap.get(form.projectType) ?? "#888888",
                        }}
                      />
                      {projectTypeColorMap.get(form.projectType) ?? "#888888"}
                    </span>
                  ) : null}
                </div>
              </div>
            ) : null}
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
        <h3 className="text-base font-semibold text-pitch-white">Confirm deletion</h3>
        <p className="mt-2 text-sm text-pitch-gray-light">
          Permanently delete {count} events? This action cannot be undone.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-pitch-gray-dark px-3 py-1.5 text-xs text-pitch-gray-light hover:bg-pitch-gray-dark"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded border border-red-700 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/30 disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete selected"}
          </button>
        </div>
      </div>
    </div>
  );
}

const EVENT_FILTER_OPTIONS_BASE: FilterOption[] = [
  {
    key: "status",
    label: "Status",
    allowMultiple: true,
    values: [
      { value: "TBC", color: "#FFFA00" },
      { value: "TBD", color: "#FFFA00" },
      { value: "OK", color: "#4ade80" },
      { value: "CONFIRMED", label: "Confirmed", color: "#34d399" },
      { value: "CANCELLED", label: "Cancelled", color: "#f87171" },
    ],
  },
  {
    key: "category",
    label: "Category",
    allowMultiple: true,
    values: [
      { value: "MATCH", label: "Match", color: "#818cf8" },
      { value: "STUDIO_SHOW", label: "Studio show", color: "#fb923c" },
      { value: "MEDIA_CONTENT", label: "Media content", color: "#60a5fa" },
    ],
  },
  { key: "competition", label: "Competition", allowMultiple: true, values: [] },
  {
    key: "assignments",
    label: "Assignments",
    allowMultiple: true,
    values: [
      { value: "DRAFT", label: "Draft", color: "#888" },
      { value: "READY_TO_SEND", label: "Ready", color: "#34d399" },
      { value: "SENT", label: "Sent", color: "#818cf8" },
    ],
  },
  { key: "matchday", label: "Matchday", allowMultiple: true, values: [] },
  {
    key: "rights",
    label: "Rights holder",
    allowMultiple: true,
    values: [
      { value: "DAZN", color: "#FFFA00" },
      { value: "SKY/DAZN", color: "#f87171" },
    ],
  },
];

function normalizeStatus(status: string | null | undefined): string {
  const normalized = (status ?? "").toUpperCase().trim();
  if (normalized === "CANCELED") return "CANCELLED";
  return normalized;
}

function normalizeCategory(category: string | null | undefined): string {
  return (category ?? "").toUpperCase().trim().replace(/\s+/g, "_");
}

function applyComposableFilters(
  items: EventItem[],
  activeFilters: ActiveFilter[],
  searchValue: string
): EventItem[] {
  const splitMultiValues = (raw: string | null | undefined): string[] =>
    String(raw ?? "")
      .split("||")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);

  const q = searchValue.trim().toLowerCase();
  return items.filter((event) => {
    for (const filter of activeFilters) {
      if (!filter.value) continue;
      switch (filter.key) {
        case "status": {
          const currentStatus = normalizeStatus(event.status);
          const expectedList = splitMultiValues(filter.value).map((v) => normalizeStatus(v));
          if (expectedList.length === 0) break;
          if (!expectedList.includes(currentStatus)) return false;
          break;
        }
        case "category": {
          const selectedCategories = splitMultiValues(filter.value).map((v) =>
            normalizeCategory(v)
          );
          if (selectedCategories.length === 0) break;
          if (!selectedCategories.includes(normalizeCategory(event.category))) {
            return false;
          }
          break;
        }
        case "competition": {
          const selectedCompetitions = splitMultiValues(filter.value);
          if (selectedCompetitions.length === 0) break;
          if (!selectedCompetitions.includes((event.competitionName ?? "").trim())) return false;
          break;
        }
        case "assignments": {
          const selectedAssignments = splitMultiValues(filter.value).map((v) =>
            v.toUpperCase().trim()
          );
          if (selectedAssignments.length === 0) break;
          if (!selectedAssignments.includes((event.assignmentsStatus ?? "").toUpperCase().trim())) {
            return false;
          }
          break;
        }
        case "matchday": {
          const selectedMatchdays = splitMultiValues(filter.value);
          if (selectedMatchdays.length === 0) break;
          const current = (event.matchDay?.toString() ?? "").trim();
          if (!selectedMatchdays.includes(current)) return false;
          break;
        }
        case "rights": {
          const selectedRights = splitMultiValues(filter.value);
          if (selectedRights.length === 0) break;
          if (!selectedRights.includes((event.rightsHolder ?? "").trim())) return false;
          break;
        }
        default:
          break;
      }
    }
    if (!q) return true;
    return (
      event.competitionName?.toLowerCase().includes(q) ||
      event.homeTeamNameShort?.toLowerCase().includes(q) ||
      event.awayTeamNameShort?.toLowerCase().includes(q) ||
      event.showName?.toLowerCase().includes(q)
    );
  });
}

function ActionsMenu({
  canImportMatches,
  autoMatchingCombos,
  selectedCount,
  onImport,
  onAutoLink,
  onSetSelectedOk,
  onDeleteSelected,
}: {
  canImportMatches: boolean;
  autoMatchingCombos: boolean;
  selectedCount: number;
  onImport: () => void;
  onAutoLink: () => void;
  onSetSelectedOk: () => void;
  onDeleteSelected: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!rootRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const disableBulk = selectedCount === 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#2a2a2a] bg-[#141414] text-[#cfcfcf] hover:border-[#FFFA00] hover:text-[#FFFA00]"
        aria-label="Open actions menu"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[240px] rounded-xl border border-[#2a2a2a] bg-[#111] p-1.5 shadow-lg">
          <button
            type="button"
            disabled={!canImportMatches}
            onClick={() => {
              onImport();
              setOpen(false);
            }}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload className="mt-0.5 h-3.5 w-3.5 text-[#888]" />
            <span>
              <span className="block text-[12px] text-[#ddd]">Import events</span>
            </span>
          </button>
          <button
            type="button"
            disabled={!canImportMatches || autoMatchingCombos}
            onClick={() => {
              onAutoLink();
              setOpen(false);
            }}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Link className="mt-0.5 h-3.5 w-3.5 text-[#888]" />
            <span>
              <span className="block text-[12px] text-[#ddd]">Auto-link standards</span>
              <span className="block text-[10px] text-[#666]">
                Match events to standard packages automatically
              </span>
            </span>
          </button>
          <div className="my-1 border-t border-[#2a2a2a]" />
          <button
            type="button"
            disabled={disableBulk}
            onClick={() => {
              onSetSelectedOk();
              setOpen(false);
            }}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check className="mt-0.5 h-3.5 w-3.5 text-[#888]" />
            <span className="block text-[12px] text-[#ddd]">
              Set selected as Standard OK
            </span>
          </button>
          <button
            type="button"
            disabled={disableBulk}
            onClick={() => {
              onDeleteSelected();
              setOpen(false);
            }}
            className="flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-[#1c1c1c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="mt-0.5 h-3.5 w-3.5 text-[#f87171]" />
            <span className="block text-[12px] text-[#f87171]">
              Delete selected permanently
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

const PAGE_SIZE = 50;

export default function EventiPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchValue, setSearchValue] = useState("");
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [userLevel, setUserLevel] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFlash, setImportFlash] = useState<string | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkEditing, setBulkEditing] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [autoMatchingCombos, setAutoMatchingCombos] = useState(false);
  const [lookupOnsite, setLookupOnsite] = useState<LookupValue[]>([]);
  const [lookupCologno, setLookupCologno] = useState<LookupValue[]>([]);
  const [lookupFacilities, setLookupFacilities] = useState<LookupValue[]>([]);
  const [lookupStudio, setLookupStudio] = useState<LookupValue[]>([]);
  const [lookupRightsHolder, setLookupRightsHolder] = useState<LookupValue[]>([]);
  const [bulkEditFields, setBulkEditFields] = useState<{
    standardOnsite: string;
    standardCologno: string;
    facilities: string;
    studio: string;
    preDurationMinutes: string;
    rightsHolder: string;
  }>({
    standardOnsite: "",
    standardCologno: "",
    facilities: "",
    studio: "",
    preDurationMinutes: "",
    rightsHolder: "",
  });
  const [eventsView, setEventsView] = useState<"list" | "calendar">("list");
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calendarDayPanelIso, setCalendarDayPanelIso] = useState<string | null>(null);

  const canImportMatches =
    userLevel != null &&
    ["MANAGER", "MASTER"].includes(userLevel.toUpperCase().trim());
  const eventFilterOptions = useMemo<FilterOption[]>(() => {
    const competitions = Array.from(
      new Set(
        events
          .map((event) => (event.competitionName ?? "").trim())
          .filter((name) => name.length > 0)
      )
    )
      .sort((a, b) => a.localeCompare(b, "it"))
      .map((name) => ({ value: name, label: name }));
    const matchdays = Array.from(
      new Set(
        events
          .map((event) => (event.matchDay?.toString() ?? "").trim())
          .filter((value) => value.length > 0)
      )
    )
      .sort((a, b) => a.localeCompare(b, "it", { numeric: true }))
      .map((value) => ({ value, label: value }));
    return EVENT_FILTER_OPTIONS_BASE.map((option) => {
      if (option.key === "competition") {
        return { ...option, values: competitions };
      }
      if (option.key === "matchday") {
        return { ...option, values: matchdays, allowMultiple: true };
      }
      return option;
    });
  }, [events]);

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

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [a, b, c, d, e] = await Promise.all([
          fetchLookupValues("standard_onsite"),
          fetchLookupValues("standard_cologno"),
          fetchLookupValues("facilities"),
          fetchLookupValues("studio"),
          fetchLookupValues("rights_holder"),
        ]);
        if (!cancelled) {
          setLookupOnsite(a);
          setLookupCologno(b);
          setLookupFacilities(c);
          setLookupStudio(d);
          setLookupRightsHolder(e);
        }
      } catch {
        if (!cancelled) {
          setLookupOnsite([]);
          setLookupCologno([]);
          setLookupFacilities([]);
          setLookupStudio([]);
          setLookupRightsHolder([]);
        }
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
      });
      setEvents(items);
      setTotal(t);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    return applyComposableFilters(events, activeFilters, searchValue);
  }, [events, activeFilters, searchValue]);

  useEffect(() => {
    setSelectedEventIds(new Set());
  }, [events, page, searchValue, activeFilters]);

  const orderedEvents = useMemo(() => {
    const isCancelled = (ev: EventItem) => {
      const s = (ev.status ?? "").toUpperCase().trim();
      return s === "CANCELED" || s === "CANCELLED";
    };
    const activeEvents = filteredEvents.filter((e) => !isCancelled(e));
    const cancelledEvents = filteredEvents.filter((e) => isCancelled(e));
    return [...activeEvents, ...cancelledEvents];
  }, [filteredEvents]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const event of orderedEvents) {
      const iso = eventDayIso(event);
      if (!iso) continue;
      const rows = map.get(iso) ?? [];
      rows.push(event);
      map.set(iso, rows);
    }
    return map;
  }, [orderedEvents]);

  const selectedCalendarDayEvents = useMemo(() => {
    if (!calendarDayPanelIso) return [];
    return [...(eventsByDay.get(calendarDayPanelIso) ?? [])].sort((a, b) =>
      eventKoHour(a).localeCompare(eventKoHour(b), "it")
    );
  }, [calendarDayPanelIso, eventsByDay]);

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

  const handleBulkApplyFields = async () => {
    if (selectedEventIds.size === 0) return;
    const fields: {
      standard_onsite?: string;
      standard_cologno?: string;
      facilities?: string;
      studio?: string;
      pre_duration_minutes?: number;
      rights_holder?: string;
    } = {};
    if (bulkEditFields.standardOnsite.trim()) {
      fields.standard_onsite = bulkEditFields.standardOnsite.trim();
    }
    if (bulkEditFields.standardCologno.trim()) {
      fields.standard_cologno = bulkEditFields.standardCologno.trim();
    }
    if (bulkEditFields.facilities.trim()) {
      fields.facilities = bulkEditFields.facilities.trim();
    }
    if (bulkEditFields.studio.trim()) {
      fields.studio = bulkEditFields.studio.trim();
    }
    if (bulkEditFields.rightsHolder.trim()) {
      fields.rights_holder = bulkEditFields.rightsHolder.trim();
    }
    if (bulkEditFields.preDurationMinutes.trim()) {
      const n = Number(bulkEditFields.preDurationMinutes);
      if (!Number.isFinite(n) || n < 0) {
        alert("PRE must be a non-negative number");
        return;
      }
      fields.pre_duration_minutes = Math.trunc(n);
    }
    if (Object.keys(fields).length === 0) {
      alert("Select at least one field to apply.");
      return;
    }

    setBulkEditing(true);
    try {
      await bulkUpdateEventsFields({
        eventIds: Array.from(selectedEventIds),
        fields,
      });
      setBulkEditFields({
        standardOnsite: "",
        standardCologno: "",
        facilities: "",
        studio: "",
        preDurationMinutes: "",
        rightsHolder: "",
      });
      setSelectedEventIds(new Set());
      await loadEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Bulk edit failed");
    } finally {
      setBulkEditing(false);
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
  const openEventEditor = async (event: EventItem) => {
    setIsCreateModalOpen(false);
    const full = await fetchEventById(event.id).catch(() => null);
    setEditingEvent(full ?? event);
  };

  return (
    <>
      <div className="flex items-center justify-between py-4">
        <h1 className="text-[22px] font-medium text-pitch-white">Events</h1>
        <div className="flex items-center gap-2">
          <ActionsMenu
            canImportMatches={canImportMatches}
            autoMatchingCombos={autoMatchingCombos}
            selectedCount={selectedEventIds.size}
            onImport={() => setImportModalOpen(true)}
            onAutoLink={() => void handleAutoMatchCombos()}
            onSetSelectedOk={() => void handleBulkSetOk()}
            onDeleteSelected={handleOpenBulkDeleteModal}
          />
          <button
            type="button"
            onClick={() => {
              setEditingEvent(null);
              setIsCreateModalOpen(true);
            }}
            className="rounded-lg bg-[#FFFA00] px-4 py-2 text-[13px] font-medium text-black"
          >
            + New event
          </button>
        </div>
      </div>
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
      <ComposableFilters
        className="mt-4"
        filters={eventFilterOptions}
        activeFilters={activeFilters}
        onChange={setActiveFilters}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        searchPlaceholder="Search events..."
      />
      <div className="mb-4 mt-4 flex gap-1">
        <button
          onClick={() => setEventsView("list")}
          className={`rounded-lg border px-4 py-1.5 text-[12px] ${
            eventsView === "list"
              ? "border-[#FFFA00] bg-[#FFFA00] font-medium text-black"
              : "border-[#2a2a2a] text-[#666]"
          }`}
        >
          List
        </button>
        <button
          onClick={() => setEventsView("calendar")}
          className={`rounded-lg border px-4 py-1.5 text-[12px] ${
            eventsView === "calendar"
              ? "border-[#FFFA00] bg-[#FFFA00] font-medium text-black"
              : "border-[#2a2a2a] text-[#666]"
          }`}
        >
          Calendar
        </button>
      </div>
      {selectedEventIds.size > 1 ? (
        <div className="mb-3 mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-[12px] text-[#888]">
          <span className="text-[#888]">{selectedEventIds.size} events selected</span>
          <div className="ml-2 flex flex-wrap items-center gap-2">
            <select
              value={bulkEditFields.standardOnsite}
              onChange={(e) =>
                setBulkEditFields((prev) => ({ ...prev, standardOnsite: e.target.value }))
              }
              className="h-8 rounded border border-[#2a2a2a] bg-[#141414] px-2 text-[11px] text-[#ddd]"
            >
              <option value="">Onsite —</option>
              {lookupOnsite.map((opt) => (
                <option key={`bulk-onsite-${opt.id}`} value={opt.value}>
                  {opt.value}
                </option>
              ))}
            </select>
            <select
              value={bulkEditFields.standardCologno}
              onChange={(e) =>
                setBulkEditFields((prev) => ({ ...prev, standardCologno: e.target.value }))
              }
              className="h-8 rounded border border-[#2a2a2a] bg-[#141414] px-2 text-[11px] text-[#ddd]"
            >
              <option value="">Cologno —</option>
              {lookupCologno.map((opt) => (
                <option key={`bulk-cologno-${opt.id}`} value={opt.value}>
                  {opt.value}
                </option>
              ))}
            </select>
            <select
              value={bulkEditFields.facilities}
              onChange={(e) =>
                setBulkEditFields((prev) => ({ ...prev, facilities: e.target.value }))
              }
              className="h-8 rounded border border-[#2a2a2a] bg-[#141414] px-2 text-[11px] text-[#ddd]"
            >
              <option value="">Facilities —</option>
              {lookupFacilities.map((opt) => (
                <option key={`bulk-facilities-${opt.id}`} value={opt.value}>
                  {opt.value}
                </option>
              ))}
            </select>
            <select
              value={bulkEditFields.studio}
              onChange={(e) =>
                setBulkEditFields((prev) => ({ ...prev, studio: e.target.value }))
              }
              className="h-8 rounded border border-[#2a2a2a] bg-[#141414] px-2 text-[11px] text-[#ddd]"
            >
              <option value="">Studio —</option>
              {lookupStudio.map((opt) => (
                <option key={`bulk-studio-${opt.id}`} value={opt.value}>
                  {opt.value}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={bulkEditFields.preDurationMinutes}
              onChange={(e) =>
                setBulkEditFields((prev) => ({
                  ...prev,
                  preDurationMinutes: e.target.value,
                }))
              }
              placeholder="PRE"
              className="h-8 w-[70px] rounded border border-[#2a2a2a] bg-[#141414] px-2 text-[11px] text-[#ddd]"
            />
            <select
              value={bulkEditFields.rightsHolder}
              onChange={(e) =>
                setBulkEditFields((prev) => ({ ...prev, rightsHolder: e.target.value }))
              }
              className="h-8 rounded border border-[#2a2a2a] bg-[#141414] px-2 text-[11px] text-[#ddd]"
            >
              <option value="">Rights —</option>
              {lookupRightsHolder.map((opt) => (
                <option key={`bulk-rights-${opt.id}`} value={opt.value}>
                  {opt.value}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={bulkEditing || bulkUpdating}
              onClick={() => void handleBulkApplyFields()}
              className="rounded-lg border border-[#FFFA00] bg-[#FFFA00] px-3 py-1 text-[12px] font-medium text-black hover:bg-yellow-200 disabled:opacity-50"
            >
              {bulkEditing ? "Applying..." : "Apply"}
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => void handleBulkSetOk()}
              className="rounded-lg border border-[#4ade80] bg-transparent px-3 py-1 text-[12px] text-[#4ade80] hover:bg-[#1a2e1a] disabled:opacity-50"
            >
              {bulkUpdating ? "Updating..." : "Set Standard OK"}
            </button>
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={handleOpenBulkDeleteModal}
              className="rounded-lg border border-[#f87171] bg-transparent px-3 py-1 text-[12px] text-[#f87171] hover:bg-[#2e1a1a] disabled:opacity-50"
            >
              Delete permanently
            </button>
          </div>
          <button
            type="button"
            onClick={() => setSelectedEventIds(new Set())}
            className="rounded border-none bg-transparent px-1.5 py-0.5 text-[14px] text-[#555] hover:text-[#888]"
            aria-label="Clear selected events"
          >
            ×
          </button>
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
            <EmptyState message="No events found" icon="calendar" />
          </div>
        ) : eventsView === "list" ? (
          <>
            <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                <th className={DB_TH_FIRST}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={handleToggleSelectAllVisible}
                    className="dazn-checkbox h-4 w-4"
                    aria-label="Seleziona tutti gli eventi visibili"
                  />
                </th>
                <th className={`${DB_TH_FIRST} min-w-[140px]`}>
                  Match
                </th>
                <th className={`${DB_TH_FIRST} min-w-[100px]`}>
                  Competition
                </th>
                <th className={DB_TH_FIRST}>
                  Category
                </th>
                <th className={DB_TH_FIRST}>
                  Rights
                </th>
                <th className={`${DB_TH_FIRST} min-w-[40px]`}>
                  MD
                </th>
                <th className={`${DB_TH_FIRST} min-w-[130px]`}>
                  Date & KO
                </th>
                <th className={DB_TH_FIRST}>
                  PRE
                </th>
                <th className={DB_TH_FIRST}>
                  Standard Onsite
                </th>
                <th className={DB_TH_FIRST}>
                  Standard Cologno
                </th>
                <th className={DB_TH_FIRST}>
                  Facilities
                </th>
                <th className={DB_TH_FIRST}>
                  Studio
                </th>
                <th className={DB_TH_FIRST}>
                  Show
                </th>
                <th className={DB_TH_FIRST}>
                  Status
                </th>
                <th className={DB_TH_FIRST}>
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
                const eventCategory = normalizeCategory(event.category);
                const match =
                  eventCategory === "STUDIO_SHOW"
                    ? event.showName?.trim() || event.competitionName?.trim() || "—"
                    : event.homeTeamNameShort && event.awayTeamNameShort
                      ? `${event.homeTeamNameShort} vs ${event.awayTeamNameShort}`
                      : event.homeTeamNameShort ??
                        event.awayTeamNameShort ??
                        "—";
                const rightsTrimmed = event.rightsHolder?.trim() ?? "";
                if (cancelledEvents.length > 0 && idx === activeEvents.length) {
                  rows.push(
                    <tr key="cancelled-separator" className="h-9 border-y border-pitch-gray-dark/80 bg-pitch-gray-dark/20">
                      <td colSpan={15} className={DB_TH_FIRST}>
                        Cancelled events
                      </td>
                    </tr>
                  );
                }
                rows.push(
                  <tr
                    key={event.id}
                    onClick={() => void openEventEditor(event)}
                    className={`${DB_TBODY_TR_COMPACT} cursor-pointer`}
                  >
                    <td
                      className={DB_TD_FIRST}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedEventIds.has(event.id)}
                        onChange={() => handleToggleRowSelection(event.id)}
                        className="dazn-checkbox h-4 w-4"
                        aria-label={`Seleziona evento ${event.id}`}
                      />
                    </td>
                    <td className={DB_TD_FIRST}>
                      <span className="inline-flex flex-wrap items-center gap-1">
                        {event.isTopMatch ? (
                          <span className="mr-1 rounded bg-yellow-400 px-1 text-xs font-bold text-black">
                            TOP
                          </span>
                        ) : null}
                        <span>{match}</span>
                      </span>
                    </td>
                    <td className={DB_TD_FIRST}>
                      {event.competitionName}
                    </td>
                    <td className={DB_TD_FIRST}>
                      {event.category}
                    </td>
                    <td
                      className={`max-w-[7rem] truncate ${DB_TD_FIRST}`}
                      style={{
                        color: rightsTrimmed === "SKY/DAZN" ? "#f87171" : "#ffffff",
                      }}
                      title={rightsTrimmed || undefined}
                    >
                      {rightsTrimmed ? rightsTrimmed : "—"}
                    </td>
                    <td className={`${DB_TD_FIRST} min-w-[40px]`}>
                      {event.matchDay?.trim()
                        ? event.matchDay
                        : "—"}
                    </td>
                    <td className={DB_TD_FIRST}>
                      {formatKoItaly(event.koItaly)}
                    </td>
                    <td className={DB_TD_FIRST}>
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
                    <td className={DB_TD_FIRST}>
                      {event.standardOnsite ?? "—"}
                    </td>
                    <td className={DB_TD_FIRST}>
                      {event.standardCologno ?? "—"}
                    </td>
                    <td className={DB_TD_FIRST}>
                      {event.facilities ?? "—"}
                    </td>
                    <td className={DB_TD_FIRST}>
                      {event.studio ?? "—"}
                    </td>
                    <td className={DB_TD_FIRST}>
                      {event.showName ?? "—"}
                    </td>
                    <td className={DB_TD_FIRST}>
                      {eventStatusBadgeEl(event.status)}
                    </td>
                    <td
                      className={DB_TD_FIRST}
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
            </div>
            <p className="mt-2 text-xs text-pitch-gray-light md:hidden">
              ← Scroll to see all columns
            </p>
          </>
        ) : (
          <MonthCalendar
            year={calendarMonth.getFullYear()}
            month={calendarMonth.getMonth()}
            onPrevMonth={() =>
              setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))
            }
            onNextMonth={() =>
              setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
            }
            onDayClick={(y, m, d) =>
              setCalendarDayPanelIso(
                `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
              )
            }
            renderDayContent={(y, m, d) => {
              const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const dayEvents = eventsByDay.get(iso) ?? [];
              return (
                <div className="mt-1">
                  <div className="flex items-center gap-1 md:hidden">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={`dot-${event.id}`}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: statusDotColor(event.status) }}
                      />
                    ))}
                    {dayEvents.length > 3 ? (
                      <span className="text-[10px] text-[#777]">+{dayEvents.length - 3}</span>
                    ) : null}
                  </div>
                  <div className="hidden space-y-1 md:block">
                    {dayEvents.slice(0, 3).map((event) => {
                      const color = statusPillStyle(event.status);
                      return (
                        <button
                          key={event.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void openEventEditor(event);
                          }}
                          className="block w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left text-[10px]"
                          style={{ background: color.bg, color: color.text }}
                          title={eventTitle(event)}
                        >
                          {eventTitle(event)}
                        </button>
                      );
                    })}
                    {dayEvents.length > 3 ? (
                      <div className="text-[10px] text-[#777]">+{dayEvents.length - 3} more</div>
                    ) : null}
                  </div>
                </div>
              );
            }}
          />
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
      {calendarDayPanelIso ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setCalendarDayPanelIso(null)}
            aria-label="Close day panel"
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border border-[#2a2a2a] bg-[#111] p-4 md:left-1/2 md:max-w-2xl md:-translate-x-1/2">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#e5e5e5]">
                {new Intl.DateTimeFormat("en-GB", {
                  weekday: "long",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                }).format(new Date(`${calendarDayPanelIso}T12:00:00`))}
              </h3>
              <button
                type="button"
                onClick={() => setCalendarDayPanelIso(null)}
                className="text-sm text-[#888]"
              >
                Close
              </button>
            </div>
            {selectedCalendarDayEvents.length === 0 ? (
              <p className="text-sm text-[#777]">No events</p>
            ) : (
              <div className="space-y-2">
                {selectedCalendarDayEvents.map((event) => (
                  <button
                    key={`panel-${event.id}`}
                    type="button"
                    onClick={() => {
                      void openEventEditor(event);
                      setCalendarDayPanelIso(null);
                    }}
                    className="w-full rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-[#e5e5e5]">{eventTitle(event)}</span>
                      <span className="text-xs text-[#888]">{eventKoHour(event)}</span>
                    </div>
                    <div className="mt-1">{eventStatusBadgeEl(event.status)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
