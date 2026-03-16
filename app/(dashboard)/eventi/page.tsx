"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import {
  fetchEvents,
  createEvent,
  updateEvent,
  type EventItem,
  type CreateEventPayload,
} from "@/lib/api/events";

function formatKoItaly(koItaly: string | null): string {
  if (!koItaly) return "—";
  try {
    const date = new Date(koItaly);
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return koItaly;
  }
}

function renderEventStatus(status: string | null): React.ReactNode {
  const value = status?.toUpperCase() ?? "";
  switch (value) {
    case "TBC":
    case "TBD":
      return (
        <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300">
          Da confermare
        </span>
      );
    case "OK":
    case "CONFIRMED":
      return (
        <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-300">
          {value === "OK" ? "OK" : "Confermato"}
        </span>
      );
    case "CANCELLED":
      return (
        <span className="rounded-full bg-red-900/50 px-2 py-0.5 text-xs text-red-300">
          Cancellato
        </span>
      );
    default:
      return (
        <span className="rounded-full bg-pitch-gray-dark px-2 py-0.5 text-xs text-pitch-gray-light">
          {status || "—"}
        </span>
      );
  }
}

const CATEGORY_OPTIONS = ["MATCH", "MEDIA CONTENT", "OTHER"];
const STATUS_OPTIONS = ["TBC", "TBD", "OK", "CONFIRMED", "CANCELLED"];

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
          koItaly: event.koItaly,
          preDurationMinutes: event.preDurationMinutes,
          standardOnsite: event.standardOnsite ?? "",
          standardCologno: event.standardCologno ?? "",
          areaProduzione: event.areaProduzione ?? "",
          showName: event.showName ?? "",
          status: event.status,
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
          areaProduzione: "",
          showName: "",
          status: "TBC",
        }
  );
  const [saving, setSaving] = useState(false);

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
        areaProduzione: form.areaProduzione || undefined,
        showName: form.showName || undefined,
      };
      if (event) {
        await updateEvent(event.id, payload);
      } else {
        await createEvent(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-pitch-gray-dark bg-pitch-bg p-6">
        <h3 className="mb-4 text-lg font-semibold text-pitch-white">
          {event ? "Modifica evento" : "Nuovo evento"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                Categoria
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
          </div>
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">
              Competizione
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
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">
              Codice competizione
            </label>
            <input
              type="text"
              value={form.competitionCode}
              onChange={(e) =>
                setForm((f) => ({ ...f, competitionCode: e.target.value }))
              }
              className={inputClass}
            />
          </div>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                Squadra casa
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
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                Squadra trasferta
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                Data/ora KO (ISO)
              </label>
              <input
                type="datetime-local"
                value={
                  form.koItaly
                    ? form.koItaly.slice(0, 16)
                    : ""
                }
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    koItaly: e.target.value ? `${e.target.value}:00` : "",
                  }))
                }
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                PRE (minuti)
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
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                Standard onsite
              </label>
              <input
                type="text"
                value={form.standardOnsite}
                onChange={(e) =>
                  setForm((f) => ({ ...f, standardOnsite: e.target.value }))
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">
                Standard Cologno
              </label>
              <input
                type="text"
                value={form.standardCologno}
                onChange={(e) =>
                  setForm((f) => ({ ...f, standardCologno: e.target.value }))
                }
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">
              Area produzione
            </label>
            <input
              type="text"
              value={form.areaProduzione}
              onChange={(e) =>
                setForm((f) => ({ ...f, areaProduzione: e.target.value }))
              }
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
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
            <div>
              <label className="mb-1 block text-xs text-pitch-gray">Show</label>
              <input
                type="text"
                value={form.showName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, showName: e.target.value }))
                }
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-pitch-gray-dark px-4 py-2 text-sm text-pitch-gray-light hover:bg-pitch-gray-dark"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50"
            >
              {saving ? "Salvataggio..." : "Salva"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EventiPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchEvents({ limit: 100, offset: 0 });
      setEvents(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const filteredEvents = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.trim().toLowerCase();
    return events.filter(
      (e) =>
        e.competitionName?.toLowerCase().includes(q) ||
        e.homeTeamNameShort?.toLowerCase().includes(q) ||
        e.awayTeamNameShort?.toLowerCase().includes(q) ||
        e.showName?.toLowerCase().includes(q)
    );
  }, [events, search]);

  const showModal = isCreateModalOpen || editingEvent !== null;

  return (
    <>
      <PageHeader
        title="Eventi"
        actions={
          <button
            type="button"
            onClick={() => {
              setEditingEvent(null);
              setIsCreateModalOpen(true);
            }}
            className="rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200"
          >
            Nuovo evento
          </button>
        }
      />
      <div className="mt-4">
        <SearchBar
          placeholder="Cerca eventi..."
          onSearchChange={setSearch}
        />
      </div>
      <div className="mt-6 overflow-x-auto">
        {isLoading ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
            Caricamento...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
            Nessun evento
          </div>
        ) : (
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Match
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Competizione
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Categoria
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Data KO
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
                  Area produzione
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Show
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event) => {
                const match =
                  event.homeTeamNameShort && event.awayTeamNameShort
                    ? `${event.homeTeamNameShort} vs ${event.awayTeamNameShort}`
                    : event.homeTeamNameShort ??
                      event.awayTeamNameShort ??
                      "—";
                return (
                  <tr
                    key={event.id}
                    onClick={() => {
                      setEditingEvent(event);
                      setIsCreateModalOpen(false);
                    }}
                    className="cursor-pointer border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-white">
                      {match}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.competitionName}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.category}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {formatKoItaly(event.koItaly)}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.preDurationMinutes}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.standardOnsite ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.standardCologno ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.areaProduzione ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.showName ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {renderEventStatus(event.status)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
    </>
  );
}
