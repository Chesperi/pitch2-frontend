"use client";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import ComposableFilters, {
  type ActiveFilter,
  type FilterOption,
} from "@/components/ui/ComposableFilters";
import MonthCalendar from "@/components/ui/MonthCalendar";
import PageLoading from "@/components/ui/PageLoading";
import {
  fetchProjects,
  fetchProject,
  createProject,
  updatePhase,
  createSession,
  updateSession,
  deleteSession,
  createWorkBlock,
  deleteWorkBlock,
  type Project,
  type ProjectPhase,
  type ProjectPhaseSession,
  type ProjectPayload,
  type PhaseName,
  type PhaseStatus,
  PHASE_COLORS,
  PHASE_LABELS,
  ALL_PHASES,
  PROJECT_TYPE_COLORS,
} from "@/lib/api/projects";
import { fetchRoles } from "@/lib/api/roles";

// Helper date
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(d: string | null): string {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length !== 3) return d;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}
function getDaysToShow(z: "W" | "M" | "Q"): number {
  return z === "W" ? 42 : z === "M" ? 84 : 168;
}

function WorkBlockAddRow({
  availableRoles,
  onAdd,
}: {
  availableRoles: { role_code: string; location: string }[];
  onAdd: (wb: {
    role_code: string;
    location: string;
    quantity: number;
    hours_per_session: number;
  }) => void;
}) {
  const [roleCode, setRoleCode] = useState("");
  const [location, setLocation] = useState("COLOGNO");
  const [quantity, setQuantity] = useState(1);
  const [hours, setHours] = useState(8);

  const locations = [...new Set(availableRoles.map((r) => r.location))].sort();
  const filteredRoles = availableRoles
    .filter((r) => r.location === location)
    .map((r) => r.role_code)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .sort();

  const inputCls =
    "rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4, marginLeft: 0 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select
          className={inputCls}
          style={{ flex: 1 }}
          value={roleCode}
          onChange={(e) => setRoleCode(e.target.value)}
        >
          <option value="">Select role...</option>
          {filteredRoles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setRoleCode("");
          }}
        >
          {locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "var(--color-text-secondary)", minWidth: 28 }}>Qty</span>
        <input
          className={inputCls}
          type="number"
          min={1}
          max={20}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          style={{ width: 52 }}
        />
        <span style={{ fontSize: 11, color: "var(--color-text-secondary)", minWidth: 36 }}>Hours</span>
        <input
          className={inputCls}
          type="number"
          min={1}
          max={24}
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
          style={{ width: 52 }}
        />
        <button
          type="button"
          disabled={!roleCode}
          onClick={() => {
            if (!roleCode) return;
            onAdd({ role_code: roleCode, location, quantity, hours_per_session: hours });
            setRoleCode("");
            setQuantity(1);
            setHours(8);
          }}
          style={{
            background: roleCode ? "#FFFA00" : "#333",
            border: "none",
            borderRadius: 4,
            color: roleCode ? "#000" : "#666",
            fontSize: 12,
            fontWeight: 500,
            padding: "4px 10px",
            cursor: roleCode ? "pointer" : "not-allowed",
          }}
        >
          + Add
        </button>
      </div>
    </div>
  );
}

const PROJECT_TYPES = ["BRANDED", "EDITORIAL", "TECH", "PLATFORM"];

// Form stato iniziale
function emptyForm(): ProjectPayload & { phases: NonNullable<ProjectPayload["phases"]> } {
  return {
    name: "",
    client: null,
    project_type: "BRANDED",
    total_episodes: 1,
    notes: null,
    phases: ALL_PHASES.map((ph) => ({
      phase_name: ph,
      date_from: null,
      date_to: null,
      status: "PLANNED" as PhaseStatus,
      episodes_completed: 0,
      notes: null,
      work_blocks: [],
      sessions: [],
    })),
  };
}

export default function VisionPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"gantt" | "calendar">("gantt");
  const [zoom, setZoom] = useState<"W" | "M" | "Q">("M");
  const [offset, setOffset] = useState(0);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [searchValue, setSearchValue] = useState("");
  // Modal dettaglio
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  // Form nuovo progetto
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<number>>(new Set());
  const [expandedWorkBlocks, setExpandedWorkBlocks] = useState<Set<number>>(new Set());
  const [availableRoles, setAvailableRoles] = useState<{ role_code: string; location: string }[]>(
    []
  );
  const [editingPhase, setEditingPhase] = useState<{
    id: number;
    date_from: string;
    date_to: string;
    status: PhaseStatus;
    episodes_completed: number;
    notes: string;
  } | null>(null);
  const [addingSessionToPhase, setAddingSessionToPhase] = useState<number | null>(null);
  const [addingWorkBlockToPhase, setAddingWorkBlockToPhase] = useState<number | null>(null);
  const [newSession, setNewSession] = useState({ session_date: "", label: "" });
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<{
    id: number;
    phaseId: number;
    session_date: string;
    label: string;
  } | null>(null);
  // Calendar
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedVisionCalendarDay, setSelectedVisionCalendarDay] = useState<string | null>(null);
  const [sessionTooltip, setSessionTooltip] = useState<{
    session: ProjectPhaseSession;
    phaseName: PhaseName;
    x: number;
    y: number;
  } | null>(null);
  const tooltipClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClearTooltip = () => {
    if (tooltipClearTimer.current) clearTimeout(tooltipClearTimer.current);
    tooltipClearTimer.current = null;
  };
  const scheduleClearTooltip = () => {
    if (tooltipClearTimer.current) clearTimeout(tooltipClearTimer.current);
    tooltipClearTimer.current = setTimeout(() => {
      setSessionTooltip(null);
      tooltipClearTimer.current = null;
    }, 120);
  };

  const today = useMemo(() => new Date(), []);

  // Carica progetti
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchProjects();
        if (!cancelled) setProjects(data);
        try {
          const rolesList = await fetchRoles();
          if (!cancelled) {
            setAvailableRoles(
              rolesList.map((r) => ({
                role_code: r.code,
                location: r.location ?? "COLOGNO",
              }))
            );
          }
        } catch {
          if (!cancelled) setAvailableRoles([]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (tooltipClearTimer.current) clearTimeout(tooltipClearTimer.current);
    };
  }, []);

  // Offset iniziale centrato su oggi
  useEffect(() => {
    const days = getDaysToShow(zoom);
    setOffset(30 - Math.floor(days / 2));
  }, [zoom]);

  // Timeline date
  const totalDays = getDaysToShow(zoom);
  const timelineDates = useMemo(() => {
    return Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset + i);
      return d;
    });
  }, [today, offset, totalDays]);

  const timelineStart = timelineDates[0];
  const timelineEnd = timelineDates[totalDays - 1];

  function dateToPct(dateStr: string | null): number {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    const total = timelineEnd.getTime() - timelineStart.getTime();
    const pos = d.getTime() - timelineStart.getTime();
    return Math.max(0, Math.min(100, (pos / total) * 100));
  }

  function phaseInRange(dateFrom: string | null, dateTo: string | null): boolean {
    if (!dateFrom && !dateTo) return false;
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    if (from && from > timelineEnd) return false;
    if (to && to < timelineStart) return false;
    return true;
  }

  // Filtri
  const filterOptions: FilterOption[] = [
    { key: "type", label: "Type", values: PROJECT_TYPES.map((t) => ({ value: t })) },
  ];

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (searchValue) {
        const s = searchValue.toLowerCase();
        if (!p.name.toLowerCase().includes(s)) return false;
      }
      const typeF = activeFilters.find((f) => f.key === "type");
      if (typeF?.value) {
        const selected = typeF.value
          .split("||")
          .map((v) => v.trim())
          .filter((v) => v.length > 0);
        if (selected.length > 0 && !selected.includes(p.project_type)) return false;
      }
      return true;
    });
  }, [projects, searchValue, activeFilters]);

  type VisionCalendarDayEntry = {
    project: Project;
    phase: ProjectPhase;
    session: ProjectPhaseSession;
  };

  const visionCalendarSessionsByIso = useMemo(() => {
    const map = new Map<string, VisionCalendarDayEntry[]>();
    for (const p of filteredProjects) {
      for (const ph of p.project_phases) {
        for (const s of ph.project_phase_sessions ?? []) {
          const iso = s.session_date;
          const list = map.get(iso) ?? [];
          list.push({ project: p, phase: ph, session: s });
          map.set(iso, list);
        }
      }
    }
    return map;
  }, [filteredProjects]);

  const selectedVisionCalendarDaySessions = useMemo(() => {
    if (!selectedVisionCalendarDay) return [];
    return visionCalendarSessionsByIso.get(selectedVisionCalendarDay) ?? [];
  }, [selectedVisionCalendarDay, visionCalendarSessionsByIso]);

  function getProgress(p: Project) {
    const onAirPhase = p.project_phases.find((ph) => ph.phase_name === "ON_AIR");
    const sessions = onAirPhase?.project_phase_sessions ?? [];
    const onAirCount = sessions.filter((s) => s.status === "COMPLETED").length;
    const total = p.total_episodes;
    const pct = total > 0 ? Math.round((onAirCount / total) * 100) : 0;
    return { onAirCount, total, pct };
  }

  const detailProgress = useMemo(
    () => (selectedProject ? getProgress(selectedProject) : null),
    [selectedProject]
  );

  const handleEditPhase = (phase: ProjectPhase) => {
    setAddingSessionToPhase(null);
    setAddingWorkBlockToPhase(null);
    setEditingSession(null);
    setModalError(null);
    setEditingPhase({
      id: phase.id,
      date_from: phase.date_from ?? "",
      date_to: phase.date_to ?? "",
      status: phase.status,
      episodes_completed: phase.episodes_completed,
      notes: phase.notes ?? "",
    });
  };

  const handleSavePhase = async () => {
    if (!editingPhase || !selectedProject) return;
    setModalSaving(true);
    setModalError(null);
    try {
      await updatePhase(editingPhase.id, {
        date_from: editingPhase.date_from || null,
        date_to: editingPhase.date_to || null,
        status: editingPhase.status,
        episodes_completed: editingPhase.episodes_completed,
        notes: editingPhase.notes || null,
      });
      const updated = await fetchProject(selectedProject.id);
      setSelectedProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingPhase(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Error saving phase");
    } finally {
      setModalSaving(false);
    }
  };

  const handleAddWorkBlock = async (
    phaseId: number,
    wb: { role_code: string; location: string; quantity: number; hours_per_session: number }
  ) => {
    if (!selectedProject) return;
    setModalSaving(true);
    setModalError(null);
    try {
      await createWorkBlock(phaseId, wb);
      const updated = await fetchProject(selectedProject.id);
      setSelectedProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setAddingWorkBlockToPhase(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Error adding work block");
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteWorkBlock = async (phaseId: number, workBlockId: number) => {
    if (!selectedProject) return;
    if (!window.confirm("Delete this work block?")) return;
    setModalSaving(true);
    setModalError(null);
    try {
      await deleteWorkBlock(phaseId, workBlockId);
      const updated = await fetchProject(selectedProject.id);
      setSelectedProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Error deleting work block");
    } finally {
      setModalSaving(false);
    }
  };

  const handleAddSession = async () => {
    if (!addingSessionToPhase || !newSession.session_date || !selectedProject) return;
    setModalSaving(true);
    setModalError(null);
    try {
      await createSession(addingSessionToPhase, {
        session_date: newSession.session_date,
        label: newSession.label || null,
        status: "PLANNED",
      });
      const updated = await fetchProject(selectedProject.id);
      setSelectedProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setAddingSessionToPhase(null);
      setNewSession({ session_date: "", label: "" });
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Error adding session");
    } finally {
      setModalSaving(false);
    }
  };

  const handleSaveSession = async () => {
    if (!editingSession || !selectedProject) return;
    setModalSaving(true);
    setModalError(null);
    try {
      await updateSession(editingSession.phaseId, editingSession.id, {
        session_date: editingSession.session_date,
        label: editingSession.label || null,
      });
      const updated = await fetchProject(selectedProject.id);
      setSelectedProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingSession(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Error saving session");
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteSession = async (phaseId: number, sessionId: number) => {
    if (!selectedProject) return;
    if (!window.confirm("Delete this session?")) return;
    setModalSaving(true);
    setModalError(null);
    try {
      await deleteSession(phaseId, sessionId);
      const updated = await fetchProject(selectedProject.id);
      setSelectedProject(updated);
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingSession(null);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Error deleting session");
    } finally {
      setModalSaving(false);
    }
  };

  async function handleSaveProject() {
    if (!form.name.trim()) {
      setFormError("Project name is required");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      // Filtra fasi senza date (non pianificate)
      const phases = form.phases.filter((ph) => ph.date_from || ph.date_to);
      const created = await createProject({
        ...form,
        client: form.client?.trim() || null,
        phases,
      });
      setProjects((prev) => [...prev, created]);
      setShowForm(false);
      setForm(emptyForm());
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Save error");
    } finally {
      setSaving(false);
    }
  }

  // Months label per header timeline
  const monthLabels = useMemo(() => {
    const labels: { label: string; startPct: number; widthPct: number }[] = [];
    let currentMonth = -1;
    let currentYear = -1;
    let monthStart = 0;

    timelineDates.forEach((d, i) => {
      const m = d.getMonth();
      const y = d.getFullYear();
      if (m !== currentMonth || y !== currentYear) {
        if (currentMonth !== -1) {
          labels.push({
            label: new Date(currentYear, currentMonth, 1).toLocaleDateString("it-IT", {
              month: "short",
              year: "2-digit",
            }),
            startPct: (monthStart / totalDays) * 100,
            widthPct: ((i - monthStart) / totalDays) * 100,
          });
        }
        currentMonth = m;
        currentYear = y;
        monthStart = i;
      }
    });
    // Ultimo mese
    labels.push({
      label: new Date(currentYear, currentMonth, 1).toLocaleDateString("it-IT", {
        month: "short",
        year: "2-digit",
      }),
      startPct: (monthStart / totalDays) * 100,
      widthPct: ((totalDays - monthStart) / totalDays) * 100,
    });
    return labels;
  }, [timelineDates, totalDays]);

  const todayPct = dateToPct(toIsoDate(today));

  const inputClass =
    "w-full rounded border border-[#222] bg-[#141414] px-3 py-2.5 text-sm text-white focus:border-[#FFFA00] focus:outline-none";
  const btnPrimary =
    "rounded bg-[#FFFA00] px-5 py-2.5 text-sm font-medium text-black hover:bg-yellow-200 disabled:opacity-50";
  const btnSecondary =
    "rounded border border-[#333] px-5 py-2.5 text-sm text-[#aaa] hover:bg-[#1a1a1a]";

  return (
    <div style={{ padding: "16px 24px", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: "var(--color-text-primary)",
            margin: 0,
          }}
        >
          Vision
        </h1>
        <div style={{ display: "flex", gap: 24, marginLeft: 8 }}>
          {(["gantt", "calendar"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: view === v ? "#FFFA00" : "var(--color-text-secondary)",
                borderBottom: view === v ? "2px solid #FFFA00" : "2px solid transparent",
                paddingBottom: 2,
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {v === "gantt" ? "Gantt" : "Calendar"}
            </button>
          ))}
        </div>
        {view === "gantt" && (
          <>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => setOffset((o) => o - Math.floor(totalDays / 2))}
                style={{
                  background: "none",
                  border: "0.5px solid var(--color-border-tertiary)",
                  borderRadius: 4,
                  color: "var(--color-text-secondary)",
                  width: 28,
                  height: 28,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ‹
              </button>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  minWidth: 140,
                  textAlign: "center",
                }}
              >
                {timelineDates[0].toLocaleDateString("it-IT", { day: "2-digit", month: "short" })} –{" "}
                {timelineDates[totalDays - 1].toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
              <button
                type="button"
                onClick={() => setOffset((o) => o + Math.floor(totalDays / 2))}
                style={{
                  background: "none",
                  border: "0.5px solid var(--color-border-tertiary)",
                  borderRadius: 4,
                  color: "var(--color-text-secondary)",
                  width: 28,
                  height: 28,
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => setOffset(30 - Math.floor(totalDays / 2))}
                style={{
                  background: "#FFFA00",
                  border: "none",
                  borderRadius: 4,
                  color: "#000",
                  padding: "3px 10px",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Today
              </button>
              <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
                {(["W", "M", "Q"] as const).map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoom(z)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: zoom === z ? "#FFFA00" : "var(--color-text-secondary)",
                      borderBottom: zoom === z ? "2px solid #FFFA00" : "2px solid transparent",
                      paddingBottom: 2,
                      transition: "color 0.15s, border-color 0.15s",
                      padding: "0 4px 2px 4px",
                    }}
                  >
                    {z === "W" ? "Week" : z === "M" ? "Month" : "Quarter"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setForm(emptyForm());
          }}
          className={btnPrimary}
          style={{ marginLeft: view === "gantt" ? 8 : "auto" }}
        >
          + New project
        </button>
      </div>

      {view === "gantt" && (
        <>
          {/* Filtri */}
          <ComposableFilters
            className="mb-4"
            filters={filterOptions}
            activeFilters={activeFilters}
            onChange={setActiveFilters}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            searchPlaceholder="Search project..."
          />

          {/* Legenda fasi */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {ALL_PHASES.map((ph) => (
              <div
                key={ph}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: "var(--color-text-secondary)",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 2, background: PHASE_COLORS[ph].bg }} />
                {PHASE_LABELS[ph]}
              </div>
            ))}
          </div>

          {loading ? (
            <PageLoading />
          ) : (
            <div
              style={{
                border: "0.5px solid var(--color-border-tertiary)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {/* Header timeline */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--color-border-tertiary)",
                  background: "var(--color-background-secondary)",
                  height: "auto",
                }}
              >
                <div
                  style={{
                    minWidth: 200,
                    padding: "6px 12px",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    borderRight: "1px solid var(--color-border-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Project
                </div>
                <div
                  style={{
                    minWidth: 110,
                    padding: "6px 8px",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--color-text-secondary)",
                    borderRight: "1px solid var(--color-border-tertiary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}
                >
                  Phase
                </div>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    height: "auto",
                  }}
                >
                  {/* Header timeline — mesi */}
                  <div
                    style={{
                      flex: 1,
                      position: "relative",
                      overflow: "hidden",
                      borderBottom: "0.5px solid var(--color-border-tertiary)",
                    }}
                  >
                    {monthLabels.map((ml, i) => (
                      <span
                        key={i}
                        style={{
                          position: "absolute",
                          left: `${ml.startPct}%`,
                          width: `${ml.widthPct}%`,
                          fontSize: 12,
                          color: "var(--color-text-secondary)",
                          padding: "4px 4px",
                          borderRight: "0.5px solid var(--color-border-tertiary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          fontWeight: 500,
                        }}
                      >
                        {ml.label}
                      </span>
                    ))}
                    <div style={{ height: 22 }} />
                  </div>
                  {/* Header timeline — giorni */}
                  <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
                    {timelineDates.map((d, i) => {
                      const pct = (i / totalDays) * 100;
                      const isToday = toIsoDate(d) === toIsoDate(today);
                      const showLabel =
                        zoom === "W"
                          ? true
                          : zoom === "M"
                            ? d.getDate() === 1 || d.getDate() % 7 === 0
                            : d.getDate() === 1;
                      if (!showLabel) return null;
                      return (
                        <span
                          key={i}
                          style={{
                            position: "absolute",
                            left: `${pct}%`,
                            fontSize: 11,
                            color: isToday ? "#FFFA00" : "var(--color-text-secondary)",
                            fontWeight: isToday ? 700 : 400,
                            padding: "3px 2px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {d.getDate()}
                        </span>
                      );
                    })}
                    <div style={{ height: 20 }} />
                  </div>
                </div>
              </div>

              {/* Righe progetti */}
              {filteredProjects.length === 0 ? (
                <div
                  style={{
                    padding: 32,
                    textAlign: "center",
                    color: "var(--color-text-secondary)",
                    fontSize: 13,
                  }}
                >
                  No projects yet. Click &quot;+ New project&quot; to get started.
                </div>
              ) : (
                filteredProjects.flatMap((project) => {
                  const visiblePhases = project.project_phases
                    .filter((ph) => phaseInRange(ph.date_from, ph.date_to))
                    .sort((a, b) => a.sort_order - b.sort_order);

                  if (visiblePhases.length === 0) {
                    // Progetto senza fasi nel range: mostra solo la riga nome
                    return [
                      <div
                        key={project.id}
                        style={{
                          display: "flex",
                          borderBottom: "0.5px solid var(--color-border-tertiary)",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            minWidth: 200,
                            minHeight: 40,
                            padding: "0 12px",
                            borderRight: "1px solid var(--color-border-tertiary)",
                            boxSizing: "border-box",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              padding: "1px 6px",
                              borderRadius: 3,
                              background: PROJECT_TYPE_COLORS[project.project_type] ?? "#888",
                              color: "#fff",
                              fontWeight: 500,
                              flexShrink: 0,
                            }}
                          >
                            {project.project_type}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            style={{
                              fontSize: 13,
                              fontWeight: 500,
                              cursor: "pointer",
                              color: "var(--color-text-primary)",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            onClick={() => setSelectedProject(project)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") setSelectedProject(project);
                            }}
                          >
                            {project.name}
                          </span>
                          <span style={{ fontSize: 11, color: "var(--color-text-secondary)", flexShrink: 0, marginLeft: "auto" }}>
                            {getProgress(project).onAirCount}/{project.total_episodes}
                          </span>
                        </div>
                        <div
                          style={{
                            minWidth: 110,
                            height: 40,
                            borderRight: "1px solid var(--color-border-tertiary)",
                            boxSizing: "border-box",
                          }}
                        />
                        <div
                          style={{
                            flex: 1,
                            height: 40,
                            padding: "8px 12px",
                            boxSizing: "border-box",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--color-text-secondary)",
                              fontStyle: "italic",
                            }}
                          >
                            No phases in current period
                          </span>
                        </div>
                      </div>,
                    ];
                  }

                  return visiblePhases.map((phase, phaseIdx) => {
                    const leftPct = dateToPct(phase.date_from);
                    const rightPct = dateToPct(phase.date_to);
                    const widthPct = Math.max(0.5, rightPct - leftPct);
                    const opacity =
                      phase.status === "COMPLETED"
                        ? 1
                        : phase.status === "IN_PROGRESS"
                          ? 0.85
                          : 0.35;
                    const colors = PHASE_COLORS[phase.phase_name as PhaseName];
                    const barBg = colors?.bg ?? "#888";

                    return (
                      <div
                        key={phase.id}
                        style={{
                          display: "flex",
                          borderBottom: "0.5px solid var(--color-border-tertiary)",
                        }}
                      >
                        {/* Colonna progetto — solo sulla prima fase */}
                        {phaseIdx === 0 ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                              minWidth: 200,
                              minHeight: 40,
                              padding: "0 12px",
                              borderRight: "1px solid var(--color-border-tertiary)",
                              boxSizing: "border-box",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 11,
                                padding: "1px 6px",
                                borderRadius: 3,
                                background: PROJECT_TYPE_COLORS[project.project_type] ?? "#888",
                                color: "#fff",
                                fontWeight: 500,
                                flexShrink: 0,
                              }}
                            >
                              {project.project_type}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              style={{
                                fontSize: 13,
                                fontWeight: 500,
                                cursor: "pointer",
                                color: "var(--color-text-primary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              onClick={() => setSelectedProject(project)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") setSelectedProject(project);
                              }}
                            >
                              {project.name}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--color-text-secondary)", flexShrink: 0, marginLeft: "auto" }}>
                              {getProgress(project).onAirCount}/{project.total_episodes}
                            </span>
                          </div>
                        ) : (
                          <div
                            style={{
                              minWidth: 200,
                              height: 40,
                              borderRight: "1px solid var(--color-border-tertiary)",
                              boxSizing: "border-box",
                            }}
                          />
                        )}

                        {/* Colonna fase */}
                        <div
                          style={{
                            minWidth: 110,
                            height: 40,
                            padding: "4px 8px",
                            borderRight: "1px solid var(--color-border-tertiary)",
                            display: "flex",
                            alignItems: "center",
                            boxSizing: "border-box",
                          }}
                        >
                          <span style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                            {PHASE_LABELS[phase.phase_name as PhaseName]}
                          </span>
                        </div>

                        {/* Timeline */}
                        <div
                          style={{
                            flex: 1,
                            position: "relative",
                            height: 40,
                            display: "flex",
                            alignItems: "center",
                            boxSizing: "border-box",
                          }}
                        >
                          {/* Linea oggi */}
                          {todayPct >= 0 && todayPct <= 100 && (
                            <div
                              style={{
                                position: "absolute",
                                left: `${todayPct}%`,
                                top: 0,
                                bottom: 0,
                                width: 1,
                                background: "#FFFA00",
                                opacity: 0.6,
                                zIndex: 2,
                              }}
                            />
                          )}
                          {timelineDates.map((d, i) => {
                            if (d.getDate() !== 1) return null;
                            const pct = (i / totalDays) * 100;
                            return (
                              <div
                                key={`ms${i}`}
                                style={{
                                  position: "absolute",
                                  left: `${pct}%`,
                                  top: 0,
                                  bottom: 0,
                                  width: "0.5px",
                                  background: "var(--color-border-tertiary)",
                                  zIndex: 0,
                                  pointerEvents: "none",
                                }}
                              />
                            );
                          })}
                          {/* Barra fase */}
                          <div
                            style={{
                              position: "absolute",
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              height: 18,
                              top: "50%",
                              transform: "translateY(-50%)",
                              borderRadius: 999,
                              border: `1.5px solid ${barBg}`,
                              background: "transparent",
                              color: barBg,
                              opacity,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 500,
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              padding: "0 8px",
                              zIndex: 1,
                              boxSizing: "border-box",
                            }}
                          >
                            {phase.status === "COMPLETED" ? "✓" : phase.status === "IN_PROGRESS" ? "●" : ""}
                          </div>
                          {phase.project_phase_sessions
                            ?.slice()
                            .sort((a, b) => a.session_date.localeCompare(b.session_date))
                            .map((session) => {
                              const sessionPct = dateToPct(session.session_date);
                              if (sessionPct < 0 || sessionPct > 100) return null;
                              const sColors = PHASE_COLORS[phase.phase_name as PhaseName];
                              const isCompleted = session.status === "COMPLETED";
                              return (
                                <div
                                  key={session.id}
                                  onMouseEnter={(e) => {
                                    cancelClearTooltip();
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setSessionTooltip({
                                      session,
                                      phaseName: phase.phase_name as PhaseName,
                                      x: rect.left + rect.width / 2,
                                      y: rect.top,
                                    });
                                  }}
                                  onMouseLeave={scheduleClearTooltip}
                                  onClick={() => setSelectedProject(project)}
                                  style={{
                                    position: "absolute",
                                    left: `${sessionPct}%`,
                                    top: "50%",
                                    transform: "translate(-50%, -50%)",
                                    margin: 0,
                                    width: 12,
                                    height: 12,
                                    borderRadius: "50%",
                                    background: isCompleted ? sColors?.bg ?? "#888" : "transparent",
                                    border: `2px solid ${sColors?.bg ?? "#888"}`,
                                    zIndex: 3,
                                    cursor: "pointer",
                                  }}
                                />
                              );
                            })}
                        </div>
                      </div>
                    );
                  });
                })
              )}

              {/* Separatore tra progetti */}
            </div>
          )}
        </>
      )}

      {view === "calendar" && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
            {ALL_PHASES.map((ph) => (
              <div
                key={ph}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: "var(--color-text-secondary)",
                }}
              >
                <div style={{ width: 10, height: 10, borderRadius: 2, background: PHASE_COLORS[ph].bg }} />
                {PHASE_LABELS[ph]}
              </div>
            ))}
          </div>
          <MonthCalendar
            year={calendarMonth.getFullYear()}
            month={calendarMonth.getMonth()}
            onPrevMonth={() =>
              setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))
            }
            onNextMonth={() =>
              setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))
            }
            onDayClick={(y, m, d) =>
              setSelectedVisionCalendarDay(
                `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
              )
            }
            renderDayContent={(y, m, d) => {
              const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const daySessions = visionCalendarSessionsByIso.get(iso) ?? [];
              const shown = daySessions.slice(0, 4);
              const rest = daySessions.length - shown.length;
              return (
                <div className="mt-1 flex flex-col gap-0.5 overflow-hidden">
                  {shown.map(({ project: p, phase: ph, session: s }) => {
                    const colors = PHASE_COLORS[ph.phase_name as PhaseName];
                    return (
                      <div
                        key={s.id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setSelectedProject(p);
                        }}
                        className="max-w-full cursor-pointer truncate rounded border border-solid px-1 py-0.5 text-left text-[10px]"
                        style={{
                          borderColor: colors?.bg ?? "#888",
                          color: colors?.bg ?? "#888",
                          background: "transparent",
                        }}
                        title={`${p.name} · ${PHASE_LABELS[ph.phase_name as PhaseName]} · ${s.label ?? ""}`}
                      >
                        {p.name} · {s.label ?? PHASE_LABELS[ph.phase_name as PhaseName]}
                      </div>
                    );
                  })}
                  {rest > 0 ? <div className="text-[10px] text-[#777]">+{rest}</div> : null}
                </div>
              );
            }}
          />

          {selectedVisionCalendarDay ? (
            <div
              className="mt-5 rounded-lg border p-3"
              style={{ borderColor: "#2a2a2a", background: "#1a1a1a" }}
            >
              <div className="text-sm font-bold text-white">
                Sessions on{" "}
                {new Date(`${selectedVisionCalendarDay}T12:00:00`).toLocaleDateString("it-IT", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </div>
              <div className="mt-2 space-y-2">
                {selectedVisionCalendarDaySessions.length === 0 ? (
                  <p className="text-sm" style={{ color: "#888" }}>
                    No sessions.
                  </p>
                ) : (
                  selectedVisionCalendarDaySessions.map(({ project: p, phase: ph, session: s }) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => void setSelectedProject(p)}
                      className="w-full rounded border px-3 py-2 text-left text-sm"
                      style={{ borderColor: "#2a2a2a", background: "#111", color: "#fff" }}
                    >
                      {[p.name, PHASE_LABELS[ph.phase_name as PhaseName], s.label?.trim() || null]
                        .filter(Boolean)
                        .join(" — ")}
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Modal dettaglio progetto */}
      {selectedProject && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectedProject(null)}
          role="presentation"
        >
          <div
            style={{
              background: "#0d0d0d",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 8,
              width: "100%",
              maxWidth: 560,
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {modalError ? (
              <p
                style={{
                  marginBottom: 12,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#2e0a0a",
                  border: "0.5px solid #f87171",
                  color: "#f87171",
                  fontSize: 12,
                }}
              >
                {modalError}
              </p>
            ) : null}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 4,
                    background: PROJECT_TYPE_COLORS[selectedProject.project_type] ?? "#888",
                    color: "#fff",
                    fontWeight: 500,
                  }}
                >
                  {selectedProject.project_type}
                </span>
                <h3
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    margin: 0,
                  }}
                >
                  {selectedProject.name}
                </h3>
              </div>
              {selectedProject.client ? (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--color-text-secondary)",
                    display: "block",
                    marginTop: 8,
                  }}
                >
                  {selectedProject.client}
                </span>
              ) : null}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: "#4ade80" }}>
                  {detailProgress!.onAirCount}/{selectedProject.total_episodes} on air
                </span>
                <div
                  style={{
                    height: 3,
                    width: 60,
                    background: "var(--color-border-tertiary)",
                    borderRadius: 2,
                  }}
                >
                  <div
                    style={{
                      height: 3,
                      width: `${detailProgress!.pct}%`,
                      background: "#4ade80",
                      borderRadius: 2,
                    }}
                  />
                </div>
                <span style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                  {detailProgress!.pct}%
                </span>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {ALL_PHASES.map((phaseName) => {
                const phase = selectedProject.project_phases.find((p) => p.phase_name === phaseName);
                const colors = PHASE_COLORS[phaseName];
                return (
                  <div
                    key={phaseName}
                    style={{
                      borderRadius: 6,
                      border: "0.5px solid var(--color-border-tertiary)",
                      opacity: phase ? 1 : 0.35,
                      overflow: "hidden",
                      padding: "8px 10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: colors.bg, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--color-text-primary)", minWidth: 130 }}>
                        {PHASE_LABELS[phaseName]}
                      </span>
                      {phase ? (
                        <>
                          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                            {formatDisplayDate(phase.date_from)} → {formatDisplayDate(phase.date_to)}
                          </span>
                          <span
                            style={{
                              marginLeft: "auto",
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 3,
                              background:
                                phase.status === "COMPLETED"
                                  ? "#1a2e1a"
                                  : phase.status === "IN_PROGRESS"
                                    ? "#1a1a2e"
                                    : "#1e1e1e",
                              color:
                                phase.status === "COMPLETED"
                                  ? "#4ade80"
                                  : phase.status === "IN_PROGRESS"
                                    ? "#60a5fa"
                                    : "#888",
                            }}
                          >
                            {phase.status === "COMPLETED"
                              ? "✓ Completed"
                              : phase.status === "IN_PROGRESS"
                                ? "● In progress"
                                : "○ Planned"}
                          </span>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                          Not scheduled
                        </span>
                      )}
                    </div>
                    {phase?.project_phase_sessions && phase.project_phase_sessions.length > 0 ? (
                      <div
                        style={{
                          marginTop: 4,
                          marginLeft: 0,
                          marginBottom: 8,
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 4,
                        }}
                      >
                        {phase.project_phase_sessions
                          .slice()
                          .sort((a, b) => a.session_date.localeCompare(b.session_date))
                          .map((s) => (
                            <div key={s.id}>
                              {editingSession?.id === s.id ? (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: 4,
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <input
                                    type="date"
                                    className="rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none"
                                    value={editingSession.session_date}
                                    onChange={(e) =>
                                      setEditingSession((es) =>
                                        es ? { ...es, session_date: e.target.value } : null
                                      )
                                    }
                                  />
                                  <input
                                    className="rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none"
                                    style={{ width: 100 }}
                                    value={editingSession.label}
                                    onChange={(e) =>
                                      setEditingSession((es) =>
                                        es ? { ...es, label: e.target.value } : null
                                      )
                                    }
                                  />
                                  <button
                                    type="button"
                                    onClick={() => void handleSaveSession()}
                                    disabled={modalSaving}
                                    style={{
                                      fontSize: 11,
                                      color: "#000",
                                      background: "#FFFA00",
                                      border: "none",
                                      borderRadius: 4,
                                      padding: "2px 8px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    {modalSaving ? "..." : "✓"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSession(null)}
                                    style={{
                                      fontSize: 11,
                                      color: "#aaa",
                                      background: "none",
                                      border: "0.5px solid #444",
                                      borderRadius: 4,
                                      padding: "2px 8px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✕
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteSession(s.phase_id, s.id)}
                                    disabled={modalSaving}
                                    style={{
                                      fontSize: 11,
                                      color: "#f87171",
                                      background: "none",
                                      border: "0.5px solid #f87171",
                                      borderRadius: 4,
                                      padding: "2px 8px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : (
                                <span
                                  onClick={() =>
                                    setEditingSession({
                                      id: s.id,
                                      phaseId: s.phase_id,
                                      session_date: s.session_date,
                                      label: s.label ?? "",
                                    })
                                  }
                                  style={{
                                    fontSize: 10,
                                    padding: "1px 6px",
                                    borderRadius: 3,
                                    background: s.status === "COMPLETED" ? "#1a2e1a" : "#1e1e1e",
                                    color: s.status === "COMPLETED" ? "#4ade80" : "#888",
                                    border: "0.5px solid",
                                    borderColor: s.status === "COMPLETED" ? "#4ade80" : "#333",
                                    cursor: "pointer",
                                    userSelect: "none",
                                  }}
                                  title="Click to edit"
                                >
                                  {s.label ?? formatDisplayDate(s.session_date)}
                                </span>
                              )}
                            </div>
                          ))}
                      </div>
                    ) : null}
                    {/* Work blocks */}
                    {phase ? (
                      <div style={{ marginTop: 8, marginLeft: 0 }}>
                        {phase.work_blocks && phase.work_blocks.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                            {phase.work_blocks.map((wb) => (
                              <div
                                key={wb.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontSize: 10,
                                  padding: "2px 8px",
                                  borderRadius: 3,
                                  background: "#1a1a2e",
                                  color: "#60a5fa",
                                  border: "0.5px solid #2a2a4e",
                                }}
                              >
                                <span>
                                  {wb.role_code} · {wb.location} · {wb.quantity}× {wb.hours_per_session}h
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteWorkBlock(phase.id, wb.id)}
                                  style={{
                                    fontSize: 12,
                                    color: "#f87171",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {addingWorkBlockToPhase === phase.id ? (
                          <div style={{ marginTop: 4, marginLeft: 0 }}>
                            <WorkBlockAddRow
                              availableRoles={availableRoles}
                              onAdd={(wb) => void handleAddWorkBlock(phase.id, wb)}
                            />
                            <button
                              type="button"
                              onClick={() => setAddingWorkBlockToPhase(null)}
                              style={{
                                fontSize: 11,
                                color: "var(--color-text-secondary)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                marginTop: 4,
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {phase ? (
                      editingPhase?.id === phase.id ? (
                        <div style={{ marginTop: 8, marginLeft: 0, marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                            <div>
                              <label
                                style={{
                                  fontSize: 10,
                                  color: "var(--color-text-secondary)",
                                  display: "block",
                                  marginBottom: 2,
                                }}
                              >
                                From
                              </label>
                              <input
                                type="date"
                                className="w-full rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none"
                                value={editingPhase.date_from}
                                onChange={(e) =>
                                  setEditingPhase((ep) => (ep ? { ...ep, date_from: e.target.value } : null))
                                }
                              />
                            </div>
                            <div>
                              <label
                                style={{
                                  fontSize: 10,
                                  color: "var(--color-text-secondary)",
                                  display: "block",
                                  marginBottom: 2,
                                }}
                              >
                                To
                              </label>
                              <input
                                type="date"
                                className="w-full rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none"
                                value={editingPhase.date_to}
                                onChange={(e) =>
                                  setEditingPhase((ep) => (ep ? { ...ep, date_to: e.target.value } : null))
                                }
                              />
                            </div>
                          </div>
                          <select
                            className="rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:outline-none"
                            value={editingPhase.status}
                            onChange={(e) =>
                              setEditingPhase((ep) =>
                                ep ? { ...ep, status: e.target.value as PhaseStatus } : null
                              )
                            }
                          >
                            <option value="PLANNED">Planned</option>
                            <option value="IN_PROGRESS">In progress</option>
                            <option value="COMPLETED">Completed</option>
                          </select>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => setEditingPhase(null)}
                              style={{
                                fontSize: 11,
                                color: "var(--color-text-secondary)",
                                background: "none",
                                border: "0.5px solid var(--color-border-tertiary)",
                                borderRadius: 4,
                                padding: "3px 10px",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSavePhase()}
                              disabled={modalSaving}
                              style={{
                                fontSize: 11,
                                color: "#000",
                                background: "#FFFA00",
                                border: "none",
                                borderRadius: 4,
                                padding: "3px 10px",
                                cursor: "pointer",
                                opacity: modalSaving ? 0.5 : 1,
                              }}
                            >
                              {modalSaving ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </div>
                      ) : addingSessionToPhase === phase.id ? (
                        <div style={{ marginTop: 8, marginLeft: 0, marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <input
                              type="date"
                              className="rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none"
                              value={newSession.session_date}
                              onChange={(e) =>
                                setNewSession((s) => ({ ...s, session_date: e.target.value }))
                              }
                            />
                            <input
                              className="flex-1 rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none"
                              placeholder="Label (e.g. Ep. 1)"
                              value={newSession.label}
                              onChange={(e) => setNewSession((s) => ({ ...s, label: e.target.value }))}
                            />
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                setAddingSessionToPhase(null);
                                setNewSession({ session_date: "", label: "" });
                              }}
                              style={{
                                fontSize: 11,
                                color: "var(--color-text-secondary)",
                                background: "none",
                                border: "0.5px solid var(--color-border-tertiary)",
                                borderRadius: 4,
                                padding: "3px 10px",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAddSession()}
                              disabled={modalSaving || !newSession.session_date}
                              style={{
                                fontSize: 11,
                                color: "#000",
                                background: "#FFFA00",
                                border: "none",
                                borderRadius: 4,
                                padding: "3px 10px",
                                cursor: "pointer",
                                opacity: modalSaving || !newSession.session_date ? 0.5 : 1,
                              }}
                            >
                              {modalSaving ? "Saving..." : "Add"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            marginTop: 6,
                            marginLeft: 0,
                            marginBottom: 8,
                            display: "flex",
                            gap: 6,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => handleEditPhase(phase)}
                            style={{
                              fontSize: 11,
                              color: "var(--color-text-secondary)",
                              background: "none",
                              border: "0.5px solid var(--color-border-tertiary)",
                              borderRadius: 4,
                              padding: "2px 8px",
                              cursor: "pointer",
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingSessionToPhase(phase.id);
                              setNewSession({ session_date: phase.date_from ?? "", label: "" });
                              setEditingSession(null);
                            }}
                            style={{
                              fontSize: 11,
                              color: "#FFFA00",
                              background: "none",
                              border: "0.5px solid #FFFA00",
                              borderRadius: 4,
                              padding: "2px 8px",
                              cursor: "pointer",
                            }}
                          >
                            + Session
                          </button>
                          <button
                            type="button"
                            onClick={() => setAddingWorkBlockToPhase(phase.id)}
                            style={{
                              fontSize: 11,
                              color: "#60a5fa",
                              background: "none",
                              border: "0.5px solid #2a2a4e",
                              borderRadius: 4,
                              padding: "2px 8px",
                              cursor: "pointer",
                            }}
                          >
                            + Work block
                          </button>
                        </div>
                      )
                    ) : null}
                  </div>
                );
              })}
            </div>
            {selectedProject.notes ? (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  fontStyle: "italic",
                }}
              >
                {selectedProject.notes}
              </p>
            ) : null}
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => setSelectedProject(null)} className={btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form nuovo progetto */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowForm(false)}
          role="presentation"
        >
          <div
            style={{
              background: "#0d0d0d",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 8,
              width: "100%",
              maxWidth: 700,
              maxHeight: "90vh",
              overflowY: "auto",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: "var(--color-text-primary)",
                marginBottom: 20,
              }}
            >
              New project
            </h3>
            {formError ? (
              <p
                style={{
                  marginBottom: 12,
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "#2e0a0a",
                  border: "0.5px solid #f87171",
                  color: "#f87171",
                  fontSize: 12,
                }}
              >
                {formError}
              </p>
            ) : null}

            {/* Info base */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 12,
                marginBottom: 20,
              }}
            >
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Project name *
                </label>
                <input
                  className={inputClass}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. CULT"
                />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Client
                </label>
                <input
                  className={inputClass}
                  value={form.client ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, client: e.target.value || null }))}
                  placeholder="e.g. EBAY"
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Type
                </label>
                <select
                  className={inputClass}
                  value={form.project_type}
                  onChange={(e) => setForm((f) => ({ ...f, project_type: e.target.value }))}
                >
                  {PROJECT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Total episodes
                </label>
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  value={form.total_episodes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, total_episodes: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <label
                  style={{
                    fontSize: 13,
                    color: "var(--color-text-secondary)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Notes
                </label>
                <input
                  className={inputClass}
                  value={form.notes ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))}
                  placeholder="optional"
                />
              </div>
            </div>

            {/* Fasi */}
            <div style={{ marginBottom: 16 }}>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: "var(--color-text-secondary)",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                PHASES — SET DATES (LEAVE EMPTY IF NOT APPLICABLE)
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {form.phases.map((ph, i) => (
                  <div
                    key={ph.phase_name}
                    style={{
                      borderRadius: 6,
                      border: "0.5px solid var(--color-border-tertiary)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "6px 10px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: PHASE_COLORS[ph.phase_name].bg,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 13, color: "var(--color-text-primary)", minWidth: 130 }}>
                        {PHASE_LABELS[ph.phase_name]}
                      </span>
                      <input
                        type="date"
                        className="rounded border border-[#222] bg-[#141414] px-3 py-2.5 text-sm text-white focus:border-[#FFFA00] focus:outline-none"
                        value={ph.date_from ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            phases: f.phases.map((p, j) =>
                              j === i ? { ...p, date_from: e.target.value || null } : p
                            ),
                          }))
                        }
                      />
                      <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>→</span>
                      <input
                        type="date"
                        className="rounded border border-[#222] bg-[#141414] px-3 py-2.5 text-sm text-white focus:border-[#FFFA00] focus:outline-none"
                        value={ph.date_to ?? ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            phases: f.phases.map((p, j) =>
                              j === i ? { ...p, date_to: e.target.value || null } : p
                            ),
                          }))
                        }
                      />
                      <select
                        className="rounded border border-[#222] bg-[#141414] px-3 py-2.5 text-sm text-white focus:outline-none"
                        value={ph.status}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            phases: f.phases.map((p, j) =>
                              j === i ? { ...p, status: e.target.value as PhaseStatus } : p
                            ),
                          }))
                        }
                      >
                        <option value="PLANNED">Planned</option>
                        <option value="IN_PROGRESS">In progress</option>
                        <option value="COMPLETED">Completed</option>
                      </select>
                    </div>
                    {(ph.date_from || ph.date_to) ? (
                      <div style={{ marginLeft: 20, marginTop: 4, marginBottom: 8 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedPhases((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              return next;
                            });
                          }}
                          style={{
                            fontSize: 11,
                            color: "var(--color-text-secondary)",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          {expandedPhases.has(i) ? "▾" : "▸"} Sessions ({ph.sessions?.length ?? 0})
                        </button>
                        {expandedPhases.has(i) ? (
                          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                            {(ph.sessions ?? []).map((s, si) => (
                              <div key={si} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <input
                                  type="date"
                                  className="rounded border border-[#222] bg-[#141414] px-3 py-2.5 text-sm text-white focus:border-[#FFFA00] focus:outline-none"
                                  value={s.session_date}
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      phases: f.phases.map((p, j) =>
                                        j === i
                                          ? {
                                              ...p,
                                              sessions: (p.sessions ?? []).map((ss, k) =>
                                                k === si ? { ...ss, session_date: e.target.value } : ss
                                              ),
                                            }
                                          : p
                                      ),
                                    }))
                                  }
                                />
                                <input
                                  className="w-32 rounded border border-[#222] bg-[#141414] px-3 py-2.5 text-sm text-white focus:border-[#FFFA00] focus:outline-none"
                                  placeholder="Label (e.g. Ep. 1)"
                                  value={s.label ?? ""}
                                  onChange={(e) =>
                                    setForm((f) => ({
                                      ...f,
                                      phases: f.phases.map((p, j) =>
                                        j === i
                                          ? {
                                              ...p,
                                              sessions: (p.sessions ?? []).map((ss, k) =>
                                                k === si ? { ...ss, label: e.target.value || null } : ss
                                              ),
                                            }
                                          : p
                                      ),
                                    }))
                                  }
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setForm((f) => ({
                                      ...f,
                                      phases: f.phases.map((p, j) =>
                                        j === i
                                          ? {
                                              ...p,
                                              sessions: (p.sessions ?? []).filter((_, k) => k !== si),
                                            }
                                          : p
                                      ),
                                    }))
                                  }
                                  style={{
                                    fontSize: 14,
                                    color: "#f87171",
                                    background: "none",
                                    border: "none",
                                    cursor: "pointer",
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  phases: f.phases.map((p, j) =>
                                    j === i
                                      ? {
                                          ...p,
                                          sessions: [
                                            ...(p.sessions ?? []),
                                            {
                                              session_date: p.date_from ?? "",
                                              label: null,
                                              status: "PLANNED",
                                            },
                                          ],
                                        }
                                      : p
                                  ),
                                }))
                              }
                              style={{
                                fontSize: 11,
                                color: "#FFFA00",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                textAlign: "left",
                              }}
                            >
                              + Add session
                            </button>
                          </div>
                        ) : null}
                        <div style={{ marginLeft: 0, marginTop: 4 }}>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedWorkBlocks((prev) => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                return next;
                              })
                            }
                            style={{
                              fontSize: 11,
                              color: "var(--color-text-secondary)",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            {expandedWorkBlocks.has(i) ? "▾" : "▸"} Work blocks (
                            {ph.work_blocks?.length ?? 0})
                          </button>
                          {expandedWorkBlocks.has(i) ? (
                            <div
                              style={{
                                marginTop: 6,
                                display: "flex",
                                flexDirection: "column",
                                gap: 4,
                              }}
                            >
                              {(ph.work_blocks ?? []).length > 0 ? (
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 80px 60px 60px 24px",
                                    gap: 4,
                                    marginBottom: 4,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: "var(--color-text-secondary)",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    Role
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: "var(--color-text-secondary)",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    Location
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: "var(--color-text-secondary)",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    Qty
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 10,
                                      color: "var(--color-text-secondary)",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.05em",
                                    }}
                                  >
                                    Hrs
                                  </span>
                                  <span />
                                </div>
                              ) : null}
                              {(ph.work_blocks ?? []).map((wb, wi) => (
                                <div
                                  key={wi}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 80px 60px 60px 24px",
                                    gap: 4,
                                    alignItems: "center",
                                  }}
                                >
                                  <span style={{ fontSize: 12, color: "var(--color-text-primary)" }}>
                                    {wb.role_code}
                                  </span>
                                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                                    {wb.location}
                                  </span>
                                  <span style={{ fontSize: 12, color: "var(--color-text-primary)" }}>
                                    {wb.quantity}
                                  </span>
                                  <span style={{ fontSize: 12, color: "var(--color-text-primary)" }}>
                                    {wb.hours_per_session}h
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setForm((f) => ({
                                        ...f,
                                        phases: f.phases.map((p, j) =>
                                          j === i
                                            ? {
                                                ...p,
                                                work_blocks: (p.work_blocks ?? []).filter((_, k) => k !== wi),
                                              }
                                            : p
                                        ),
                                      }))
                                    }
                                    style={{
                                      fontSize: 14,
                                      color: "#f87171",
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: 0,
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              <WorkBlockAddRow
                                availableRoles={availableRoles}
                                onAdd={(wb) =>
                                  setForm((f) => ({
                                    ...f,
                                    phases: f.phases.map((p, j) =>
                                      j === i
                                        ? {
                                            ...p,
                                            work_blocks: [...(p.work_blocks ?? []), wb],
                                          }
                                        : p
                                    ),
                                  }))
                                }
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setShowForm(false)} disabled={saving} className={btnSecondary}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProject()}
                disabled={saving}
                className={btnPrimary}
              >
                {saving ? "Saving..." : "Save project"}
              </button>
            </div>
          </div>
        </div>
      )}
      {sessionTooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              onMouseEnter={cancelClearTooltip}
              onMouseLeave={scheduleClearTooltip}
              style={{
                position: "fixed",
                top: sessionTooltip.y - 8,
                left: sessionTooltip.x,
                transform: "translate(-50%, -100%)",
                zIndex: 100,
                background: "#1a1a1a",
                border: "0.5px solid #333",
                borderRadius: 8,
                padding: "8px 12px",
                minWidth: 160,
                pointerEvents: "auto",
                boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 500, color: "#fff", marginBottom: 4 }}>
                {sessionTooltip.session.label ?? formatDisplayDate(sessionTooltip.session.session_date)}
              </div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>
                {PHASE_LABELS[sessionTooltip.phaseName]}
              </div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 2 }}>
                {formatDisplayDate(sessionTooltip.session.session_date)}
                {sessionTooltip.session.date_to
                  ? ` → ${formatDisplayDate(sessionTooltip.session.date_to)}`
                  : ""}
              </div>
              <div
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 3,
                  marginTop: 4,
                  display: "inline-block",
                  background:
                    sessionTooltip.session.status === "COMPLETED" ? "#1a2e1a" : "#1e1e1e",
                  color: sessionTooltip.session.status === "COMPLETED" ? "#4ade80" : "#888",
                  border: `0.5px solid ${
                    sessionTooltip.session.status === "COMPLETED" ? "#4ade80" : "#333"
                  }`,
                }}
              >
                {sessionTooltip.session.status === "COMPLETED"
                  ? "✓ Completed"
                  : sessionTooltip.session.status === "IN_PROGRESS"
                    ? "● In progress"
                    : "○ Planned"}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
