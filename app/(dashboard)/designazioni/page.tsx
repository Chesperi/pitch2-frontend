"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  fetchEvents,
  type EventItem,
  type EventAssignmentsStatus,
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

function renderAssignmentsStatusBadge(
  status: EventAssignmentsStatus | undefined
): React.ReactNode {
  switch (status) {
    case "DRAFT":
      return (
        <span className="rounded-full bg-pitch-gray-dark px-2 py-0.5 text-xs text-pitch-gray-light">
          Bozza
        </span>
      );
    case "READY_TO_SEND":
      return (
        <span className="rounded-full bg-yellow-900/50 px-2 py-0.5 text-xs text-yellow-300">
          Pronto invio
        </span>
      );
    case "SENT":
      return (
        <span className="rounded-full bg-green-900/50 px-2 py-0.5 text-xs text-green-300">
          Inviato
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

const ASSIGNMENTS_STATUS_OPTIONS: {
  value: "" | EventAssignmentsStatus;
  label: string;
}[] = [
  { value: "", label: "Tutti" },
  { value: "DRAFT", label: "Bozza" },
  { value: "READY_TO_SEND", label: "Pronto invio" },
  { value: "SENT", label: "Inviato" },
];

export default function DesignazioniPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [competitionFilter, setCompetitionFilter] = useState("");
  const [assignmentsStatusFilter, setAssignmentsStatusFilter] =
    useState<EventAssignmentsStatus | "">("");
  const [areaFilter, setAreaFilter] = useState("");

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEvents({
        onlyDesignable: true,
        limit: 100,
        offset: 0,
        ...(assignmentsStatusFilter && {
          assignments_status: assignmentsStatusFilter,
        }),
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore nel caricamento");
    } finally {
      setLoading(false);
    }
  }, [assignmentsStatusFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const competitions = useMemo(() => {
    const set = new Set<string>();
    items.forEach((e) => {
      if (e.competitionName) set.add(e.competitionName);
    });
    return Array.from(set).sort();
  }, [items]);

  const areas = useMemo(() => {
    const set = new Set<string>();
    items.forEach((e) => {
      if (e.areaProduzione) set.add(e.areaProduzione);
    });
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((e) => {
      if (competitionFilter && e.competitionName !== competitionFilter)
        return false;
      if (areaFilter && e.areaProduzione !== areaFilter) return false;
      return true;
    });
  }, [items, competitionFilter, areaFilter]);

  if (loading) {
    return (
      <>
        <PageHeader title="Designazioni" />
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-8 text-center text-pitch-gray">
          Caricamento...
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Designazioni" />
        <div className="mt-6 rounded-lg border border-red-900/50 bg-red-900/20 p-6 text-red-300">
          {error}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Designazioni" />
      <div className="mt-4 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs text-pitch-gray">
            Competizione
          </label>
          <select
            value={competitionFilter}
            onChange={(e) => setCompetitionFilter(e.target.value)}
            className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
          >
            <option value="">Tutte</option>
            {competitions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-pitch-gray">
            Stato designazioni
          </label>
          <select
            value={assignmentsStatusFilter}
            onChange={(e) =>
              setAssignmentsStatusFilter(
                e.target.value as EventAssignmentsStatus | ""
              )
            }
            className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
          >
            {ASSIGNMENTS_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-pitch-gray">
            Area produzione
          </label>
          <select
            value={areaFilter}
            onChange={(e) => setAreaFilter(e.target.value)}
            className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark px-3 py-2 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
          >
            <option value="">Tutte</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-6 overflow-x-auto">
        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30 p-12 text-center text-pitch-gray">
            Nessun evento designabile
          </div>
        ) : (
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Data e KO
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Match
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Competizione
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
                  Stato evento
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Stato designazioni
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Azioni
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((event) => {
                const match =
                  event.homeTeamNameShort && event.awayTeamNameShort
                    ? `${event.homeTeamNameShort} vs ${event.awayTeamNameShort}`
                    : event.homeTeamNameShort ??
                      event.awayTeamNameShort ??
                      "—";
                return (
                  <tr
                    key={event.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {formatKoItaly(event.koItaly)}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-white">
                      {match}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.competitionName}
                      {event.competitionCode
                        ? ` (${event.competitionCode})`
                        : ""}
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
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.status}
                    </td>
                    <td className="px-4 py-3">
                      {renderAssignmentsStatusBadge(event.assignmentsStatus)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/designazioni/${event.id}`}
                        className="rounded bg-pitch-accent px-3 py-1 text-sm font-medium text-pitch-bg hover:bg-yellow-200"
                      >
                        Apri
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
