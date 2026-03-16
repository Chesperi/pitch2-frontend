"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import {
  fetchEvents,
  type EventItem,
  type EventAssignmentsStatus,
} from "@/lib/api/events";
import {
  fetchAssignmentsByPeriod,
  sendDesignazioniForPerson,
  sendDesignazioniForPeriod,
  type AssignmentWithJoins,
} from "@/lib/api/assignments";

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

function getAssignmentStatusLabel(status: string): string {
  switch (status) {
    case "DRAFT":
      return "Bozza";
    case "READY":
      return "Pronto";
    case "SENT":
      return "Inviato";
    case "CONFIRMED":
      return "Confermato";
    case "REJECTED":
      return "Rifiutato";
    default:
      return status;
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
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [staffGroups, setStaffGroups] = useState<
    { staffId: number; staffName: string; assignments: AssignmentWithJoins[] }[]
  >([]);
  const [expandedStaffId, setExpandedStaffId] = useState<number | null>(null);

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

  const handleSendMailForPerson = useCallback(
    async (group: {
      staffId: number;
      staffName: string;
      assignments: AssignmentWithJoins[];
    }) => {
      try {
        const ids = group.assignments.map((a) => a.id);
        await sendDesignazioniForPerson(group.staffId, ids);
        alert(`Mail simulata per ${group.staffName} (${ids.length} eventi)`);
      } catch (e) {
        console.error(e);
        alert("Errore nell'invio mail per persona");
      }
    },
    []
  );

  const handleSendMailForPeriod = useCallback(async () => {
    if (!startDate || !endDate) return;
    try {
      await sendDesignazioniForPeriod(startDate, endDate);
      alert("Mail simulate per tutte le persone nel periodo");
    } catch (e) {
      console.error(e);
      alert("Errore nell'invio mail periodo");
    }
  }, [startDate, endDate]);

  const loadAssignmentsByPeriod = useCallback(async () => {
    if (!startDate || !endDate) return;

    try {
      const items = await fetchAssignmentsByPeriod(startDate, endDate);

      const groupsMap = new Map<number, AssignmentWithJoins[]>();

      for (const a of items) {
        if (a.staffId == null && a.staff_id == null) continue;
        const id = (a.staffId ?? a.staff_id) as number;
        const existing = groupsMap.get(id) ?? [];
        existing.push(a);
        groupsMap.set(id, existing);
      }

      const groupsArray = Array.from(groupsMap.entries()).map(
        ([staffId, assignments]) => {
          const first = assignments[0];
          const fullName = `${first.staffSurname ?? first.staff_surname ?? ""} ${first.staffName ?? first.staff_name ?? ""}`.trim();

          return {
            staffId,
            staffName: fullName || `ID ${staffId}`,
            assignments,
          };
        }
      );

      groupsArray.sort((a, b) => a.staffName.localeCompare(b.staffName));

      setStaffGroups(groupsArray);
      setExpandedStaffId(null);
    } catch (e) {
      console.error(e);
    }
  }, [startDate, endDate]);

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

      {/* Designazioni per persona */}
      <section className="mt-8">
        <h2 className="mb-2 text-sm font-semibold text-pitch-white">
          Designazioni per persona
        </h2>

        {/* Filtro periodo */}
        <div className="mb-4 flex items-center gap-3">
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">Da</label>
            <input
              type="date"
              value={startDate ?? ""}
              onChange={(e) => setStartDate(e.target.value || null)}
              className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-2 py-1 text-xs text-pitch-white focus:border-pitch-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">A</label>
            <input
              type="date"
              value={endDate ?? ""}
              onChange={(e) => setEndDate(e.target.value || null)}
              className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-2 py-1 text-xs text-pitch-white focus:border-pitch-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            className="ml-2 rounded bg-pitch-accent px-3 py-1 text-xs font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50"
            disabled={!startDate || !endDate}
            onClick={loadAssignmentsByPeriod}
          >
            Filtra periodo
          </button>
          <button
            type="button"
            className="ml-2 rounded bg-yellow-700 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
            disabled={!startDate || !endDate || staffGroups.length === 0}
            onClick={handleSendMailForPeriod}
          >
            Invia mail periodo
          </button>
        </div>

        {/* Tabella macro per persona */}
        <div className="overflow-x-auto rounded-lg border border-pitch-gray-dark">
          {staffGroups.length === 0 ? (
            <div className="p-6 text-center text-pitch-gray">
              {startDate && endDate
                ? "Nessuna designazione nel periodo selezionato"
                : "Seleziona un periodo e clicca su Filtra periodo"}
            </div>
          ) : (
            <table className="w-full min-w-[400px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-pitch-gray-dark text-left text-pitch-gray">
                  <th className="px-4 py-2">Persona</th>
                  <th className="px-4 py-2">N. eventi</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {staffGroups.map((group) => (
                  <React.Fragment key={group.staffId}>
                    <tr
                      key={group.staffId}
                      className="border-t border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                    >
                      <td
                        className="cursor-pointer px-4 py-2 text-pitch-white hover:underline"
                        onClick={() =>
                          setExpandedStaffId(
                            expandedStaffId === group.staffId
                              ? null
                              : group.staffId
                          )
                        }
                      >
                        {group.staffName}
                      </td>
                      <td className="px-4 py-2 text-pitch-gray-light">
                        {group.assignments.length}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          className="rounded bg-pitch-accent px-3 py-1 text-[11px] font-medium text-pitch-bg hover:bg-yellow-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendMailForPerson(group);
                          }}
                        >
                          Invia mail
                        </button>
                      </td>
                    </tr>

                    {expandedStaffId === group.staffId && (
                      <tr>
                        <td colSpan={3} className="pb-2 pt-0">
                          <table className="mt-1 w-full text-[11px]">
                            <thead>
                              <tr className="text-pitch-gray">
                                <th className="py-1 text-left">Evento</th>
                                <th className="py-1 text-left">Match</th>
                                <th className="py-1 text-left">Ruolo</th>
                                <th className="py-1 text-left">Status</th>
                                <th className="py-1 text-right"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.assignments.map((a) => {
                                const eventId =
                                  (a as Record<string, unknown>).eventId ??
                                  a.event_id;
                                const matchDay =
                                  (a as Record<string, unknown>).eventMatchDay ??
                                  a.event_match_day;
                                const home =
                                  (a as Record<string, unknown>)
                                    .eventHomeTeamNameShort ??
                                  a.event_home_team_name_short;
                                const away =
                                  (a as Record<string, unknown>)
                                    .eventAwayTeamNameShort ??
                                  a.event_away_team_name_short;
                                const matchStr =
                                  home && away
                                    ? `${String(home)} – ${String(away)}`
                                    : home != null
                                      ? String(home)
                                      : away != null
                                        ? String(away)
                                        : "—";
                                return (
                                  <tr
                                    key={a.id}
                                    className="border-t border-pitch-gray-dark/30"
                                  >
                                    <td className="py-1 text-pitch-gray-light">
                                      {matchDay != null
                                        ? String(matchDay)
                                        : "—"}
                                    </td>
                                    <td className="py-1 text-pitch-white">
                                      {matchStr}
                                    </td>
                                    <td className="py-1 text-pitch-gray-light">
                                      {a.roleName ??
                                        a.role_name ??
                                        a.roleCode ??
                                        a.role_code}
                                    </td>
                                    <td className="py-1">
                                      {getAssignmentStatusLabel(a.status)}
                                    </td>
                                    <td className="py-1 text-right">
                                      <Link
                                        href={`/designazioni/${eventId}`}
                                        className="text-pitch-accent hover:underline"
                                      >
                                        Apri designazioni
                                      </Link>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
