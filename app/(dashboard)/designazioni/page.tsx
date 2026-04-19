"use client";

import Link from "next/link";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import {
  fetchDesignableEvents,
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
import StatusBadge from "@/components/ui/StatusBadge";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PageLoading from "@/components/ui/PageLoading";
import EmptyState from "@/components/ui/EmptyState";

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
      return <StatusBadge variant="draft" label="Draft" />;
    case "READY_TO_SEND":
      return <StatusBadge variant="pending" label="Ready" />;
    case "SENT":
      return <StatusBadge variant="accepted" label="Sent" />;
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
      return "Draft";
    case "READY":
      return "Ready";
    case "SENT":
      return "Sent";
    case "CONFIRMED":
      return "Confirmed";
    case "REJECTED":
      return "Declined";
    default:
      return status;
  }
}

/** Etichetta categoria per designatore (MATCH / MEDIA_CONTENT). */
function categoryLabel(category: string): string {
  const u = category.toUpperCase().replace(/\s+/g, "_");
  if (u.includes("MEDIA")) return "MEDIA_CONTENT";
  if (u.includes("MATCH")) return "MATCH";
  return category.trim() || "—";
}

/** Match o descrizione per contenuti media. */
function eventRowDescription(event: EventItem): string {
  const cat = event.category.toUpperCase();
  if (cat.includes("MEDIA")) {
    const parts = [event.showName, event.competitionName].filter(
      (p): p is string => !!p?.trim()
    );
    return parts.length ? parts.join(" · ") : "—";
  }
  if (event.homeTeamNameShort?.trim() && event.awayTeamNameShort?.trim()) {
    return `${event.homeTeamNameShort} vs ${event.awayTeamNameShort}`;
  }
  return (
    event.homeTeamNameShort?.trim() ||
    event.awayTeamNameShort?.trim() ||
    event.showName?.trim() ||
    "—"
  );
}

const ASSIGNMENTS_STATUS_OPTIONS: {
  value: "" | EventAssignmentsStatus;
  label: string;
}[] = [
  { value: "", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "READY_TO_SEND", label: "Ready" },
  { value: "SENT", label: "Sent" },
];

type ListScope = "designable" | "all";

export default function DesignazioniPage() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listScope, setListScope] = useState<ListScope>("designable");
  const [assignmentsStatusFilter, setAssignmentsStatusFilter] =
    useState<EventAssignmentsStatus | "">("");
  const [search, setSearch] = useState("");

  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [staffGroups, setStaffGroups] = useState<
    {
      staffId: number;
      staffName: string;
      assignments: AssignmentWithJoins[];
      roles: string[];
      distinctEventCount: number;
    }[]
  >([]);
  const [expandedStaffId, setExpandedStaffId] = useState<number | null>(null);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const assignFilter = assignmentsStatusFilter || undefined;
      if (listScope === "designable") {
        const { items: next } = await fetchDesignableEvents({
          limit: 100,
          offset: 0,
          ...(assignFilter && { assignments_status: assignFilter }),
        });
        setItems(next);
      } else {
        const { items: next } = await fetchEvents({
          limit: 150,
          offset: 0,
          ...(assignFilter && { assignments_status: assignFilter }),
        });
        setItems(next);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Loading error");
    } finally {
      setLoading(false);
    }
  }, [listScope, assignmentsStatusFilter]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const handleSendMailForPerson = useCallback(
    async (group: {
      staffId: number;
      staffName: string;
      assignments: AssignmentWithJoins[];
      roles: string[];
      distinctEventCount: number;
    }) => {
      const ids = group.assignments.map((a) => a.id);
      await sendDesignazioniForPerson(group.staffId, ids);
      alert(
        `Email sent to ${group.staffName} (${group.distinctEventCount} events)`
      );
    },
    []
  );

  const handleSendMailForPeriod = useCallback(async () => {
    if (!startDate || !endDate) return;
    try {
      await sendDesignazioniForPeriod(startDate, endDate);
      alert("Simulated email for everyone in the period");
    } catch (e) {
      console.error(e);
      alert("Error sending period email");
    }
  }, [startDate, endDate]);

  const loadAssignmentsByPeriod = useCallback(async () => {
    if (!startDate || !endDate) return;

    try {
      const list = await fetchAssignmentsByPeriod(startDate, endDate);

      const groupsMap = new Map<number, AssignmentWithJoins[]>();

      for (const a of list) {
        if (a.staffId == null && a.staff_id == null) continue;
        const id = Number(a.staffId ?? a.staff_id);
        if (!Number.isFinite(id) || id <= 0) continue;
        const existing = groupsMap.get(id) ?? [];
        existing.push(a);
        groupsMap.set(id, existing);
      }

      const groupsArray = Array.from(groupsMap.entries()).map(
        ([staffId, assignments]) => {
          const first = assignments[0];
          const fullName = `${first.staffSurname ?? first.staff_surname ?? ""} ${first.staffName ?? first.staff_name ?? ""}`.trim();

          const roleLabels = assignments
            .map((a) =>
              String(
                a.roleName ??
                  a.role_name ??
                  a.roleCode ??
                  a.role_code ??
                  ""
              ).trim()
            )
            .filter((r) => r.length > 0);

          return {
            staffId,
            staffName: fullName || `ID ${staffId}`,
            assignments,
            roles: Array.from(new Set(roleLabels)).sort((x, y) =>
              x.localeCompare(y, "it")
            ),
            distinctEventCount: new Set(
              assignments
                .map((a) => String(a.event_id ?? "").trim())
                .filter((eid) => eid.length > 0)
            ).size,
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

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter((e) => {
      const desc = eventRowDescription(e).toLowerCase();
      return (
        e.competitionName?.toLowerCase().includes(q) ||
        desc.includes(q) ||
        categoryLabel(e.category).toLowerCase().includes(q)
      );
    });
  }, [items, search]);

  if (loading) {
    return (
      <>
        <PageHeader title="Assignments" />
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
          <PageLoading />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Assignments" />
        <div className="mt-6 rounded-lg border border-red-900/50 bg-red-900/20 p-6 text-red-300">
          {error}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Assignments" />

      <p className="mt-2 max-w-3xl text-sm text-pitch-gray">
        Event list for assigners. Choose whether to see only assignable candidates
        (consistent standards and event state) or all events in the list. Open
        the detail to manage staffing and sends.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-pitch-gray">View</label>
          <div className="flex rounded-lg border border-pitch-gray-dark p-0.5">
            <button
              type="button"
              onClick={() => setListScope("designable")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                listScope === "designable"
                  ? "bg-pitch-accent text-pitch-bg"
                  : "text-pitch-gray-light hover:text-pitch-white"
              }`}
            >
              Assignable
            </button>
            <button
              type="button"
              onClick={() => setListScope("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                listScope === "all"
                  ? "bg-pitch-accent text-pitch-bg"
                  : "text-pitch-gray-light hover:text-pitch-white"
              }`}
            >
              All events
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-pitch-gray">
            Assignment status
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
      </div>

      <div className="mt-4">
        <SearchBar
          placeholder="Search by competition, match, show..."
          onSearchChange={setSearch}
        />
      </div>

      <div className="mt-6">
        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
            {items.length === 0 && !search.trim() ? (
              <EmptyState
                message="Seleziona un periodo per visualizzare le designazioni"
                icon="calendar"
              />
            ) : (
              <EmptyState
                message="Nessuna designazione trovata per i filtri selezionati"
                icon="search"
              />
            )}
          </div>
        ) : (
          <ResponsiveTable minWidth="860px">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Date & KO
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Event
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Competition
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Assignment status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((event) => (
                <tr
                  key={event.id}
                  className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                >
                  <td className="px-4 py-3 text-sm text-pitch-gray-light">
                    {formatKoItaly(event.koItaly)}
                  </td>
                  <td className="px-4 py-3 text-sm text-pitch-white">
                    {eventRowDescription(event)}
                  </td>
                  <td className="px-4 py-3 text-sm text-pitch-gray-light">
                    {categoryLabel(event.category)}
                  </td>
                  <td className="px-4 py-3 text-sm text-pitch-gray-light">
                    {event.competitionName}
                    {event.competitionCode
                      ? ` (${event.competitionCode})`
                      : ""}
                  </td>
                  <td className="px-4 py-3">
                    {renderAssignmentsStatusBadge(event.assignmentsStatus)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/designazioni/${event.id}`}
                      className="inline-flex min-h-[44px] items-center rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </ResponsiveTable>
        )}
      </div>

      <section className="mt-10 border-t border-pitch-gray-dark pt-8">
        <h2 className="mb-2 text-sm font-semibold text-pitch-white">
          Assignments by person
        </h2>
        <p className="mb-4 text-xs text-pitch-gray">
          Group assignments by period and send communications (operational step
          separate from the event list above).
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">From</label>
            <input
              type="date"
              value={startDate ?? ""}
              onChange={(e) => setStartDate(e.target.value || null)}
              className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-2 py-1 text-xs text-pitch-white focus:border-pitch-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-pitch-gray">To</label>
            <input
              type="date"
              value={endDate ?? ""}
              onChange={(e) => setEndDate(e.target.value || null)}
              className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-2 py-1 text-xs text-pitch-white focus:border-pitch-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            className="rounded bg-pitch-accent px-3 py-1 text-xs font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50"
            disabled={!startDate || !endDate}
            onClick={loadAssignmentsByPeriod}
          >
            Filter period
          </button>
          <button
            type="button"
            className="rounded bg-yellow-700 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-600 disabled:opacity-50"
            disabled={!startDate || !endDate || staffGroups.length === 0}
            onClick={handleSendMailForPeriod}
          >
            Send period email
          </button>
        </div>

        <ResponsiveTable
          className="rounded-lg border border-pitch-gray-dark"
          minWidth="640px"
        >
          {staffGroups.length === 0 ? (
            <div className="p-6 text-center text-pitch-gray">
              {startDate && endDate
                ? "Nessuna assegnazione nel periodo selezionato"
                : "Seleziona un periodo e clicca Filtra periodo"}
            </div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-pitch-gray-dark text-left text-pitch-gray">
                  <th className="px-4 py-2">Person</th>
                  <th className="px-4 py-2">Ruoli</th>
                  <th className="px-4 py-2">N. events</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {staffGroups.map((group) => (
                  <React.Fragment key={group.staffId}>
                    <tr className="border-t border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30">
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
                        {group.roles.length > 0 ? group.roles.join(", ") : "—"}
                      </td>
                      <td className="px-4 py-2 text-pitch-gray-light">
                        {group.distinctEventCount}
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
                          Send email
                        </button>
                      </td>
                    </tr>

                    {expandedStaffId === group.staffId && (
                      <tr>
                        <td colSpan={4} className="pb-2 pt-0">
                          <table className="mt-1 w-full text-[11px]">
                            <thead>
                              <tr className="text-pitch-gray">
                                <th className="py-1 text-left">Event</th>
                                <th className="py-1 text-left">Match</th>
                                <th className="py-1 text-left">Role</th>
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
                                        Open assignments
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
        </ResponsiveTable>
      </section>
    </>
  );
}
