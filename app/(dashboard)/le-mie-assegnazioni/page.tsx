"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { SearchBar } from "@/components/SearchBar";
import {
  type FetchMyAssignmentsStaffError,
  type MyAssignmentStaffItem,
  confirmAllMyAssignmentsStaff,
  confirmMyAssignmentStaff,
  fetchMyAssignmentsStaff,
  rejectMyAssignmentStaff,
} from "@/lib/api/myAssignmentsStaff";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import { canSeeFinance } from "@/lib/auth/financeAccess";
import StatusBadge, {
  type StatusBadgeVariant,
} from "@/components/ui/StatusBadge";
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

function assignmentStatusBadgeProps(status: string): {
  variant: StatusBadgeVariant;
  label: string;
} {
  switch (status) {
    case "CONFIRMED":
      return { variant: "accepted", label: "Confirmed" };
    case "REJECTED":
      return { variant: "declined", label: "Declined" };
    default:
      return { variant: "pending", label: "To confirm" };
  }
}

function filterAssignments(
  items: MyAssignmentStaffItem[],
  search: string
): MyAssignmentStaffItem[] {
  if (!search.trim()) return items;
  const q = search.trim().toLowerCase();
  return items.filter((a) => {
    if (!a || !a.assignment || !a.event) return false;
    const { assignment, event } = a;
    const text = [
      event.competition_name,
      event.home_team_name_short,
      event.away_team_name_short,
      event.show_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text.includes(q);
  });
}

function parsePlates(platesStr: string): string[] {
  if (!platesStr?.trim()) return [];
  return platesStr
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
}

export default function LeMieAssegnazioniPage() {
  const router = useRouter();
  const [items, setItems] = useState<MyAssignmentStaffItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionId, setActionId] = useState<number | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [carPass, setCarPass] = useState<Record<number, boolean>>({});
  const [showFinance, setShowFinance] = useState(false);

  const [plates, setPlates] = useState<string[]>([]);

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    setBlockedMessage(null);
    try {
      const { items: nextItems, staffPlates } =
        await fetchMyAssignmentsStaff();
      setItems(nextItems);
      setPlates(parsePlates(staffPlates ?? ""));
    } catch (e) {
      const err = e as FetchMyAssignmentsStaffError;
      if (err.status === 401) {
        router.push("/login");
        return;
      }
      if (err.status === 429) {
        const seconds = err.retryAfterSeconds ?? 600;
        const minutes = Math.ceil(seconds / 60);
        setBlockedMessage(
          `Too many attempts. Try again in about ${minutes} minutes.`
        );
        return;
      }
      setError("Error loading assignments.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchAuthMe();
        if (!cancelled) setShowFinance(canSeeFinance(me));
      } catch {
        if (!cancelled) setShowFinance(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(
    () => filterAssignments(items, search),
    [items, search]
  );

  const sentAssignments = useMemo(
    () =>
      items.filter(
        (a) => a && a.assignment && a.assignment.status === "SENT"
      ),
    [items]
  );

  const handleConfirm = async (row: MyAssignmentStaffItem) => {
    if (!row?.assignment) return;
    const { assignment } = row;
    if (assignment.status !== "SENT") return;
    setActionId(assignment.id);
    try {
      await confirmMyAssignmentStaff(assignment.id);
      setItems((prev) =>
        prev.map((a) =>
          a && a.assignment && a.assignment.id === assignment.id
            ? {
                ...a,
                assignment: { ...a.assignment, status: "CONFIRMED" },
              }
            : a
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error confirming");
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (row: MyAssignmentStaffItem) => {
    if (!row?.assignment) return;
    const { assignment } = row;
    if (assignment.status !== "SENT") return;
    setActionId(assignment.id);
    try {
      await rejectMyAssignmentStaff(assignment.id);
      setItems((prev) =>
        prev.map((a) =>
          a && a.assignment && a.assignment.id === assignment.id
            ? {
                ...a,
                assignment: { ...a.assignment, status: "REJECTED" },
              }
            : a
        )
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error declining");
    } finally {
      setActionId(null);
    }
  };

  const handleConfirmAll = async () => {
    if (sentAssignments.length === 0) return;
    setConfirmingAll(true);
    try {
      await confirmAllMyAssignmentsStaff();
      await loadAssignments();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Error confirming");
    } finally {
      setConfirmingAll(false);
    }
  };

  const toggleCarPass = (assignmentId: number) => {
    setCarPass((prev) => ({
      ...prev,
      [assignmentId]: !prev[assignmentId],
    }));
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Le mie assegnazioni" />
        <div className="mt-4">
          <SearchBar placeholder="Cerca per competizione, squadre, show..." />
        </div>
        <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
          <PageLoading />
        </div>
      </>
    );
  }

  if (blockedMessage) {
    return (
      <>
        <PageHeader title="Le mie assegnazioni" />
        <div className="mt-6 rounded-lg border border-yellow-900/50 bg-yellow-900/20 p-6 text-yellow-300">
          {blockedMessage}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Le mie assegnazioni" />
        <div className="mt-4">
          <SearchBar placeholder="Cerca per competizione, squadre, show..." />
        </div>
        <div className="mt-6 rounded-lg border border-red-900/50 bg-red-900/20 p-6 text-red-300">
          {error}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Le mie assegnazioni" />
      <div className="mt-4">
        <SearchBar
          placeholder="Cerca per competizione, squadre, show..."
          onSearchChange={setSearch}
        />
      </div>

      {sentAssignments.length > 0 && (
        <div className="mt-4">
          <button
            type="button"
            onClick={handleConfirmAll}
            disabled={confirmingAll}
            className="rounded-lg bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {confirmingAll ? "Confirming..." : "Confirm all"}
          </button>
        </div>
      )}

      <div className="mt-6">
        {filteredItems.length === 0 ? (
          <div className="rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
            <EmptyState
              message={
                items.length === 0
                  ? "Nessuna assegnazione trovata"
                  : "Nessun risultato per la ricerca."
              }
              icon={items.length === 0 ? "calendar" : "search"}
            />
          </div>
        ) : (
          <ResponsiveTable minWidth="900px">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-pitch-gray-dark">
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Data KO
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Partita
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Competizione
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Venue
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Role
                </th>
                {showFinance ? (
                  <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                    Fee
                  </th>
                ) : null}
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Plate
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((row) => {
                if (!row || !row.assignment || !row.event) return null;
                const { assignment, event } = row;
                const match =
                  event.home_team_name_short && event.away_team_name_short
                    ? `${event.home_team_name_short} vs ${event.away_team_name_short}`
                    : event.home_team_name_short ??
                      event.away_team_name_short ??
                      "—";
                const luogo =
                  event.location ??
                  event.venue_name ??
                  event.competition_name ??
                  "—";
                const canHaveCarPass =
                  assignment.location?.toUpperCase() === "STADIO" &&
                  event.standard_onsite?.toUpperCase() !== "NO ONSITE";
                const isSent = assignment.status === "SENT";
                const isActioning = actionId === assignment.id;

                return (
                  <tr
                    key={assignment.id}
                    className="border-b border-pitch-gray-dark/50 hover:bg-pitch-gray-dark/30"
                  >
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {formatKoItaly(event.ko_italy)}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-white">
                      {match}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {event.competition_name}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {luogo}
                    </td>
                    <td className="px-4 py-3 text-sm text-pitch-gray-light">
                      {assignment.role_code}
                    </td>
                    {showFinance ? (
                      <td className="px-4 py-3 text-sm text-pitch-gray-light">
                        {assignment.fee ?? "—"}
                      </td>
                    ) : null}
                    <td className="px-4 py-3">
                      <StatusBadge
                        {...assignmentStatusBadgeProps(assignment.status)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {!canHaveCarPass ? (
                        <span className="text-pitch-gray">—</span>
                      ) : plates.length === 0 ? (
                        <span className="text-pitch-gray">—</span>
                      ) : plates.length === 1 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-pitch-gray-light">
                            {plates[0]}
                          </span>
                          <label className="flex items-center gap-1.5 text-sm text-pitch-gray-light">
                            <input
                              type="checkbox"
                              checked={!!carPass[assignment.id]}
                              onChange={() => toggleCarPass(assignment.id)}
                              className="rounded border-pitch-gray-dark bg-pitch-gray-dark text-pitch-accent focus:ring-pitch-accent"
                            />
                            Car pass
                          </label>
                        </div>
                      ) : (
                        <select
                          defaultValue={plates[0]}
                          className="rounded border border-pitch-gray-dark bg-pitch-gray-dark px-2 py-1 text-sm text-pitch-white focus:border-pitch-accent focus:outline-none"
                        >
                          {plates.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSent && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleConfirm(row)}
                            disabled={isActioning}
                            className="min-h-[44px] rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isActioning ? "..." : "Confirm"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(row)}
                            disabled={isActioning}
                            className="min-h-[44px] rounded border border-red-500/50 bg-transparent px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Decline
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </ResponsiveTable>
        )}
      </div>
    </>
  );
}
