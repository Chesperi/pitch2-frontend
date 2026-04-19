"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SearchBar } from "@/components/SearchBar";
import { apiFetch } from "@/lib/api/apiFetch";
import { useDashboardNavbarCenter } from "@/components/DashboardNavbarCenter";
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
import PageLoading from "@/components/ui/PageLoading";
import EmptyState from "@/components/ui/EmptyState";
import PrimaryButton from "@/components/ui/PrimaryButton";
import type { ShiftType } from "@/lib/api/shifts";
import { fetchLookupValues } from "@/lib/api/lookupValues";
import {
  deleteShiftApi,
  fetchMyShifts,
  fetchShiftsByRange,
  fetchTeamMembers,
  upsertShiftsBulk,
} from "@/lib/api/shifts";
import { SHIFT_TYPES, ShiftChip } from "./shiftUi";

/** Dark-grid palette for Shifts tab (distinct from global ShiftChip colors). */
const TURNI_GRID_SHIFT_STYLE: Record<
  ShiftType,
  { bg: string; text: string }
> = {
  PD: { bg: "#1a2a3a", text: "#60a5fa" },
  PS: { bg: "#0f1f3a", text: "#3b82f6" },
  S: { bg: "#1a2e1a", text: "#4ade80" },
  O: { bg: "#1e1e1e", text: "#6b7280" },
  RE: { bg: "#1a2e25", text: "#34d399" },
  F: { bg: "#2e2310", text: "#fbbf24" },
  R: { bg: "#2e1a2e", text: "#e879f9" },
  M: { bg: "#2e1a1a", text: "#f87171" },
  RT: { bg: "#2a1f1a", text: "#fb923c" },
  T: { bg: "#1e1a2e", text: "#a78bfa" },
};

/** Monday-first row; letters per mockup (L … D). */
const TURNI_DOW_LETTERS = ["L", "M", "M", "G", "V", "S", "D"] as const;

type ColleagueSlot = {
  id: number;
  staffName: string;
  roleCode: string;
  roleLocation: string;
};

function formatKoItaly(koItaly: string | null): string {
  if (!koItaly) return "—";
  try {
    const date = new Date(koItaly);
    return new Intl.DateTimeFormat("en-GB", {
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

function eventTitleFromRow(row: MyAssignmentStaffItem): string {
  const { event } = row;
  if (event.home_team_name_short && event.away_team_name_short) {
    return `${event.home_team_name_short} vs ${event.away_team_name_short}`;
  }
  return (
    event.show_name ??
    event.competition_name ??
    "—"
  );
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
  switch (status.toUpperCase()) {
    case "CONFIRMED":
      return { variant: "accepted", label: "Confirmed" };
    case "REJECTED":
      return { variant: "declined", label: "Declined" };
    default:
      return { variant: "pending", label: "Pending confirmation" };
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

async function fetchAssignmentColleagues(
  eventId: string
): Promise<ColleagueSlot[]> {
  const res = await apiFetch(
    `/api/assignments?eventId=${encodeURIComponent(eventId)}`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: Record<string, unknown>[] };
  const rows = Array.isArray(data.items) ? data.items : [];
  return rows.map((r) => ({
    id: Number(r.id ?? 0),
    staffName:
      `${String(r.staffName ?? "").trim()} ${String(
        r.staffSurname ?? ""
      ).trim()}`.trim() || "Unassigned slot",
    roleCode: String(r.roleCode ?? "—"),
    roleLocation: String(r.roleLocation ?? "—").toUpperCase(),
  }));
}

function groupColleaguesByLocation(items: ColleagueSlot[]) {
  const groups: Record<"STADIO" | "COLOGNO" | "REMOTE", ColleagueSlot[]> = {
    STADIO: [],
    COLOGNO: [],
    REMOTE: [],
  };
  for (const c of items) {
    const key = c.roleLocation.includes("STADIO")
      ? "STADIO"
      : c.roleLocation.includes("COLOGNO")
        ? "COLOGNO"
        : "REMOTE";
    groups[key].push(c);
  }
  return groups;
}

function ColleaguesGrouped({ items }: { items: ColleagueSlot[] }) {
  const groupedColleagues = useMemo(() => groupColleaguesByLocation(items), [items]);

  if (items.length === 0) {
    return (
      <p className="text-sm" style={{ color: "#888" }}>
        No other colleagues assigned.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {(["STADIO", "COLOGNO", "REMOTE"] as const).map((group) => (
        <div key={group}>
          <div className="mb-2 text-xs font-bold uppercase" style={{ color: "#FFFA00" }}>
            {group}
          </div>
          <div className="space-y-2">
            {groupedColleagues[group].length === 0 ? (
              <p className="text-xs" style={{ color: "#666" }}>
                None
              </p>
            ) : (
              groupedColleagues[group].map((c) => (
                <div
                  key={`${group}-${c.id}-${c.roleCode}`}
                  className="rounded border p-2"
                  style={{ borderColor: "#2a2a2a", background: "#1a1a1a" }}
                >
                  <div className="text-sm font-bold text-white">{c.staffName}</div>
                  <div className="text-xs" style={{ color: "#888" }}>
                    {c.roleCode} - {c.roleLocation}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

type TabId = "lista" | "calendario" | "turni";

export default function LeMieAssegnazioniPage() {
  const router = useRouter();
  const { setCenter } = useDashboardNavbarCenter();
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
  const [showPast, setShowPast] = useState(false);

  const [crewListModal, setCrewListModal] = useState<{
    title: string;
    eventId: string;
  } | null>(null);
  const [crewListLoading, setCrewListLoading] = useState(false);
  const [crewListItems, setCrewListItems] = useState<ColleagueSlot[]>([]);

  const [weeklyShifts, setWeeklyShifts] = useState<
    Awaited<ReturnType<typeof fetchMyShifts>>
  >([]);

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calTeam, setCalTeam] = useState<string>("__tutti__");
  const [teamLookupSorted, setTeamLookupSorted] = useState<string[]>([]);
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

  const levelUpper = profile?.user_level?.toUpperCase() ?? "";
  const showTurniTab =
    levelUpper === "MASTER" || !!profile?.shifts_management;

  const navbarCenter = useMemo(
    () => (
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setTab("lista")}
          className="text-xs font-bold tracking-wide"
          style={{ color: tab === "lista" ? "#FFFA00" : "#888" }}
        >
          MY ASSIGNMENTS
        </button>
        <button
          type="button"
          onClick={() => setTab("calendario")}
          className="text-xs font-bold tracking-wide"
          style={{ color: tab === "calendario" ? "#FFFA00" : "#888" }}
        >
          CALENDAR
        </button>
        {showTurniTab ? (
          <button
            type="button"
            onClick={() => setTab("turni")}
            className="text-xs font-bold tracking-wide"
            style={{ color: tab === "turni" ? "#FFFA00" : "#888" }}
          >
            SHIFTS
          </button>
        ) : null}
      </div>
    ),
    [tab, showTurniTab]
  );

  useEffect(() => {
    setCenter(navbarCenter);
    return () => setCenter(null);
  }, [navbarCenter, setCenter]);

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
      setError("Could not load assignments.");
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
        const rows = await fetchLookupValues("team_dazn");
        if (!c) {
          const vals = [...rows]
            .filter((v) => v.category === "team_dazn")
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((v) => v.value);
          setTeamLookupSorted(vals);
        }
      } catch {
        if (!c) setTeamLookupSorted([]);
      }
    })();
    return () => {
      c = true;
    };
  }, []);

  const teamOptions = useMemo(() => {
    const base = teamLookupSorted;
    const seen = new Set(base);
    const extra: string[] = [];
    const pushExtra = (raw: string | null | undefined) => {
      const t = raw?.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        extra.push(t);
      }
    };
    pushExtra(profile?.team_dazn ?? null);
    if (calTeam !== "__tutti__") pushExtra(calTeam);
    pushExtra(turniTeam);
    extra.sort((a, b) => a.localeCompare(b, "en"));
    return [...base, ...extra];
  }, [teamLookupSorted, profile?.team_dazn, calTeam, turniTeam]);

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
      alert(e instanceof Error ? e.message : "Save failed");
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

  const { azione, confermate, declinate, passate } = useMemo(() => {
    const az: MyAssignmentStaffItem[] = [];
    const cf: MyAssignmentStaffItem[] = [];
    const dc: MyAssignmentStaffItem[] = [];
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
      } else if (st === "REJECTED") {
        dc.push(row);
      } else {
        pa.push(row);
      }
    }
    return {
      azione: az,
      confermate: cf,
      declinate: dc,
      passate: pa,
    };
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
      alert(e instanceof Error ? e.message : "Confirm failed");
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
      alert(e instanceof Error ? e.message : "Decline failed");
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
      alert(e instanceof Error ? e.message : "Bulk confirm failed");
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

  async function openListCrewModal(row: MyAssignmentStaffItem) {
    const eventId = row.assignment.event_id;
    setCrewListModal({
      title: eventTitleFromRow(row),
      eventId,
    });
    setCrewListLoading(true);
    setCrewListItems([]);
    try {
      const list = await fetchAssignmentColleagues(eventId);
      setCrewListItems(list);
    } catch {
      setCrewListItems([]);
    } finally {
      setCrewListLoading(false);
    }
  }

  function renderStaffCard(row: MyAssignmentStaffItem) {
    if (!row || !row.assignment || !row.event) return null;
    const { assignment, event } = row;
    const match = eventTitleFromRow(row);
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
      <div
        key={assignment.id}
        role="button"
        tabIndex={0}
        onClick={() => void openListCrewModal(row)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void openListCrewModal(row);
          }
        }}
        className="w-full cursor-pointer rounded-xl border p-4 text-left"
        style={{
          background: "#1a1a1a",
          borderColor: "#2a2a2a",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="text-[10px] font-bold uppercase tracking-[2px]"
              style={{ color: "#FFFA00" }}
            >
              {event.competition_name || "EVENT"}
            </div>
            <h3
              className="mt-1 text-[20px] uppercase leading-tight"
              style={{ color: "#fff", fontWeight: 900 }}
            >
              {match}
            </h3>
          </div>
          <StatusBadge {...assignmentStatusBadgeProps(assignment.status)} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            {
              label: "KO DATE",
              value: formatKoItaly(event.ko_italy),
            },
            { label: "ROLE", value: assignment.role_code || "—" },
            { label: "VENUE", value: luogo },
            {
              label: "STATUS",
              value: assignmentStatusBadgeProps(assignment.status).label,
            },
          ].map((box) => (
            <div key={box.label}>
              <div
                className="text-[10px] uppercase"
                style={{ color: "#555", letterSpacing: "1px" }}
              >
                {box.label}
              </div>
              <div className="text-[13px]" style={{ color: "#ccc" }}>
                {box.value}
              </div>
            </div>
          ))}
          {showFinance ? (
            <div>
              <div
                className="text-[10px] uppercase"
                style={{ color: "#555", letterSpacing: "1px" }}
              >
                FEE
              </div>
              <div className="text-[13px]" style={{ color: "#ccc" }}>
                {assignment.fee ?? "—"}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3"
          style={{ borderColor: "#2a2a2a" }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          {isSent ? (
            <div className="inline-flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleConfirm(row);
                }}
                disabled={isActioning}
                className="inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded px-4 font-bold"
                style={{ color: "#FFFA00" }}
              >
                CONFIRM
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs"
                  style={{ background: "#FFFA00", color: "#111" }}
                >
                  ✓
                </span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleReject(row);
                }}
                disabled={isActioning}
                className="min-h-[44px] shrink-0 rounded px-4 text-xs font-bold"
                style={{ color: "#E24B4A" }}
              >
                DECLINE
              </button>
            </div>
          ) : null}

          <div className="ml-auto flex flex-wrap items-center gap-2">
            {!canHaveCarPass ? (
              <span className="text-pitch-gray">—</span>
            ) : plates.length === 0 ? (
              <span className="text-pitch-gray">—</span>
            ) : plates.length === 1 ? (
              <div className="flex items-center gap-2 text-xs text-[#888]">
                <span>CAR PASS</span>
                <span className="text-sm text-pitch-gray-light">{plates[0]}</span>
                <label className="flex items-center gap-1.5 text-sm text-pitch-gray-light">
                  <input
                    type="checkbox"
                    checked={!!carPass[assignment.id]}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleCarPass(assignment.id);
                    }}
                    className="rounded border-pitch-gray-dark bg-pitch-gray-dark text-pitch-accent focus:ring-pitch-accent"
                  />
                  Use plate
                </label>
              </div>
            ) : (
              <label className="flex items-center gap-2 text-xs text-[#888]">
                CAR PASS
                <select
                  defaultValue={plates[0]}
                  className="rounded-md border px-2 py-1 text-xs"
                  style={{
                    background: "#0a0a0a",
                    borderColor: "#2a2a2a",
                    color: "#fff",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {plates.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderAssignmentCardGrid(rows: MyAssignmentStaffItem[]) {
    if (rows.length === 0)
      return (
        <p className="text-sm" style={{ color: "#888" }}>
          No assignments in this section.
        </p>
      );
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => renderStaffCard(row))}
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <div className="mt-4">
          <SearchBar placeholder="Search competition, teams, show…" />
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
        <div className="mt-6 rounded-lg border border-yellow-900/50 bg-yellow-900/20 p-6 text-yellow-300">
          {blockedMessage}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="mt-4">
          <SearchBar placeholder="Search competition, teams, show…" />
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
      <div className="mx-auto max-w-7xl">
        <h1
          className="text-[28px] uppercase"
          style={{ color: "#fff", fontWeight: 900 }}
        >
          MY ASSIGNMENTS
        </h1>
        <p className="mt-1 text-sm" style={{ color: "#888" }}>
          Operational assignments for{" "}
          <span style={{ color: "#FFFA00" }}>
            {profile
              ? `${profile.name ?? ""} ${profile.surname ?? ""}`.trim()
              : "—"}
          </span>
        </p>

        {tab === "lista" ? (
          <div className="mt-6 space-y-6">
            <div className="mt-4">
              <SearchBar
                placeholder="Search competition, teams, show…"
                onSearchChange={setSearch}
              />
            </div>

            {sentAssignments.length > 0 ? (
              <div className="mt-4">
                <PrimaryButton
                  variant="primary"
                  type="button"
                  onClick={handleConfirmAll}
                  disabled={confirmingAll}
                  loading={confirmingAll}
                  className="text-xs font-bold uppercase"
                >
                  Confirm all
                </PrimaryButton>
              </div>
            ) : null}

            <section
              className="rounded-xl border p-4"
              style={{
                background: "#111",
                borderColor: "#2a2a2a",
                borderLeft: "4px solid #FFFA00",
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase text-white">
                  ACTION REQUIRED
                </h2>
                <span
                  className="rounded-full px-2 py-1 text-xs font-bold"
                  style={{ background: "#FFFA00", color: "#111" }}
                >
                  {azione.length}
                </span>
              </div>
              {azione.length === 0 ? (
                <p className="text-sm" style={{ color: "#888" }}>
                  No assignments pending confirmation.
                </p>
              ) : (
                renderAssignmentCardGrid(azione)
              )}
            </section>

            <section
              className="rounded-xl border p-4"
              style={{
                background: "#111",
                borderColor: "#2a2a2a",
                borderLeft: "4px solid #639922",
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase text-white">
                  CONFIRMED
                </h2>
                <span className="rounded-full bg-[#2a2a2a] px-2 py-1 text-xs font-bold text-[#ccc]">
                  {confermate.length}
                </span>
              </div>
              {confermate.length === 0 ? (
                <p className="text-sm" style={{ color: "#888" }}>
                  No upcoming confirmed assignments.
                </p>
              ) : (
                renderAssignmentCardGrid(confermate)
              )}
            </section>

            <section
              className="rounded-xl border p-4"
              style={{
                background: "#111",
                borderColor: "#2a2a2a",
                borderLeft: "4px solid #E24B4A",
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase text-white">
                  DECLINED
                </h2>
                <span className="rounded-full bg-[#2a2a2a] px-2 py-1 text-xs font-bold text-[#ccc]">
                  {declinate.length}
                </span>
              </div>
              {declinate.length === 0 ? (
                <p className="text-sm" style={{ color: "#888" }}>
                  No upcoming declined assignments.
                </p>
              ) : (
                renderAssignmentCardGrid(declinate)
              )}
            </section>

            <section className="rounded-xl border p-4" style={{ background: "#111", borderColor: "#2a2a2a" }}>
              <button
                type="button"
                onClick={() => setShowPast((s) => !s)}
                className="flex w-full items-center justify-between gap-2 text-left"
              >
                <span className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: "#888" }} aria-hidden>
                    {showPast ? "▼" : "▶"}
                  </span>
                  <h2 className="text-sm font-bold uppercase text-white">
                    PAST ({passate.length})
                  </h2>
                </span>
              </button>
              {showPast ? (
                <div className="mt-3">
                  {renderAssignmentCardGrid(passate)}
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border p-4" style={{ background: "#111", borderColor: "#2a2a2a" }}>
              <h2 className="mb-3 text-base font-bold text-pitch-white">
                CURRENT WEEK SHIFTS
              </h2>
              <div className="flex flex-wrap gap-2">
                {weekDaysIso.map((iso) => {
                  const d = new Date(`${iso}T12:00:00`);
                  const label = new Intl.DateTimeFormat("en-US", {
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
                <EmptyState message="No assignments" icon="calendar" />
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "calendario" ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-xl border p-4" style={{ background: "#111", borderColor: "#2a2a2a" }}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded border border-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                    style={{ color: "#FFFA00" }}
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
                    {calendarMonth.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <button
                    type="button"
                    className="rounded border border-pitch-gray-dark px-3 py-2 text-sm text-pitch-white"
                    style={{ color: "#FFFA00" }}
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
                    <option value="__tutti__">All</option>
                    {teamOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-pitch-gray">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {calCells.map((cell, idx) => {
                  const st = myShiftByDate.get(cell.isoDate);
                  const hasEv =
                    (assignmentsByDay.get(cell.isoDate) ?? []).length > 0;
                  const isToday = cell.isoDate === todayIso;
                  return (
                    <button
                      key={`${cell.isoDate}-${idx}`}
                      type="button"
                      onClick={() => setCalPanelDay(cell.isoDate)}
                      className={`flex min-h-[72px] flex-col items-start gap-1 rounded border p-1 text-left transition-colors ${
                        cell.inCurrentMonth ? "opacity-100" : "opacity-40"
                      } ${isToday ? "ring-2 ring-[#FFFA00]" : "border-pitch-gray-dark"}`}
                      style={
                        !isToday ? { borderColor: "#2a2a2a" } : undefined
                      }
                    >
                      <span className="text-sm font-bold text-pitch-white">
                        {cell.day}
                      </span>
                      {st ? (
                        <ShiftChip type={st} className="!text-[10px]" />
                      ) : null}
                      {hasEv ? (
                        <span
                          className="mt-auto h-2 w-2 rounded-full bg-green-500"
                          title="Assigned event"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {calPanelDay ? (
              <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md overflow-y-auto border-l border-pitch-gray-dark bg-pitch-bg p-4 shadow-xl md:max-w-lg">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold text-pitch-white">
                    {new Intl.DateTimeFormat("en-US", {
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
                Shift legend
              </span>
              {SHIFT_TYPES.map((t) => (
                <ShiftChip key={t} type={t} />
              ))}
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-pitch-gray">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Assigned event
              </span>
            </div>
          </div>
        ) : null}

        {tab === "turni" && showTurniTab ? (
          <div className="mt-6 space-y-4" ref={gridRef}>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                aria-label="Previous month"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#333] text-sm text-white transition-colors hover:border-[#FFFA00]"
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
              <span className="min-w-[10rem] text-center font-semibold capitalize text-white">
                {turniMonth.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <button
                type="button"
                aria-label="Next month"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#333] text-sm text-white transition-colors hover:border-[#FFFA00]"
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
                className="rounded-lg border border-[#333] bg-[#1a1a1a] px-3 py-1.5 text-sm text-white focus:border-[#FFFA00] focus:outline-none"
              >
                <option value="">— Select team —</option>
                {teamOptions.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={turniSaving || !turniTeam.trim()}
                onClick={() => void handleTurniSave()}
                className="rounded-lg bg-[#FFFA00] px-4 py-1.5 font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                {turniSaving ? "…" : "Save"}
              </button>
              <button
                type="button"
                disabled={!turniTeam.trim() || turniMembers.length === 0}
                onClick={handleCopyWeekForward}
                className="rounded-lg border border-[#333] px-4 py-1.5 text-white transition-colors hover:border-[#FFFA00] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Copy week →
              </button>
            </div>

            {!turniTeam.trim() ? (
              <p className="text-sm text-gray-500">
                Select a team to edit shifts.
              </p>
            ) : (
              <div
                className="rounded-2xl border bg-[#111] p-5"
                style={{ borderColor: "#2a2a2a", borderWidth: 1 }}
              >
                <div className="overflow-x-auto">
                  <table className="min-w-max border-collapse">
                    <thead>
                      <tr>
                        <th
                          className="sticky left-0 z-20 min-w-[140px] bg-[#111] px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-400"
                        >
                          Name
                        </th>
                        {turniCells.map((cell) => {
                          const d0 = new Date(`${cell.isoDate}T12:00:00`);
                          const dowIdx = (d0.getDay() + 6) % 7;
                          const dowLetter = TURNI_DOW_LETTERS[dowIdx];
                          const weekStart = dowIdx === 0;
                          const outMonth = !cell.inCurrentMonth;
                          const isToday = cell.isoDate === todayIso;
                          return (
                            <th
                              key={cell.isoDate}
                              className={`w-9 shrink-0 px-0 py-2 text-center ${
                                weekStart ? "border-l-2 border-[#FFFA00]" : ""
                              } ${outMonth ? "opacity-30" : ""}`}
                            >
                              <div className="text-xs text-gray-500">
                                {dowLetter}
                              </div>
                              <div className="mt-0.5 flex justify-center">
                                {isToday ? (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FFFA00] text-xs font-semibold text-black">
                                    {cell.day}
                                  </span>
                                ) : (
                                  <span className="text-xs font-semibold text-white">
                                    {cell.day}
                                  </span>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {turniMembers.map((mem, rowIdx) => {
                        const rowBg = rowIdx % 2 === 0 ? "#111" : "#141414";
                        return (
                          <tr
                            key={mem.id}
                            className="h-11"
                            style={{
                              height: 44,
                              borderBottom: "1px solid #1e1e1e",
                              backgroundColor: rowBg,
                            }}
                          >
                            <td
                              className="sticky left-0 z-10 px-2 py-0 text-sm font-medium text-white"
                              style={{
                                backgroundColor: rowBg,
                                minWidth: 140,
                              }}
                            >
                              {mem.surname} {mem.name}
                            </td>
                            {turniCells.map((cell) => {
                              const d0 = new Date(`${cell.isoDate}T12:00:00`);
                              const editable = canEditTurniCell(turniTeam);
                              const st = shiftForStaffDate(mem.id, cell.isoDate);
                              const weekStart = (d0.getDay() + 6) % 7 === 0;
                              const css = st ? TURNI_GRID_SHIFT_STYLE[st] : null;
                              return (
                                <td
                                  key={cell.isoDate}
                                  className={`relative w-9 px-0 py-1 text-center align-middle ${
                                    weekStart ? "border-l-2 border-[#FFFA00]" : ""
                                  }`}
                                  style={{ backgroundColor: rowBg }}
                                >
                                  <div className="flex h-11 items-center justify-center">
                                    {!st ? (
                                      editable ? (
                                        <button
                                          type="button"
                                          aria-label="Set shift"
                                          onClick={(ev) =>
                                            setPopover({
                                              staffId: mem.id,
                                              date: cell.isoDate,
                                              x: ev.clientX,
                                              y: ev.clientY,
                                            })
                                          }
                                          className="box-border h-[28px] w-[28px] shrink-0 cursor-pointer rounded-[6px] border border-dashed border-[#333] transition-colors hover:border-[#FFFA00]"
                                        />
                                      ) : (
                                        <span className="text-xs text-gray-600">
                                          —
                                        </span>
                                      )
                                    ) : (
                                      <button
                                        type="button"
                                        aria-label={`Shift ${st}`}
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
                                        className={`box-border flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-[6px] border border-transparent text-[10px] font-bold leading-none ${
                                          editable
                                            ? "cursor-pointer hover:ring-1 hover:ring-[#FFFA00]"
                                            : "cursor-default"
                                        }`}
                                        style={{
                                          background: css?.bg,
                                          color: css?.text,
                                        }}
                                      >
                                        {st}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 border-t border-[#1e1e1e] pt-5">
                  <p className="mb-3 text-xs uppercase tracking-wide text-gray-500">
                    Shift legend
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SHIFT_TYPES.map((t) => {
                      const cs = TURNI_GRID_SHIFT_STYLE[t];
                      return (
                        <span
                          key={`leg-${t}`}
                          className="inline-flex h-[28px] min-w-[28px] items-center justify-center rounded-[6px] px-1 text-[10px] font-bold"
                          style={{ background: cs.bg, color: cs.text }}
                        >
                          {t}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {popover ? (
              <div
                className="fixed z-50 w-[220px] rounded-[10px] border border-[#333] bg-[#1a1a1a] p-[10px] shadow-xl"
                style={{
                  left: Math.min(
                    popover.x,
                    typeof window !== "undefined"
                      ? window.innerWidth - 240
                      : 0
                  ),
                  top: Math.min(
                    popover.y,
                    typeof window !== "undefined"
                      ? window.innerHeight - 240
                      : 0
                  ),
                }}
              >
                <div className="grid grid-cols-5 gap-1">
                  {SHIFT_TYPES.map((t) => {
                    const st = TURNI_GRID_SHIFT_STYLE[t];
                    return (
                      <button
                        key={t}
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-[6px] text-[10px] font-bold leading-none transition-transform hover:scale-105"
                        style={{
                          background: st.bg,
                          color: st.text,
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
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="mt-2 w-full rounded-lg border border-[#333] py-2 text-sm text-gray-400 transition-colors hover:border-[#555] hover:text-gray-300"
                  onClick={() => {
                    const k = `${popover.staffId}-${popover.date}`;
                    setTurniPending((prev) => ({
                      ...prev,
                      [k]: null,
                    }));
                    setPopover(null);
                  }}
                >
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {crewListModal ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.65)" }}
            onClick={() => setCrewListModal(null)}
            aria-label="Close"
          />
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-[400px] border-l p-4"
            style={{
              background: "#111",
              borderColor: "#2a2a2a",
              overflowY: "auto",
              maxHeight: "100vh",
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-bold text-white">{crewListModal.title}</h3>
              <button
                type="button"
                onClick={() => setCrewListModal(null)}
                className="text-sm"
                style={{ color: "#FFFA00" }}
              >
                Close
              </button>
            </div>
            <div className="mt-4">
              {crewListLoading ? (
                <p style={{ color: "#888" }}>Loading colleagues…</p>
              ) : (
                <ColleaguesGrouped items={crewListItems} />
              )}
            </div>
          </aside>
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
  const [crewMode, setCrewMode] = useState<{
    eventId: string;
    title: string;
  } | null>(null);
  const [crewLoading, setCrewLoading] = useState(false);
  const [crewItems, setCrewItems] = useState<ColleagueSlot[]>([]);

  useEffect(() => {
    setCrewMode(null);
    setCrewItems([]);
  }, [iso]);

  const byStaffShift = useMemo(() => {
    const m = new Map<number, ShiftType>();
    for (const s of teamShifts) {
      if (s.date === iso) m.set(s.staffId, s.shiftType);
    }
    return m;
  }, [teamShifts, iso]);

  async function openCrew(row: MyAssignmentStaffItem) {
    const eventId = row.assignment.event_id;
    setCrewMode({ eventId, title: eventTitleFromRow(row) });
    setCrewLoading(true);
    try {
      const list = await fetchAssignmentColleagues(eventId);
      setCrewItems(list);
    } catch {
      setCrewItems([]);
    } finally {
      setCrewLoading(false);
    }
  }

  if (crewMode) {
    return (
      <div className="space-y-4 text-sm">
        <button
          type="button"
          onClick={() => setCrewMode(null)}
          className="text-xs font-bold"
          style={{ color: "#FFFA00" }}
        >
          ← Back
        </button>
        <h4 className="font-bold text-white">{crewMode.title}</h4>
        {crewLoading ? (
          <p style={{ color: "#888" }}>Loading colleagues…</p>
        ) : (
          <ColleaguesGrouped items={crewItems} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-sm">
      {assignments.length > 0 ? (
        <div>
          <h4 className="mb-2 font-bold text-pitch-accent">YOUR ASSIGNMENTS</h4>
          <ul className="space-y-2">
            {assignments.map((row) => (
              <li key={row.assignment.id}>
                <button
                  type="button"
                  onClick={() => void openCrew(row)}
                  className="w-full rounded border border-pitch-gray-dark p-3 text-left transition-colors hover:bg-white/5"
                  style={{ background: "#111" }}
                >
                  <div className="font-semibold text-pitch-white">
                    {eventTitleFromRow(row)}
                  </div>
                  <div className="text-pitch-gray-light">
                    {row.assignment.role_code} ·{" "}
                    {formatKoItaly(row.event.ko_italy)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h4 className="mb-2 font-bold text-pitch-white">COLLEAGUES</h4>
        {teamFilter === "__tutti__" ? (
          teamOptions.map((team) => (
            <TeamColleaguesBlock
              key={team}
              team={team}
              shiftMap={byStaffShift}
            />
          ))
        ) : (
          <TeamColleaguesBlock team={teamFilter} shiftMap={byStaffShift} />
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
              {st ? (
                <ShiftChip type={st} />
              ) : (
                <span className="text-pitch-gray">—</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
