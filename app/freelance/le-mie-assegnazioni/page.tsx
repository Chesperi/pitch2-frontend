"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/apiFetch";
import AppNavbar from "@/components/AppNavbar";
import StatusBadge from "@/components/ui/StatusBadge";
import PrimaryButton from "@/components/ui/PrimaryButton";

type UserProfile = {
  id: number | null;
  name: string;
  surname: string;
  email: string | null;
};

type AssignmentItem = {
  id: number;
  eventId: string;
  competitionName: string;
  showName: string | null;
  homeTeamNameShort: string | null;
  awayTeamNameShort: string | null;
  date: string | null;
  koTime: string | null;
  roleName: string;
  location: string | null;
  status: string;
  plateSelected: string | null;
};

type ColleagueItem = {
  id: number;
  staffName: string;
  roleCode: string;
  roleLocation: string;
};

type CalendarCell = {
  isoDate: string;
  day: number;
  inCurrentMonth: boolean;
};

function toIsoDate(date: Date): string {
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(rawDate: string | null): string {
  if (!rawDate) return "";
  const value = rawDate.trim();
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return toIsoDate(parsed);
  }

  return value;
}

function parseIsoDate(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeAssignments(raw: unknown): AssignmentItem[] {
  const list: Record<string, unknown>[] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : [];
  return list.map((row) => {
    const idRaw = row.assignmentId ?? row.id;
    const rawDate = row.date ?? row.event_date ?? null;
    let isoDate: string | null = null;
    if (rawDate != null && String(rawDate).trim() !== "") {
      const parsed = new Date(String(rawDate));
      if (!Number.isNaN(parsed.getTime())) {
        isoDate = parsed.toISOString().slice(0, 10);
      } else {
        isoDate = String(rawDate).slice(0, 10);
      }
    }
    return {
      id: Number(idRaw ?? 0),
      eventId: String(row.eventId ?? row.event_id ?? ""),
      competitionName: String(
        row.competition_name ?? row.competitionName ?? "EVENTO"
      ).trim(),
      showName:
        row.show_name != null && String(row.show_name).trim() !== ""
          ? String(row.show_name).trim()
          : null,
      homeTeamNameShort:
        (row.home_team_name_short != null &&
          String(row.home_team_name_short).trim() !== "") ||
        (row.home_team_name != null && String(row.home_team_name).trim() !== "")
          ? String(row.home_team_name_short ?? row.home_team_name).trim()
          : null,
      awayTeamNameShort:
        (row.away_team_name_short != null &&
          String(row.away_team_name_short).trim() !== "") ||
        (row.away_team_name != null && String(row.away_team_name).trim() !== "")
          ? String(row.away_team_name_short ?? row.away_team_name).trim()
          : null,
      date: isoDate,
      koTime:
        row.ko_time != null && String(row.ko_time).trim() !== ""
          ? String(row.ko_time).slice(0, 5)
          : null,
      roleName: String(row.role_name ?? row.roleName ?? "—").trim(),
      location:
        row.role_location != null && String(row.role_location).trim() !== ""
          ? String(row.role_location).trim()
          : row.location != null && String(row.location).trim() !== ""
            ? String(row.location).trim()
            : null,
      status: String(row.status ?? "").trim().toUpperCase(),
      plateSelected:
        row.plate_selected != null && String(row.plate_selected).trim() !== ""
          ? String(row.plate_selected).trim()
          : null,
    };
  });
}

function isPendingStatus(status: string): boolean {
  const s = status.toUpperCase();
  return s === "PENDING" || s === "SENT";
}

function isConfirmedStatus(status: string): boolean {
  return status.toUpperCase() === "CONFIRMED";
}

function isPastDate(isoDate: string | null, todayIso: string): boolean {
  if (!isoDate) return false;
  return isoDate < todayIso;
}

function isPastEventDateTime(
  isoDate: string | null,
  koTime: string | null,
  now: Date
): boolean {
  if (!isoDate) return false;
  const eventIso = koTime ? `${isoDate}T${koTime}` : `${isoDate}T23:59:59`;
  const eventDate = new Date(eventIso);
  if (Number.isNaN(eventDate.getTime())) {
    return isPastDate(isoDate, toIsoDate(now));
  }
  return eventDate.getTime() < now.getTime();
}

function eventTitle(item: AssignmentItem): string {
  const home = item.homeTeamNameShort?.trim() ?? "";
  const away = item.awayTeamNameShort?.trim() ?? "";
  if (home && away) return `${home} vs ${away}`;
  return (
    item.showName?.trim() ||
    item.competitionName?.trim() ||
    "Evento senza titolo"
  );
}

function formatDateKoWithYear(
  date: string | null,
  koTime: string | null
): string {
  if (!date) return "—";
  const iso = koTime ? `${date}T${koTime}` : `${date}T12:00:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return [date, koTime].filter(Boolean).join(", ") || "—";
  if (!koTime) {
    return new Intl.DateTimeFormat("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  }
  return new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

function formatDateTimeLabel(
  date: string | null,
  koTime: string | null
): string {
  if (!date) return "—";
  const iso = koTime ? `${date}T${koTime}` : `${date}T12:00:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return [date, koTime].filter(Boolean).join(", ") || "—";
  }
  const datePart = new Intl.DateTimeFormat("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
  const timePart = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${datePart}, ${timePart}`;
}

function statusBucketLabel(item: AssignmentItem): string {
  if (isPastEventDateTime(item.date, item.koTime, new Date())) return "PASSATA";
  const s = item.status.toUpperCase();
  if (s === "PENDING" || s === "SENT") return "DA CONFERMARE";
  if (s === "REJECTED" || s === "DECLINATA") return "DECLINATA";
  if (s === "CONFIRMED") return "CONFERMATA";
  return s || "—";
}

function buildMonthGrid(currentMonth: Date): CalendarCell[] {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const first = new Date(year, month, 1);
  const firstDayMondayIndex = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - firstDayMondayIndex);

  const cells: CalendarCell[] = [];
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

function getInitials(name: string, surname: string): string {
  const a = name.trim().charAt(0).toUpperCase();
  const b = surname.trim().charAt(0).toUpperCase();
  return `${a || "?"}${b || ""}`;
}

export default function FreelanceLeMieAssegnazioniPage() {
  const router = useRouter();
  const actionSectionRef = useRef<HTMLElement | null>(null);
  const [tab, setTab] = useState<"LISTA" | "CALENDARIO">("LISTA");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<AssignmentItem[]>([]);
  const [plates, setPlates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [savingPlateId, setSavingPlateId] = useState<number | null>(null);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const [highlightActionSection, setHighlightActionSection] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalCols, setModalCols] = useState<ColleagueItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(
    null
  );
  async function loadAll(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const [meRes, assignmentsRes, platesRes] = await Promise.all([
        apiFetch("/api/auth/me", { cache: "no-store" }),
        apiFetch("/api/my-assignments", { cache: "no-store" }),
        apiFetch("/api/my-assignments/car-plates", { cache: "no-store" }),
      ]);

      if (meRes.status === 401 || assignmentsRes.status === 401) {
        router.replace("/login");
        return;
      }

      if (!meRes.ok || !assignmentsRes.ok) {
        throw new Error("Impossibile caricare le assegnazioni.");
      }

      const meData = (await meRes.json()) as Record<string, unknown>;
      setProfile({
        id: meData.id != null ? Number(meData.id) : null,
        name: String(meData.name ?? ""),
        surname: String(meData.surname ?? ""),
        email:
          meData.email != null && String(meData.email).trim() !== ""
            ? String(meData.email)
            : null,
      });

      const assignmentsData = await assignmentsRes.json();
      const normalizedItems = normalizeAssignments(assignmentsData);
      console.log(
        "items[0].date raw:",
        normalizedItems[0]?.date,
        "items[0] full:",
        JSON.stringify(normalizedItems[0])
      );
      setItems(normalizedItems);

      if (platesRes.ok) {
        const platesData = (await platesRes.json()) as { plates?: unknown };
        const list = Array.isArray(platesData.plates)
          ? platesData.plates
              .map((p) => String(p).trim())
              .filter((p) => p.length > 0)
          : [];
        setPlates(list);
      } else {
        setPlates([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore imprevisto.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  const pendingCount = useMemo(
    () =>
      items.filter(
        (i) => isPendingStatus(i.status) && !isPastEventDateTime(i.date, i.koTime, new Date())
      ).length,
    [items]
  );

  const sections = useMemo(() => {
    const now = new Date();
    const pendingFuture = items
      .filter((i) => isPendingStatus(i.status) && !isPastEventDateTime(i.date, i.koTime, now))
      .sort((a, b) =>
        `${a.date ?? ""} ${a.koTime ?? ""}`.localeCompare(
          `${b.date ?? ""} ${b.koTime ?? ""}`
        )
      );
    const confirmedFuture = items
      .filter((i) => {
        if (isPastEventDateTime(i.date, i.koTime, now)) return false;
        return i.status.toUpperCase() === "CONFIRMED";
      })
      .sort((a, b) =>
        `${a.date ?? ""} ${a.koTime ?? ""}`.localeCompare(
          `${b.date ?? ""} ${b.koTime ?? ""}`
        )
      );
    const declinedFuture = items
      .filter((i) => {
        if (isPastEventDateTime(i.date, i.koTime, now)) return false;
        const s = i.status.toUpperCase();
        return s === "REJECTED" || s === "DECLINATA";
      })
      .sort((a, b) =>
        `${a.date ?? ""} ${a.koTime ?? ""}`.localeCompare(
          `${b.date ?? ""} ${b.koTime ?? ""}`
        )
      );
    const past = items
      .filter((i) => isPastEventDateTime(i.date, i.koTime, now))
      .sort((a, b) =>
        `${b.date ?? ""} ${b.koTime ?? ""}`.localeCompare(
          `${a.date ?? ""} ${a.koTime ?? ""}`
        )
      );
    return { pendingFuture, confirmedFuture, declinedFuture, past };
  }, [items]);

  const monthCells = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, AssignmentItem[]>();
    for (const item of items) {
      if (!item.date) continue;
      const key = normalizeDateKey(item.date);
      if (!key) continue;
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    console.log("eventsByDate keys:", Array.from(map.keys()));
    return map;
  }, [items]);

  useEffect(() => {
    console.log("monthCells sample:", monthCells[0]);
  }, [monthCells]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedCalendarDay) return [];
    return eventsByDate.get(selectedCalendarDay) ?? [];
  }, [eventsByDate, selectedCalendarDay]);

  async function handleConfirm(id: number): Promise<void> {
    setConfirmingId(id);
    try {
      const res = await apiFetch(`/api/my-assignments/${id}/confirm`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Conferma non riuscita");
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: "CONFIRMED" } : it))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore conferma");
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleDecline(id: number): Promise<void> {
    setConfirmingId(id);
    try {
      const res = await apiFetch(`/api/my-assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REJECTED" }),
      });
      if (!res.ok) throw new Error("Rifiuto non riuscito");
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: "REJECTED" } : it))
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore rifiuto");
    } finally {
      setConfirmingId(null);
    }
  }

  async function handleConfirmAll(): Promise<void> {
    if (sections.pendingFuture.length <= 1) return;
    setConfirmingAll(true);
    try {
      const res = await apiFetch("/api/my-assignments/confirm-all", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Conferma multipla non riuscita");
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore conferma multipla");
    } finally {
      setConfirmingAll(false);
    }
  }

  function handleBellClick(): void {
    setTab("LISTA");
    actionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightActionSection(true);
    window.setTimeout(() => setHighlightActionSection(false), 1200);
  }

  async function handlePlateChange(
    assignmentId: number,
    value: string
  ): Promise<void> {
    setSavingPlateId(assignmentId);
    try {
      const payload = { plate_selected: value || null };
      const res = await apiFetch(`/api/my-assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Salvataggio pass auto non riuscito");
      setItems((prev) =>
        prev.map((it) =>
          it.id === assignmentId
            ? { ...it, plateSelected: value || null }
            : it
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Errore salvataggio pass auto");
    } finally {
      setSavingPlateId(null);
    }
  }

  async function openColleaguesModal(item: AssignmentItem): Promise<void> {
    setModalTitle(eventTitle(item));
    setModalOpen(true);
    setModalLoading(true);
    setModalCols([]);
    try {
      const res = await apiFetch(
        `/api/assignments?eventId=${encodeURIComponent(item.eventId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Impossibile caricare i colleghi");
      const data = (await res.json()) as {
        items?: Record<string, unknown>[];
      };
      const parsed = (data.items ?? []).map((r) => ({
        id: Number(r.id ?? 0),
        staffName:
          `${String(r.staffName ?? "").trim()} ${String(
            r.staffSurname ?? ""
          ).trim()}`.trim() || "Slot non assegnato",
        roleCode: String(r.roleCode ?? "—"),
        roleLocation: String(r.roleLocation ?? "—").toUpperCase(),
      }));
      setModalCols(parsed);
    } catch {
      setModalCols([]);
    } finally {
      setModalLoading(false);
    }
  }

  function renderStatusBadge(item: AssignmentItem): React.ReactNode {
    const label = statusBucketLabel(item);
    if (label === "DA CONFERMARE") {
      return (
        <StatusBadge
          variant="rejected"
          label="DA CONFERMARE"
          className="border font-bold uppercase tracking-wide"
        />
      );
    }
    if (label === "PASSATA") {
      return (
        <StatusBadge
          variant="partial"
          label="PASSATA"
          className="font-bold uppercase tracking-wide"
        />
      );
    }
    if (label === "DECLINATA") {
      return (
        <StatusBadge
          variant="declined"
          label="DECLINATA"
          className="border font-bold uppercase tracking-wide"
        />
      );
    }
    return (
      <StatusBadge
        variant="accepted"
        label="CONFERMATA"
        className="border font-bold uppercase tracking-wide"
      />
    );
  }

  function renderCard(item: AssignmentItem): React.ReactNode {
    const isPending = isPendingStatus(item.status);
    const isStadio = (item.location ?? "").toUpperCase().includes("STADIO");
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => void openColleaguesModal(item)}
        className="w-full rounded-xl border p-4 text-left"
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
              {item.competitionName || "EVENTO"}
            </div>
            <h3
              className="mt-1 text-[20px] uppercase leading-tight"
              style={{ color: "#fff", fontWeight: 900 }}
            >
              {eventTitle(item)}
            </h3>
          </div>
          {renderStatusBadge(item)}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            {
              label: "DATA KO",
              value: formatDateKoWithYear(item.date, item.koTime),
            },
            { label: "RUOLO", value: item.roleName || "—" },
            { label: "SEDE", value: item.location || "—" },
            {
              label: "STATUS",
              value: statusBucketLabel(item),
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
        </div>

        <div
          className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3"
          style={{ borderColor: "#2a2a2a" }}
        >
          {isPending ? (
            <div className="inline-flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void handleConfirm(item.id);
                }}
                disabled={confirmingId === item.id}
                className="inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded px-4 font-bold"
                style={{ color: "#FFFA00" }}
              >
                ACCETTA
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
                  void handleDecline(item.id);
                }}
                disabled={confirmingId === item.id}
                className="min-h-[44px] shrink-0 rounded px-4 text-xs font-bold"
                style={{ color: "#E24B4A" }}
              >
                DECLINA
              </button>
            </div>
          ) : null}

          {isStadio ? (
            <label className="ml-auto flex items-center gap-2 text-xs text-[#888]">
              PASS AUTO
              <select
                value={item.plateSelected ?? ""}
                disabled={savingPlateId === item.id}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  void handlePlateChange(item.id, e.target.value);
                }}
                className="rounded-md border px-2 py-1 text-xs"
                style={{
                  background: "#0a0a0a",
                  borderColor: "#2a2a2a",
                  color: "#fff",
                }}
              >
                <option value="">Nessun pass auto</option>
                {plates.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </button>
    );
  }

  const groupedColleagues = useMemo(() => {
    const groups: Record<"STADIO" | "COLOGNO" | "REMOTE", ColleagueItem[]> = {
      STADIO: [],
      COLOGNO: [],
      REMOTE: [],
    };
    for (const c of modalCols) {
      const key =
        c.roleLocation.includes("STADIO")
          ? "STADIO"
          : c.roleLocation.includes("COLOGNO")
            ? "COLOGNO"
            : "REMOTE";
      groups[key].push(c);
    }
    return groups;
  }, [modalCols]);

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg, #111 0%, #0a0a0a 100%)" }}
    >
      <AppNavbar
        userName={profile ? `${profile.name} ${profile.surname}`.trim() : "Utente"}
        userEmail={profile?.email ?? "Email non disponibile"}
        userInitials={profile ? getInitials(profile.name, profile.surname) : "?"}
        pendingCount={pendingCount}
        onBellClick={handleBellClick}
        centerContent={
          <>
            <button
              type="button"
              onClick={() => setTab("LISTA")}
              className="text-xs font-bold tracking-wide"
              style={{ color: tab === "LISTA" ? "#FFFA00" : "#888" }}
            >
              LE MIE ASSEGNAZIONI
            </button>
            <button
              type="button"
              onClick={() => setTab("CALENDARIO")}
              className="text-xs font-bold tracking-wide"
              style={{ color: tab === "CALENDARIO" ? "#FFFA00" : "#888" }}
            >
              CALENDARIO
            </button>
          </>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-6">
        {loading ? (
          <p style={{ color: "#888" }}>Caricamento assegnazioni…</p>
        ) : error ? (
          <div>
            <p style={{ color: "#E24B4A" }}>{error}</p>
            <Link href="/login" className="mt-3 inline-block underline" style={{ color: "#FFFA00" }}>
              Torna al login
            </Link>
          </div>
        ) : (
          <>
            <h1
              className="text-[28px] uppercase"
              style={{ color: "#fff", fontWeight: 900 }}
            >
              LE MIE ASSEGNAZIONI
            </h1>
            <p className="mt-1 text-sm" style={{ color: "#888" }}>
              Designazioni operative per{" "}
              <span style={{ color: "#FFFA00" }}>
                {profile ? `${profile.name} ${profile.surname}`.trim() : "—"}
              </span>
            </p>

            {tab === "LISTA" ? (
              <div className="mt-6 space-y-6">
                <section
                  ref={actionSectionRef}
                  className={`rounded-xl border p-4 ${highlightActionSection ? "ring-2 ring-pitch-accent/40" : ""}`}
                  style={{
                    background: "#111",
                    borderColor: highlightActionSection ? "#E24B4A" : "#2a2a2a",
                    borderLeft: "4px solid #FFFA00",
                    transition: "border-color 200ms ease-out",
                  }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase text-white">AZIONE RICHIESTA</h2>
                    <div className="flex items-center gap-2">
                      {sections.pendingFuture.length > 1 ? (
                        <PrimaryButton
                          type="button"
                          variant="primary"
                          onClick={() => void handleConfirmAll()}
                          loading={confirmingAll}
                          disabled={confirmingAll}
                          className="text-xs font-bold uppercase"
                        >
                          Conferma tutte
                        </PrimaryButton>
                      ) : null}
                      <span className="rounded-full px-2 py-1 text-xs font-bold" style={{ background: "#FFFA00", color: "#111" }}>
                        {sections.pendingFuture.length}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.pendingFuture.length === 0 ? (
                      <p className="text-sm" style={{ color: "#888" }}>Nessuna assegnazione da confermare.</p>
                    ) : (
                      sections.pendingFuture.map((item) => renderCard(item))
                    )}
                  </div>
                </section>

                <section
                  className="rounded-xl border p-4"
                  style={{ background: "#111", borderColor: "#2a2a2a", borderLeft: "4px solid #639922" }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase text-white">CONFERMATE</h2>
                    <span className="rounded-full bg-[#2a2a2a] px-2 py-1 text-xs font-bold text-[#ccc]">
                      {sections.confirmedFuture.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.confirmedFuture.length === 0 ? (
                      <p className="text-sm" style={{ color: "#888" }}>Nessuna confermata futura.</p>
                    ) : (
                      sections.confirmedFuture.map((item) => renderCard(item))
                    )}
                  </div>
                </section>

                <section
                  className="rounded-xl border p-4"
                  style={{ background: "#111", borderColor: "#2a2a2a", borderLeft: "4px solid #E24B4A" }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase text-white">DECLINATE</h2>
                    <span className="rounded-full bg-[#2a2a2a] px-2 py-1 text-xs font-bold text-[#ccc]">
                      {sections.declinedFuture.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sections.declinedFuture.length === 0 ? (
                      <p className="text-sm" style={{ color: "#888" }}>Nessuna declinata futura.</p>
                    ) : (
                      sections.declinedFuture.map((item) => renderCard(item))
                    )}
                  </div>
                </section>

                <section className="rounded-xl border p-4" style={{ background: "#111", borderColor: "#2a2a2a" }}>
                  <button
                    type="button"
                    onClick={() => setShowPast((s) => !s)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <h2 className="text-sm font-bold uppercase text-white">PASSATE</h2>
                    <span className="text-sm" style={{ color: "#888" }}>
                      {showPast ? "Nascondi" : `Mostra (${sections.past.length})`}
                    </span>
                  </button>
                  {showPast ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {sections.past.length === 0 ? (
                        <p className="text-sm" style={{ color: "#888" }}>Nessun evento passato.</p>
                      ) : (
                        sections.past.map((item) => renderCard(item))
                      )}
                    </div>
                  ) : null}
                </section>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border p-4" style={{ background: "#111", borderColor: "#2a2a2a" }}>
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setMonthDate(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                      )
                    }
                    style={{ color: "#FFFA00" }}
                  >
                    ←
                  </button>
                  <div className="font-bold text-white">
                    {monthDate.toLocaleDateString("it-IT", {
                      month: "long",
                      year: "numeric",
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setMonthDate(
                        (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                      )
                    }
                    style={{ color: "#FFFA00" }}
                  >
                    →
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase sm:text-sm" style={{ color: "#888" }}>
                  {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {monthCells.map((cell) => {
                    const dayEvents = eventsByDate.get(cell.isoDate) ?? [];
                    const hasAny = dayEvents.length > 0;
                    const hasPending = dayEvents.some((e) => isPendingStatus(e.status));
                    const hasConfirmed = dayEvents.some((e) => isConfirmedStatus(e.status));
                    const hasRejected = dayEvents.some(
                      (e) => e.status.toUpperCase() === "REJECTED"
                    );
                    let dotColor: string | null = null;
                    if (hasPending) dotColor = "#FFFA00";
                    else if (hasConfirmed) dotColor = "#639922";
                    else if (hasRejected) dotColor = "#555";
                    else if (hasAny) dotColor = "#888";
                    return (
                      <button
                        key={cell.isoDate}
                        type="button"
                        onClick={() => setSelectedCalendarDay(cell.isoDate)}
                        className="min-h-16 rounded border p-1 text-left"
                        style={{
                          borderColor: "#2a2a2a",
                          background: hasAny
                            ? cell.inCurrentMonth
                              ? "#222"
                              : "#171717"
                            : cell.inCurrentMonth
                              ? "#1a1a1a"
                              : "#0f0f0f",
                          color: cell.inCurrentMonth ? "#fff" : "#666",
                        }}
                      >
                        <div className="text-xs sm:text-sm">{cell.day}</div>
                        <div className="mt-1 flex gap-1">
                          {dotColor ? (
                            <span className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedCalendarDay ? (
                  <div className="mt-5 rounded-lg border p-3" style={{ borderColor: "#2a2a2a", background: "#1a1a1a" }}>
                    <div className="text-sm font-bold text-white">
                      Eventi del {formatDateTimeLabel(selectedCalendarDay, null).split(",")[0]}
                    </div>
                    <div className="mt-2 space-y-2">
                      {selectedDayEvents.length === 0 ? (
                        <p className="text-sm" style={{ color: "#888" }}>Nessun evento.</p>
                      ) : (
                        selectedDayEvents.map((item) => (
                          (() => {
                            const parts = [
                              eventTitle(item),
                              item.roleName?.trim() || null,
                              item.location?.trim() || null,
                              item.koTime?.trim() || null,
                            ].filter((part): part is string => Boolean(part && part.length > 0));
                            return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void openColleaguesModal(item)}
                            className="w-full rounded border px-3 py-2 text-left"
                            style={{ borderColor: "#2a2a2a", background: "#111", color: "#fff" }}
                          >
                            {parts.join(" — ")}
                          </button>
                            );
                          })()
                        ))
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </>
        )}
      </main>

      {modalOpen ? (
        <div className="fixed inset-0 z-30">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.65)" }}
            onClick={() => setModalOpen(false)}
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
              <h3 className="text-lg font-bold text-white">{modalTitle}</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-sm"
                style={{ color: "#FFFA00" }}
              >
                X
              </button>
            </div>
            <div className="mt-4 space-y-4">
              {modalLoading ? (
                <p style={{ color: "#888" }}>Caricamento colleghi…</p>
              ) : modalCols.length === 0 ? (
                <p style={{ color: "#888" }}>Nessun altro collega assegnato</p>
              ) : (
                (["STADIO", "COLOGNO", "REMOTE"] as const).map((group) => (
                  <div key={group}>
                    <div className="mb-2 text-xs font-bold uppercase" style={{ color: "#FFFA00" }}>
                      {group}
                    </div>
                    <div className="space-y-2">
                      {groupedColleagues[group].length === 0 ? (
                        <p className="text-xs" style={{ color: "#666" }}>Nessuno</p>
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
                ))
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
