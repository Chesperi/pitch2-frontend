"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  fetchAuthMe,
  type UserProfile,
} from "@/lib/api/freelanceAssignments";
import { canSeeFinance } from "@/lib/auth/financeAccess";
import StatusBadge, {
  type StatusBadgeVariant,
} from "@/components/ui/StatusBadge";
import ResponsiveTable from "@/components/ui/ResponsiveTable";
import PageLoading from "@/components/ui/PageLoading";
import EmptyState from "@/components/ui/EmptyState";
import PrimaryButton from "@/components/ui/PrimaryButton";
import type { ShiftType } from "@/lib/api/shifts";
import {
  deleteShiftApi,
  fetchDistinctTeamNames,
  fetchMyShifts,
  fetchShiftsByRange,
  fetchTeamMembers,
  upsertShiftsBulk,
} from "@/lib/api/shifts";
import { SHIFT_CHIP_CLASS, SHIFT_TYPES, ShiftChip } from "./shiftUi";

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

function assignmentDayIso(row: MyAssignmentStaffItem): string {
  const ko = row.event?.ko_italy?.trim();
  if (ko && ko.length >= 10) return ko.slice(0, 10);
  return "";
}

function assignmentStatusBadgeProps(status: string): {
  variant: StatusBadgeVariant;
  label: string;
} {
  switch (status) {
    case "CONFIRMED":
      return { variant: "accepted", label: "Confermata" };
    case "REJECTED":
      return { variant: "declined", label: "Rifiutata" };
    default:
      return { variant: "pending", label: "Da confermare" };
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
    const { event } = a;
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

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Lunedì della settimana ISO contenente `d`. */
function mondayOfWeekContaining(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return x;
}

function addDaysIso(iso: string, delta: number): string {
  const [y, m, day] = iso.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 1, day ?? 1);
  d.setDate(d.getDate() + delta);
  return toIsoDate(d);
}

function buildMonthGrid(monthAnchor: Date): {
  isoDate: string;
  day: number;
  inCurrentMonth: boolean;
}[] {
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();
  const first = new Date(year, month, 1);
  const firstDayMondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstDayMondayIndex);
  const cells: { isoDate: string; day: number; inCurrentMonth: boolean }[] =
    [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      isoDate: toIsoDate(d),
      day: d.getDate(),
      inCurrentMonth: d.getMonth() === month,
    });
  }
  return cells;
}

function initials(n: string, s: string): string {
  const a = n.trim().charAt(0).toUpperCase();
  const b = s.trim().charAt(0).toUpperCase();
  return `${a || "?"}${b || ""}`;
}

type TabId = "lista" | "calendario" | "turni";

export default function LeMieAssegnazioniPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("lista");
  const [profile, setProfile] = useState<UserProfile | null>(null);

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

  const [weeklyShifts, setWeeklyShifts] = useState<Awaited<
    ReturnType<typeof fetchMyShifts>
  > >([]);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calTeam, setCalTeam] = useState<string>("__tutti__");
  const [teamOptions, setTeamOptions] = useState<string[]>([]);
  const [calMyShifts, setCalMyShifts] = useState<
    Awaited<ReturnType<typeof fetchMyShifts>>
  >([]);
  const [calTeamShifts, setCalTeamShifts] = useState<
    Awaited<ReturnType<typeof fetchShiftsByRange>>
  >([]);
  const [calPanelDay, setCalPanelDay] = useState<string | null>(null);

  const [turniMonth, setTurniMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [turniTeam, setTurniTeam] = useState<string>("");
  const [turniMembers, setTurniMembers] = useState<
    Awaited<ReturnType<typeof fetchTeamMembers>>
  >([]);
  const [turniLoaded, setTurniLoaded] = useState<
    Awaited<ReturnType<typeof fetchShiftsByRange>>
  >([]);
  /** key staffId-date -> tipo o delete */
  const [turniPending, setTurniPending] = useState<
    Record<string, ShiftType | null>
  >({});
  const [popover, setPopover] = useState<{
    staffId: number;
    date: string;
    x: number;
    y: number;
  } | null>(null);
  const [turniSaving, setTurniSaving] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);

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
          `Troppi tentativi. Riprova tra circa ${minutes} minuti.`
        );
        return;
      }
      setError("Errore nel caricamento delle assegnazioni.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const me = await fetchAuthMe();
        if (!c) {
          setProfile(me);
          setShowFinance(canSeeFinance(me));
          if (me.team_dazn?.trim()) setCalTeam(me.team_dazn.trim());
        }
      } catch {
        if (!c) setShowFinance(false);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  useEffect(() => {
    const mon = mondayOfWeekContaining(new Date());
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    let cancelled = false;
    (async () => {
      try {
        const sh = await fetchMyShifts(toIsoDate(mon), toIsoDate(sun));
        if (!cancelled) setWeeklyShifts(sh);
      } catch {
        if (!cancelled) setWeeklyShifts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const teams = await fetchDistinctTeamNames();
        if (!c) setTeamOptions(teams);
      } catch {
        if (!c) setTeamOptions([]);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const monthRange = useMemo(() => {
    const cells = buildMonthGrid(calendarMonth);
    const from = cells[0]?.isoDate ?? "";
    const to = cells[cells.length - 1]?.isoDate ?? "";
    return { from, to };
  }, [calendarMonth]);

  useEffect(() => {
    if (!monthRange.from || !monthRange.to) return;
    let c = false;
    (async () => {
      try {
        const mine = await fetchMyShifts(monthRange.from, monthRange.to);
        if (!c) setCalMyShifts(mine);
        const teamQ =
          calTeam === "__tutti__" ? undefined : calTeam.trim() || undefined;
        const teamShifts = await fetchShiftsByRange(
          monthRange.from,
          monthRange.to,
          teamQ
        );
        if (!c) setCalTeamShifts(teamShifts);
      } catch {
        if (!c) {
          setCalMyShifts([]);
          setCalTeamShifts([]);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, [calendarMonth, calTeam, monthRange.from, monthRange.to]);

  const turniMonthRange = useMemo(() => {
    const cells = buildMonthGrid(turniMonth);
    const from = cells[0]?.isoDate ?? "";
    const to = cells[cells.length - 1]?.isoDate ?? "";
    return { from, to, cells };
  }, [turniMonth]);

  useEffect(() => {
    if (!turniTeam.trim()) {
      setTurniMembers([]);
      setTurniLoaded([]);
      return;
    }
    let c = false;
    (async () => {
      try {
        const [mem, sh] = await Promise.all([
          fetchTeamMembers(turniTeam.trim()),
          fetchShiftsByRange(
            turniMonthRange.from,
            turniMonthRange.to,
            turniTeam.trim()
          ),
        ]);
        if (!c) {
          setTurniMembers(mem);
          setTurniLoaded(sh);
          setTurniPending({});
        }
      } catch {
        if (!c) {
          setTurniMembers([]);
          setTurniLoaded([]);
        }
      }
    })();
    return () => {
      c = true;
    };
  }, [turniTeam, turniMonthRange.from, turniMonthRange.to]);

  const levelUpper = profile?.user_level?.toUpperCase() ?? "";
  const showTurniTab =
    levelUpper === "MASTER" || !!profile?.shifts_management;

  const managedTeamsList = profile?.managed_teams ?? [];

  const shiftForStaffDate = useCallback(
    (staffId: number, date: string): ShiftType | null => {
      const k = `${staffId}-${date}`;
      if (Object.prototype.hasOwnProperty.call(turniPending, k)) {
        return turniPending[k] ?? null;
      }
      const row = turniLoaded.find(
        (s) => s.staffId === staffId && s.date === date
      );
      return row ? row.shiftType : null;
    },
    [turniLoaded, turniPending]
  );

  const canEditTurniCell = useCallback(
    (memberTeam: string | null | undefined) => {
      if (levelUpper === "MASTER") return true;
      if (!profile?.shifts_management) return false;
      const t = (memberTeam ?? "").trim();
      if (!t) return false;
      return managedTeamsList.some(
        (m) => m.trim().toLowerCase() === t.toLowerCase()
      );
    },
    [levelUpper, profile?.shifts_management, managedTeamsList]
  );

  const handleTurniSave = async () => {
    const entries: Array<{ staffId: number; date: string; shiftType: ShiftType }> =
      [];
    const deletes: Array<{ staffId: number; date: string }> = [];
    for (const [key, val] of Object.entries(turniPending)) {
      const [sid, ...rest] = key.split("-");
      const date = rest.join("-");
      const staffId = Number(sid);
      if (!Number.isFinite(staffId) || !date) continue;
      if (val === null) deletes.push({ staffId, date });
      else entries.push({ staffId, date, shiftType: val });
    }
    setTurniSaving(true);
    try {
      if (entries.length > 0) await upsertShiftsBulk(entries);
      for (const d of deletes) await deleteShiftApi(d.staffId, d.date);
      const sh = await fetchShiftsByRange(
        turniMonthRange.from,
        turniMonthRange.to,
        turniTeam.trim()
      );
      setTurniLoaded(sh);
      setTurniPending({});
    } catch (e) {
      alert(e instanceof Error ? e.message : "Salvataggio non riuscito");
    } finally {
      setTurniSaving(false);
    }
  };

  const handleCopyWeekForward = () => {
    const mon = mondayOfWeekContaining(turniMonth);
    const sourceStart = toIsoDate(mon);
    const mapNew: Record<string, ShiftType | null> = { ...turniPending };
    for (const m of turniMembers) {
      for (let d = 0; d < 7; d++) {
        const src = addDaysIso(sourceStart, d);
        const dst = addDaysIso(sourceStart, d + 7);
        const cur = shiftForStaffDate(m.id, src);
        if (cur) mapNew[`${m.id}-${dst}`] = cur;
      }
    }
    setTurniPending(mapNew);
  };

  useEffect(() => {
    function onDocMouseDown(ev: MouseEvent) {
      if (!popover) return;
      const el = gridRef.current;
      if (el && !el.contains(ev.target as Node)) setPopover(null);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [popover]);

  const filteredItems = useMemo(
    () => filterAssignments(items, search),
    [items, search]
  );

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  const { azione, confermate, passateAlt } = useMemo(() => {
    const az: MyAssignmentStaffItem[] = [];
    const cf: MyAssignmentStaffItem[] = [];
    const pa: MyAssignmentStaffItem[] = [];
    for (const row of filteredItems) {
      if (!row?.assignment || !row.event) continue;
      const day = assignmentDayIso(row);
      const st = row.assignment.status.toUpperCase();
      const isPast = day && day < todayIso;
      if (isPast) {
        pa.push(row);
      } else if (st === "SENT") {
        az.push(row);
      } else if (st === "CONFIRMED") {
        cf.push(row);
      } else {
        pa.push(row);
      }
    }
    return { azione: az, confermate: cf, passateAlt: pa };
  }, [filteredItems, todayIso]);

  const weeklyByIso = useMemo(() => {
    const m = new Map<string, ShiftType>();
    for (const s of weeklyShifts) {
      m.set(s.date, s.shiftType);
    }
    return m;
  }, [weeklyShifts]);

  const mondayThisWeek = useMemo(() => mondayOfWeekContaining(new Date()), []);

  const weekDaysIso = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(mondayThisWeek);
      d.setDate(mondayThisWeek.getDate() + i);
      out.push(toIsoDate(d));
    }
    return out;
  }, [mondayThisWeek]);

  const myShiftByDate = useMemo(() => {
    const m = new Map<string, ShiftType>();
    for (const s of calMyShifts) m.set(s.date, s.shiftType);
    return m;
  }, [calMyShifts]);

  const assignmentsByDay = useMemo(() => {
    const m = new Map<string, MyAssignmentStaffItem[]>();
    for (const row of items) {
      const iso = assignmentDayIso(row);
      if (!iso) continue;
      const arr = m.get(iso) ?? [];
      arr.push(row);
      m.set(iso, arr);
    }
    return m;
  }, [items]);

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
      alert(e instanceof Error ? e.message : "Errore conferma");
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
      alert(e instanceof Error ? e.message : "Errore rifiuto");
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
      alert(e instanceof Error ? e.message : "Errore conferma multipla");
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

  function renderAssignmentsTable(rows: MyAssignmentStaffItem[]) {
    if (rows.length === 0)
      return (
        <p className="py-6 text-center text-sm text-pitch-gray">
          Nessuna assegnazione in questa sezione.
        </p>
      );
    return (
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
                Ruolo
              </th>
              {showFinance ? (
                <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                  Fee
                </th>
              ) : null}
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                Stato
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                Targa
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-pitch-gray">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
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
                          Pass auto
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
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleConfirm(row)}
                          disabled={isActioning}
                          className="min-h-[44px] rounded bg-pitch-accent px-4 py-2 text-sm font-medium text-pitch-bg hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isActioning ? "..." : "Conferma"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(row)}
                          disabled={isActioning}
                          className="min-h-[44px] rounded border border-red-500/50 bg-transparent px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-900/30 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Rifiuta
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
    );
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Le mie assegnazioni" />
        <div className="mt-4">
          <SearchBar placeholder="Cerca competizione, squadre, show…" />
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
          <SearchBar placeholder="Cerca competizione, squadre, show…" />
        </div>
        <div className="mt-6 rounded-lg border border-red-900/50 bg-red-900/20 p-6 text-red-300">
          {error}
        </div>
      </>
    );
  }

  const calCells = buildMonthGrid(calendarMonth);
  const turniCells = turniMonthRange.cells;

  return (
    <>
      <PageHeader title="Le mie assegnazioni" />

      <div className="mt-4 flex flex-wrap gap-2 border-b border-pitch-gray-dark pb-3">
        {(
          [
            ["lista", "Lista"],
            ["calendario", "Calendario"],
            ...(showTurniTab ? ([["turni", "Turni"]] as const) : []),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-[44px] rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              tab === id
                ? "bg-pitch-accent text-pitch-bg"
                : "bg-pitch-gray-dark/50 text-pitch-gray-light hover:bg-pitch-gray-dark"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "lista" ? (
        <>
          <div className="mt-4">
            <SearchBar
              placeholder="Cerca competizione, squadre, show…"
              onSearchChange={setSearch}
            />
          </div>

          {sentAssignments.length > 0 && (
            <div className="mt-4">
              <PrimaryButton
                variant="primary"
                type="button"
                onClick={handleConfirmAll}
                disabled={confirmingAll}
                loading={confirmingAll}
              >
                Conferma tutte
              </PrimaryButton>
            </div>
          )}

          <section className="mt-8">
            <h2 className="mb-3 text-lg font-bold text-pitch-accent">
              Azione richiesta
            </h2>
            {renderAssignmentsTable(azione)}
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-lg font-bold text-pitch-white">
              Confermate
            </h2>
            {renderAssignmentsTable(confermate)}
          </section>

          <section className="mt-10">
            <h2 className="mb-3 text-lg font-bold text-pitch-gray">
              Passate / altre
            </h2>
            {renderAssignmentsTable(passateAlt)}
          </section>

          <section className="mt-10 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/20 p-4">
            <h2 className="mb-3 text-base font-bold text-pitch-white">
              Turni settimana corrente
            </h2>
            <div className="flex flex-wrap gap-2">
              {weekDaysIso.map((iso) => {
                const d = new Date(`${iso}T12:00:00`);
                const label = new Intl.DateTimeFormat("it-IT", {
                  weekday: "short",
                  day: "numeric",
                }).format(d);
                const st = weeklyByIso.get(iso);
                return (
                  <div
                    key={iso}
                    className="flex flex-col items-center gap-1 rounded border border-pitch-gray-dark px-3 py-2"
                  >
                    <span className="text-[10px] uppercase text-pitch-gray">
                      {label}
                    </span>
                    {st ? (
                      <ShiftChip type={st} />
                    ) : (
                      <span className="text-xs text-pitch-gray">—</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {filteredItems.length === 0 && items.length === 0 ? (
            <div className="mt-6 rounded-lg border border-pitch-gray-dark bg-pitch-gray-dark/30">
              <EmptyState message="Nessuna assegnazione" icon="calendar" />
            </div>
          ) : null}
        </>
      ) : null}

      {tab === "calendario" ? (
        <div className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="rounded border border-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                onClick={() =>
                  setCalendarMonth(
                    new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() - 1,
                      1
                    )
                  )
                }
              >
                ←
              </button>
              <span className="text-sm font-semibold capitalize text-pitch-white">
                {new Intl.DateTimeFormat("it-IT", {
                  month: "long",
                  year: "numeric",
                }).format(calendarMonth)}
              </span>
              <button
                type="button"
                className="rounded border border-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                onClick={() =>
                  setCalendarMonth(
                    new Date(
                      calendarMonth.getFullYear(),
                      calendarMonth.getMonth() + 1,
                      1
                    )
                  )
                }
              >
                →
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-pitch-gray-light">
              Team
              <select
                value={calTeam}
                onChange={(e) => setCalTeam(e.target.value)}
                className="rounded border border-pitch-gray-dark bg-pitch-bg px-3 py-2 text-pitch-white"
              >
                <option value="__tutti__">Tutti</option>
                {teamOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-pitch-gray">
            {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calCells.map((cell, idx) => {
              const st = myShiftByDate.get(cell.isoDate);
              const hasEv = (assignmentsByDay.get(cell.isoDate) ?? []).length > 0;
              const isToday = cell.isoDate === todayIso;
              return (
                <button
                  key={`${cell.isoDate}-${idx}`}
                  type="button"
                  onClick={() => setCalPanelDay(cell.isoDate)}
                  className={`flex min-h-[72px] flex-col items-start gap-1 rounded border p-1 text-left transition-colors ${
                    cell.inCurrentMonth ? "opacity-100" : "opacity-40"
                  } ${isToday ? "ring-2 ring-[#FFFA00]" : "border-pitch-gray-dark"}`}
                >
                  <span className="text-sm font-bold text-pitch-white">
                    {cell.day}
                  </span>
                  {st ? <ShiftChip type={st} className="!text-[10px]" /> : null}
                  {hasEv ? (
                    <span
                      className="mt-auto h-2 w-2 rounded-full bg-green-500"
                      title="Evento assegnato"
                    />
                  ) : null}
                </button>
              );
            })}
          </div>

          {calPanelDay ? (
            <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-pitch-gray-dark bg-pitch-bg p-4 shadow-xl md:max-w-lg">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-pitch-white">
                  {new Intl.DateTimeFormat("it-IT", {
                    dateStyle: "full",
                  }).format(new Date(`${calPanelDay}T12:00:00`))}
                </h3>
                <button
                  type="button"
                  className="text-pitch-gray hover:text-pitch-white"
                  onClick={() => setCalPanelDay(null)}
                >
                  ✕
                </button>
              </div>
              <CalDayPanel
                iso={calPanelDay}
                assignments={assignmentsByDay.get(calPanelDay) ?? []}
                teamFilter={calTeam}
                teamShifts={calTeamShifts}
                teamOptions={teamOptions}
              />
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2 border-t border-pitch-gray-dark pt-4">
            <span className="w-full text-xs font-semibold text-pitch-gray">
              Legenda turni
            </span>
            {SHIFT_TYPES.map((t) => (
              <ShiftChip key={t} type={t} />
            ))}
            <span className="ml-2 inline-flex items-center gap-1 text-xs text-pitch-gray">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Evento assegnato
            </span>
          </div>
        </div>
      ) : null}

      {tab === "turni" && showTurniTab ? (
        <div className="mt-6 space-y-4" ref={gridRef}>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded border border-pitch-gray-dark px-3 py-2 text-sm"
              onClick={() =>
                setTurniMonth(
                  new Date(
                    turniMonth.getFullYear(),
                    turniMonth.getMonth() - 1,
                    1
                  )
                )
              }
            >
              ←
            </button>
            <span className="font-semibold capitalize">
              {new Intl.DateTimeFormat("it-IT", {
                month: "long",
                year: "numeric",
              }).format(turniMonth)}
            </span>
            <button
              type="button"
              className="rounded border border-pitch-gray-dark px-3 py-2 text-sm"
              onClick={() =>
                setTurniMonth(
                  new Date(
                    turniMonth.getFullYear(),
                    turniMonth.getMonth() + 1,
                    1
                  )
                )
              }
            >
              →
            </button>
            <select
              value={turniTeam}
              onChange={(e) => setTurniTeam(e.target.value)}
              className="rounded border border-pitch-gray-dark bg-pitch-bg px-3 py-2"
            >
              <option value="">— Seleziona team —</option>
              {teamOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <PrimaryButton
              variant="secondary"
              type="button"
              disabled={turniSaving || !turniTeam.trim()}
              loading={turniSaving}
              onClick={() => void handleTurniSave()}
            >
              Salva
            </PrimaryButton>
            <PrimaryButton
              variant="ghost"
              type="button"
              disabled={!turniTeam.trim() || turniMembers.length === 0}
              onClick={handleCopyWeekForward}
            >
              Copia settimana →
            </PrimaryButton>
          </div>

          {!turniTeam.trim() ? (
            <p className="text-sm text-pitch-gray">
              Seleziona un team per modificare i turni.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-max border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 min-w-[140px] bg-pitch-bg px-2 py-2 text-left">
                      Nome
                    </th>
                    {turniCells.map((cell) => {
                      const d0 = new Date(`${cell.isoDate}T12:00:00`);
                      const dow = ["L", "M", "M", "G", "V", "S", "D"][
                        (d0.getDay() + 6) % 7
                      ];
                      const monStart = (d0.getDay() + 6) % 7 === 0;
                      return (
                        <th
                          key={cell.isoDate}
                          className={`min-w-[52px] px-1 py-2 text-center font-semibold ${
                            monStart ? "border-l-4 border-l-pitch-accent" : ""
                          } ${cell.inCurrentMonth ? "" : "opacity-40"} ${
                            cell.isoDate === todayIso
                              ? "ring-1 ring-[#FFFA00]"
                              : ""
                          }`}
                        >
                          <div>{dow}</div>
                          <div>{cell.day}</div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {turniMembers.map((mem) => (
                    <tr key={mem.id} className="border-t border-pitch-gray-dark">
                      <td className="sticky left-0 z-10 bg-pitch-bg px-2 py-2 font-medium text-pitch-white">
                        {mem.surname} {mem.name}
                      </td>
                      {turniCells.map((cell) => {
                        const d0 = new Date(`${cell.isoDate}T12:00:00`);
                        const editable = canEditTurniCell(turniTeam);
                        const st = shiftForStaffDate(mem.id, cell.isoDate);
                        const monStart = (d0.getDay() + 6) % 7 === 0;
                        return (
                          <td
                            key={cell.isoDate}
                            className={`relative px-0.5 py-1 text-center ${monStart ? "border-l-4 border-l-pitch-accent/40" : ""}`}
                          >
                            <button
                              type="button"
                              disabled={!editable}
                              onClick={(ev) =>
                                editable &&
                                setPopover({
                                  staffId: mem.id,
                                  date: cell.isoDate,
                                  x: ev.clientX,
                                  y: ev.clientY,
                                })
                              }
                              className={`min-h-[36px] w-full rounded p-1 ${
                                editable ? "cursor-pointer hover:bg-white/5" : ""
                              }`}
                            >
                              {st ? (
                                <ShiftChip type={st} className="!text-[10px]" />
                              ) : (
                                <span className="text-pitch-gray">—</span>
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {popover ? (
            <div
              className="fixed z-50 rounded-lg border border-pitch-gray-dark bg-[#1a1a1a] p-2 shadow-xl"
              style={{
                left: Math.min(popover.x, typeof window !== "undefined" ? window.innerWidth - 220 : 0),
                top: Math.min(popover.y, typeof window !== "undefined" ? window.innerHeight - 280 : 0),
              }}
            >
              <div className="mb-2 grid grid-cols-3 gap-1">
                {SHIFT_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className="rounded px-2 py-1 text-xs font-semibold"
                    style={{
                      background: SHIFT_CHIP_CLASS[t].bg,
                      color: SHIFT_CHIP_CLASS[t].text,
                    }}
                    onClick={() => {
                      const k = `${popover.staffId}-${popover.date}`;
                      setTurniPending((prev) => ({
                        ...prev,
                        [k]: t,
                      }));
                      setPopover(null);
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mt-1 w-full rounded border border-red-500/40 py-1 text-xs text-red-400"
                onClick={() => {
                  const k = `${popover.staffId}-${popover.date}`;
                  setTurniPending((prev) => ({
                    ...prev,
                    [k]: null,
                  }));
                  setPopover(null);
                }}
              >
                — Rimuovi
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-4">
            {SHIFT_TYPES.map((t) => (
              <ShiftChip key={`leg-${t}`} type={t} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

function CalDayPanel({
  iso,
  assignments,
  teamFilter,
  teamShifts,
  teamOptions,
}: {
  iso: string;
  assignments: MyAssignmentStaffItem[];
  teamShifts: Awaited<ReturnType<typeof fetchShiftsByRange>>;
  teamFilter: string;
  teamOptions: string[];
}) {
  const byStaffShift = useMemo(() => {
    const m = new Map<number, ShiftType>();
    for (const s of teamShifts) {
      if (s.date === iso) m.set(s.staffId, s.shiftType);
    }
    return m;
  }, [teamShifts, iso]);

  return (
    <div className="space-y-6 text-sm">
      {assignments.length > 0 ? (
        <div>
          <h4 className="mb-2 font-bold text-pitch-accent">Le tue assegnazioni</h4>
          <ul className="space-y-2">
            {assignments.map((row) => (
              <li
                key={row.assignment.id}
                className="rounded border border-pitch-gray-dark p-3"
              >
                <div className="font-semibold text-pitch-white">
                  {row.event.home_team_name_short &&
                  row.event.away_team_name_short
                    ? `${row.event.home_team_name_short} vs ${row.event.away_team_name_short}`
                    : row.event.show_name ?? row.event.competition_name}
                </div>
                <div className="text-pitch-gray-light">
                  {row.assignment.role_code} ·{" "}
                  {formatKoItaly(row.event.ko_italy)}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h4 className="mb-2 font-bold text-pitch-white">Colleghi</h4>
        {teamFilter === "__tutti__" ? (
          teamOptions.map((team) => (
            <TeamColleaguesBlock
              key={team}
              team={team}
              shiftMap={byStaffShift}
            />
          ))
        ) : (
          <TeamColleaguesBlock
            team={teamFilter}
            shiftMap={byStaffShift}
          />
        )}
      </div>
    </div>
  );
}

function TeamColleaguesBlock({
  team,
  shiftMap,
}: {
  team: string;
  shiftMap: Map<number, ShiftType>;
}) {
  const [members, setMembers] = useState<
    Awaited<ReturnType<typeof fetchTeamMembers>>
  >([]);
  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const m = await fetchTeamMembers(team);
        if (!c) setMembers(m);
      } catch {
        if (!c) setMembers([]);
      }
    })();
    return () => {
      c = true;
    };
  }, [team]);

  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-bold uppercase text-pitch-gray">
        {team}
      </div>
      <ul className="space-y-2">
        {members.map((mem) => {
          const st = shiftMap.get(mem.id);
          return (
            <li
              key={mem.id}
              className="flex items-center justify-between gap-2 rounded bg-pitch-gray-dark/30 px-2 py-2"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pitch-accent text-xs font-bold text-pitch-bg">
                  {initials(mem.name, mem.surname)}
                </span>
                <span>
                  {mem.surname} {mem.name}
                </span>
              </span>
              {st ? <ShiftChip type={st} /> : <span className="text-pitch-gray">—</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
