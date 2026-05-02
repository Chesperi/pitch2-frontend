"use client";
import { useEffect, useMemo, useState } from "react";
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
  type Project,
  type ProjectPhase,
  type ProjectPayload,
  type PhaseName,
  type PhaseStatus,
  PHASE_COLORS,
  PHASE_LABELS,
  ALL_PHASES,
  PROJECT_TYPE_COLORS,
} from "@/lib/api/projects";

// Helper date
function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getDaysToShow(z: "W" | "M" | "Q"): number {
  return z === "W" ? 42 : z === "M" ? 84 : 168;
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
  const [editingPhase, setEditingPhase] = useState<{
    id: number;
    date_from: string;
    date_to: string;
    status: PhaseStatus;
    episodes_completed: number;
    notes: string;
  } | null>(null);
  const [addingSessionToPhase, setAddingSessionToPhase] = useState<number | null>(null);
  const [newSession, setNewSession] = useState({ session_date: "", label: "" });
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  // Calendar
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const today = useMemo(() => new Date(), []);

  // Carica progetti
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchProjects();
        if (!cancelled) setProjects(data);
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

  function getProgress(p: Project) {
    const onAirPhase = p.project_phases.find((ph) => ph.phase_name === "ON_AIR");
    const sessions = onAirPhase?.project_phase_sessions ?? [];
    const onAirCount = sessions.filter((s) => s.status === "COMPLETED").length;
    const total = p.total_episodes;
    const pct = total > 0 ? Math.round((onAirCount / total) * 100) : 0;
    return { onAirCount, total, pct };
  }

  const handleEditPhase = (phase: ProjectPhase) => {
    setAddingSessionToPhase(null);
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
    let monthStart = 0;
    timelineDates.forEach((d, i) => {
      if (d.getMonth() !== currentMonth) {
        if (currentMonth !== -1) {
          labels.push({
            label: d.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
            startPct: (monthStart / totalDays) * 100,
            widthPct: ((i - monthStart) / totalDays) * 100,
          });
        }
        currentMonth = d.getMonth();
        monthStart = i;
      }
    });
    labels.push({
      label: timelineDates[totalDays - 1].toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
      startPct: (monthStart / totalDays) * 100,
      widthPct: ((totalDays - monthStart) / totalDays) * 100,
    });
    return labels;
  }, [timelineDates, totalDays]);

  const todayPct = dateToPct(toIsoDate(today));

  const inputClass =
    "w-full rounded border border-[#222] bg-[#141414] px-3 py-2 text-sm text-white focus:border-[#FFFA00] focus:outline-none";
  const btnPrimary =
    "rounded bg-[#FFFA00] px-4 py-2 text-sm font-medium text-black hover:bg-yellow-200 disabled:opacity-50";
  const btnSecondary = "rounded border border-[#333] px-4 py-2 text-sm text-[#aaa] hover:bg-[#1a1a1a]";

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
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "var(--color-background-secondary)",
            borderRadius: 8,
            padding: 3,
          }}
        >
          {(["gantt", "calendar"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              style={{
                padding: "4px 14px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                border: "none",
                background: view === v ? "var(--color-background-primary)" : "transparent",
                color: view === v ? "var(--color-text-primary)" : "var(--color-text-secondary)",
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
              {(["W", "M", "Q"] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZoom(z)}
                  style={{
                    background: zoom === z ? "var(--color-background-primary)" : "none",
                    border: "0.5px solid var(--color-border-tertiary)",
                    borderRadius: 4,
                    color: zoom === z ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                    width: 28,
                    height: 28,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {z}
                </button>
              ))}
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
                    fontSize: 11,
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
                    fontSize: 11,
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
                          fontSize: 11,
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
                        zoom === "W" ||
                        (zoom === "M" && (d.getDate() === 1 || d.getDate() % 7 === 0)) ||
                        (zoom === "Q" && (d.getDate() === 1 || d.getDate() % 14 === 0));
                      if (!showLabel) return null;
                      return (
                        <span
                          key={i}
                          style={{
                            position: "absolute",
                            left: `${pct}%`,
                            fontSize: 10,
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
                  const { onAirCount, total, pct } = getProgress(project);
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
                            minWidth: 200,
                            padding: "8px 12px",
                            borderRight: "1px solid var(--color-border-tertiary)",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span
                              style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 3,
                                background: PROJECT_TYPE_COLORS[project.project_type] ?? "#888",
                                color: "#fff",
                                fontWeight: 500,
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
                              }}
                              onClick={() => setSelectedProject(project)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") setSelectedProject(project);
                              }}
                            >
                              {project.name}
                            </span>
                          </div>
                          {project.client ? (
                            <span style={{ fontSize: 10, color: "var(--color-text-secondary)", display: "block", marginTop: 4 }}>
                              {project.client}
                            </span>
                          ) : null}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                            <span style={{ fontSize: 11, color: "var(--color-text-info)" }}>
                              {onAirCount}/{total} on air
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
                                  width: `${pct}%`,
                                  background: "#639922",
                                  borderRadius: 2,
                                }}
                              />
                            </div>
                            <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>{pct}%</span>
                          </div>
                        </div>
                        <div
                          style={{
                            minWidth: 110,
                            borderRight: "1px solid var(--color-border-tertiary)",
                          }}
                        />
                        <div style={{ flex: 1, padding: "8px 12px" }}>
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
                    const colors = PHASE_COLORS[phase.phase_name as PhaseName];
                    const opacity =
                      phase.status === "COMPLETED"
                        ? 1
                        : phase.status === "IN_PROGRESS"
                          ? 0.85
                          : 0.4;

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
                              minWidth: 200,
                              padding: "8px 12px",
                              borderRight: "1px solid var(--color-border-tertiary)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 10,
                                  padding: "1px 6px",
                                  borderRadius: 3,
                                  background: PROJECT_TYPE_COLORS[project.project_type] ?? "#888",
                                  color: "#fff",
                                  fontWeight: 500,
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
                                }}
                                onClick={() => setSelectedProject(project)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") setSelectedProject(project);
                                }}
                              >
                                {project.name}
                              </span>
                            </div>
                            {project.client ? (
                              <span style={{ fontSize: 10, color: "var(--color-text-secondary)", display: "block", marginTop: 4 }}>
                                {project.client}
                              </span>
                            ) : null}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                              <span style={{ fontSize: 11, color: "var(--color-text-info)" }}>
                                {onAirCount}/{total} on air
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
                                    width: `${pct}%`,
                                    background: "#639922",
                                    borderRadius: 2,
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                                {pct}%
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              minWidth: 200,
                              borderRight: "1px solid var(--color-border-tertiary)",
                            }}
                          />
                        )}

                        {/* Colonna fase */}
                        <div
                          style={{
                            minWidth: 110,
                            padding: "4px 8px",
                            borderRight: "1px solid var(--color-border-tertiary)",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <span style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>
                            {PHASE_LABELS[phase.phase_name as PhaseName]}
                          </span>
                        </div>

                        {/* Timeline */}
                        <div
                          style={{
                            flex: 1,
                            position: "relative",
                            height: 36,
                            display: "flex",
                            alignItems: "center",
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
                          {/* Barra fase */}
                          <div
                            style={{
                              position: "absolute",
                              left: `${leftPct}%`,
                              width: `${widthPct}%`,
                              height: 14,
                              borderRadius: 3,
                              background: colors?.bg ?? "#888",
                              opacity,
                              border: "none",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              fontWeight: 500,
                              color: colors?.text ?? "#fff",
                              overflow: "hidden",
                              whiteSpace: "nowrap",
                              padding: "0 6px",
                              zIndex: 1,
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
                              const sessionColors = PHASE_COLORS[phase.phase_name as PhaseName];
                              return (
                                <div
                                  key={session.id}
                                  title={session.label ?? session.session_date}
                                  style={{
                                    position: "absolute",
                                    left: `${sessionPct}%`,
                                    top: "50%",
                                    transform: "translate(-50%, -50%)",
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    background:
                                      session.status === "COMPLETED"
                                        ? sessionColors?.bg ?? "#888"
                                        : "transparent",
                                    border: `2px solid ${sessionColors?.bg ?? "#888"}`,
                                    zIndex: 3,
                                    cursor: "default",
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
          <p style={{ marginBottom: 12, fontSize: 13, color: "var(--color-text-secondary)" }}>
            Calendar integration coming soon
          </p>
          <MonthCalendar
            year={calendarMonth.getFullYear()}
            month={calendarMonth.getMonth()}
            onPrevMonth={() =>
              setCalendarMonth(
                new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1)
              )
            }
            onNextMonth={() =>
              setCalendarMonth(
                new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1)
              )
            }
          />
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
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
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
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-secondary)" }}>
                {getProgress(selectedProject).onAirCount}/{selectedProject.total_episodes} on air
              </span>
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
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 10px",
                      }}
                    >
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: colors.bg, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: "var(--color-text-primary)", minWidth: 130 }}>
                        {PHASE_LABELS[phaseName]}
                      </span>
                      {phase ? (
                        <>
                          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                            {phase.date_from ?? "—"} → {phase.date_to ?? "—"}
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
                          marginLeft: 20,
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
                            <span
                              key={s.id}
                              style={{
                                fontSize: 10,
                                padding: "1px 6px",
                                borderRadius: 3,
                                background: s.status === "COMPLETED" ? "#1a2e1a" : "#1e1e1e",
                                color: s.status === "COMPLETED" ? "#4ade80" : "#888",
                                border: "0.5px solid",
                                borderColor: s.status === "COMPLETED" ? "#4ade80" : "#333",
                              }}
                            >
                              {s.label ?? s.session_date}
                            </span>
                          ))}
                      </div>
                    ) : null}
                    {phase ? (
                      editingPhase?.id === phase.id ? (
                        <div style={{ marginTop: 8, marginLeft: 10, marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
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
                        <div style={{ marginTop: 8, marginLeft: 10, marginBottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
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
                        <div style={{ marginTop: 6, marginLeft: 10, marginBottom: 8, display: "flex", gap: 6 }}>
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
                              setEditingPhase(null);
                              setAddingSessionToPhase(phase.id);
                              setNewSession({ session_date: phase.date_from ?? "", label: "" });
                              setModalError(null);
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
                fontSize: 16,
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
                    fontSize: 11,
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
                    fontSize: 11,
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
                    fontSize: 11,
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
                    fontSize: 11,
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
                    fontSize: 11,
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
                  fontSize: 12,
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
                      <span style={{ fontSize: 12, color: "var(--color-text-primary)", minWidth: 130 }}>
                        {PHASE_LABELS[ph.phase_name]}
                      </span>
                      <input
                        type="date"
                        className="rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none"
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
                        className="rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none"
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
                        className="rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:outline-none"
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
                                  className="rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none"
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
                                  className="w-32 rounded border border-[#222] bg-[#141414] px-2 py-1 text-xs text-white focus:border-[#FFFA00] focus:outline-none"
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
    </div>
  );
}
