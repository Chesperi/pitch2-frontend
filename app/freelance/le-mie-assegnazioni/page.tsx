"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api/apiFetch";
import { logoutPitch2 } from "@/lib/auth/pitch2Session";

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
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
    return {
      id: Number(idRaw ?? 0),
      eventId: String(row.eventId ?? row.event_id ?? ""),
      competitionName: String(
        row.competition_name ?? row.competitionName ?? "EVENTO"
      ).trim(),
      date:
        row.date != null && String(row.date).trim() !== ""
          ? String(row.date).slice(0, 10)
          : null,
      koTime:
        row.ko_time != null && String(row.ko_time).trim() !== ""
          ? String(row.ko_time).slice(0, 5)
          : null,
      roleName: String(row.role_name ?? row.roleName ?? "—").trim(),
      location:
        row.location != null && String(row.location).trim() !== ""
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
  const [tab, setTab] = useState<"LISTA" | "CALENDARIO">("LISTA");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [items, setItems] = useState<AssignmentItem[]>([]);
  const [plates, setPlates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [savingPlateId, setSavingPlateId] = useState<number | null>(null);
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

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
      setItems(normalizeAssignments(assignmentsData));

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

  useEffect(() => {
    function onDocumentMouseDown(ev: MouseEvent): void {
      if (!isUserMenuOpen) return;
      const target = ev.target;
      if (!(target instanceof Node)) return;
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentMouseDown);
    };
  }, [isUserMenuOpen]);

  const pendingCount = useMemo(
    () => items.filter((i) => isPendingStatus(i.status)).length,
    [items]
  );

  const sections = useMemo(() => {
    const pendingFuture = items
      .filter((i) => isPendingStatus(i.status) && !isPastDate(i.date, todayIso))
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const confirmedFuture = items
      .filter(
        (i) => isConfirmedStatus(i.status) && !isPastDate(i.date, todayIso)
      )
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
    const past = items
      .filter((i) => isPastDate(i.date, todayIso))
      .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
    return { pendingFuture, confirmedFuture, past };
  }, [items, todayIso]);

  const monthCells = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, AssignmentItem[]>();
    for (const item of items) {
      if (!item.date) continue;
      const arr = map.get(item.date) ?? [];
      arr.push(item);
      map.set(item.date, arr);
    }
    return map;
  }, [items]);

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
    setModalTitle(item.competitionName || "Evento");
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

  function renderStatusBadge(status: string): React.ReactNode {
    if (isPendingStatus(status)) {
      return (
        <span
          className="rounded-full border px-2 py-1 text-[10px] font-bold"
          style={{
            color: "#E24B4A",
            borderColor: "#E24B4A44",
            background: "#E24B4A22",
          }}
        >
          DA CONFERMARE
        </span>
      );
    }
    return (
      <span
        className="rounded-full border px-2 py-1 text-[10px] font-bold"
        style={{
          color: "#639922",
          borderColor: "#63992244",
          background: "#63992222",
        }}
      >
        CONFERMATA
      </span>
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
              {item.competitionName || "EVENTO"}
            </h3>
          </div>
          {renderStatusBadge(item.status)}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {[
            { label: "DATA", value: item.date ?? "—" },
            { label: "ORA", value: item.koTime ?? "—" },
            { label: "RUOLO", value: item.roleName || "—" },
            { label: "SEDE", value: item.location || "—" },
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void handleConfirm(item.id);
              }}
              disabled={confirmingId === item.id}
              className="inline-flex items-center gap-2"
              style={{ color: "#FFFA00", fontWeight: 700 }}
            >
              CONFERMA ORA
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full"
                style={{ background: "#FFFA00", color: "#111" }}
              >
                →
              </span>
            </button>
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

  async function handleLogout(): Promise<void> {
    try {
      await logoutPitch2();
    } finally {
      router.push("/login");
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "linear-gradient(180deg, #111 0%, #0a0a0a 100%)" }}
    >
      <header
        className="sticky top-0 z-20 border-b px-4 py-3"
        style={{ background: "#111", borderColor: "#2a2a2a" }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="text-xl"
              style={{
                fontFamily: "Arial Black, system-ui, sans-serif",
                fontWeight: 900,
                fontSize: 20,
                color: "#fff",
              }}
            >
              P<span style={{ color: "#FFFA00", fontSize: "1.4em" }}>/</span>TCH
            </div>
            <span style={{ color: "#868A8C", fontSize: 14, margin: "0 8px" }}>
              ×
            </span>
            <img
              src="/logo-dazn.png"
              alt="DAZN"
              height={22}
              style={{ height: 22, filter: "brightness(0) invert(1)" }}
            />
            <div className="h-6 w-px" style={{ background: "#2a2a2a" }} />
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
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                className="h-5 w-5"
                style={{ color: "#fff" }}
              >
                <path
                  d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0m6 0H9"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {pendingCount > 0 ? (
                <span
                  className="absolute -right-2 -top-2 min-w-5 rounded-full px-1 text-center text-[10px] font-bold"
                  style={{ background: "#E24B4A", color: "#fff" }}
                >
                  {pendingCount}
                </span>
              ) : null}
            </div>
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => setIsUserMenuOpen((s) => !s)}
                className="flex items-center gap-3"
              >
                <div className="text-right">
                  <div className="text-sm text-white">
                    {profile ? `${profile.name} ${profile.surname}`.trim() : "Utente"}
                  </div>
                </div>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
                  style={{ background: "#FFFA00", color: "#000" }}
                >
                  {profile ? getInitials(profile.name, profile.surname) : "?"}
                </div>
              </button>
              {isUserMenuOpen ? (
                <div
                  className="absolute right-0 mt-2 min-w-[220px] rounded-lg border p-2 shadow-xl"
                  style={{ background: "#1a1a1a", borderColor: "#2a2a2a" }}
                >
                  <div className="px-2 py-1 text-sm font-bold text-white">
                    {profile ? `${profile.name} ${profile.surname}`.trim() : "Utente"}
                  </div>
                  <div className="px-2 pb-2 text-xs" style={{ color: "#fff" }}>
                    {profile?.email ?? "Email non disponibile"}
                  </div>
                  <div className="my-1 h-px" style={{ background: "#2a2a2a" }} />
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="w-full rounded px-2 py-1 text-left text-sm hover:bg-black/30"
                    style={{ color: "#E24B4A" }}
                  >
                    Esci
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

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
                  className="rounded-xl border p-4"
                  style={{ background: "#111", borderColor: "#2a2a2a", borderLeft: "4px solid #E24B4A" }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-bold uppercase text-white">AZIONE RICHIESTA</h2>
                    <span className="rounded-full px-2 py-1 text-xs font-bold" style={{ background: "#E24B4A", color: "#fff" }}>
                      {sections.pendingFuture.length}
                    </span>
                  </div>
                  <div className="space-y-3">
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
                  <div className="space-y-3">
                    {sections.confirmedFuture.length === 0 ? (
                      <p className="text-sm" style={{ color: "#888" }}>Nessuna confermata futura.</p>
                    ) : (
                      sections.confirmedFuture.map((item) => renderCard(item))
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
                    <div className="mt-3 space-y-3">
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

                <div className="grid grid-cols-7 gap-1 text-center text-xs uppercase" style={{ color: "#888" }}>
                  {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((d) => (
                    <div key={d} className="py-1">{d}</div>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-1">
                  {monthCells.map((cell) => {
                    const dayEvents = eventsByDate.get(cell.isoDate) ?? [];
                    const hasPending = dayEvents.some((e) => isPendingStatus(e.status));
                    const hasConfirmed = dayEvents.some((e) => isConfirmedStatus(e.status));
                    return (
                      <button
                        key={cell.isoDate}
                        type="button"
                        onClick={() => setSelectedCalendarDay(cell.isoDate)}
                        className="min-h-16 rounded border p-1 text-left"
                        style={{
                          borderColor: "#2a2a2a",
                          background: cell.inCurrentMonth ? "#1a1a1a" : "#0f0f0f",
                          color: cell.inCurrentMonth ? "#fff" : "#666",
                        }}
                      >
                        <div className="text-xs">{cell.day}</div>
                        <div className="mt-1 flex gap-1">
                          {hasPending ? (
                            <span className="h-2 w-2 rounded-full" style={{ background: "#E24B4A" }} />
                          ) : null}
                          {hasConfirmed ? (
                            <span className="h-2 w-2 rounded-full" style={{ background: "#639922" }} />
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {selectedCalendarDay ? (
                  <div className="mt-5 rounded-lg border p-3" style={{ borderColor: "#2a2a2a", background: "#1a1a1a" }}>
                    <div className="text-sm font-bold text-white">
                      Eventi del {selectedCalendarDay}
                    </div>
                    <div className="mt-2 space-y-2">
                      {selectedDayEvents.length === 0 ? (
                        <p className="text-sm" style={{ color: "#888" }}>Nessun evento.</p>
                      ) : (
                        selectedDayEvents.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void openColleaguesModal(item)}
                            className="w-full rounded border px-3 py-2 text-left"
                            style={{ borderColor: "#2a2a2a", background: "#111", color: "#fff" }}
                          >
                            {item.competitionName} - {item.koTime ?? "--:--"}
                          </button>
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
            style={{ background: "#111", borderColor: "#2a2a2a" }}
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
