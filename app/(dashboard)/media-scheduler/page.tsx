"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import PageLoading from "@/components/ui/PageLoading";
import {
  createShift,
  createTask,
  deleteShift,
  fetchShifts,
  fetchUnassigned,
  updateShift,
  updateTask,
  type EditingShift,
  type EditingTask,
  type TaskType,
} from "@/lib/api/editingScheduler";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import { fetchStaff, type StaffItem } from "@/lib/api/staff";

type TaskModalUiType = "HL" | "GOL_COLLECTION" | "INTERVISTE" | "ALTRO";

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

const inputCls =
  "rounded border border-[#222] bg-[#141414] px-3 py-2 text-sm text-white focus:border-[#FFFA00] focus:outline-none";
const btnPrimary =
  "rounded bg-[#FFFA00] px-4 py-2 text-sm font-medium text-black hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "rounded border border-[#333] px-4 py-2 text-sm text-[#aaa] hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50";

const columnCard: CSSProperties = {
  background: "#111",
  border: "0.5px solid #2a2a2a",
  borderRadius: 8,
  padding: 10,
  display: "flex",
  flexDirection: "column",
  minHeight: 0,
};

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/** DD/MM – DD/MM/YYYY */
function formatWeekRangeLabel(startIso: string, endIso: string): string {
  const [ys, ms, ds] = startIso.split("-");
  const [ye, me, de] = endIso.split("-");
  return `${ds}/${ms} – ${de}/${me}/${ye}`;
}

function formatDayTitle(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const weekday = d.toLocaleDateString("it-IT", { weekday: "short" });
  const day = d.toLocaleDateString("it-IT", { day: "2-digit" });
  const month = d.toLocaleDateString("it-IT", { month: "short" });
  return `${weekday} ${day} ${month}`;
}

function taskLabel(task: EditingTask): string {
  if (task.label && task.label.trim()) return task.label;
  if (task.event)
    return `${task.event.home_team_name_short ?? "?"} vs ${task.event.away_team_name_short ?? "?"}`;
  return task.task_type;
}

function eventSubtitle(task: EditingTask): string | null {
  if (!task.event_id || !task.event) return null;
  const comp = task.event.competition_name ?? "";
  const teams = `${task.event.home_team_name_short ?? ""} vs ${task.event.away_team_name_short ?? ""}`.trim();
  return [comp, teams].filter(Boolean).join(" · ") || "Evento";
}

function shiftStatusDotColor(status: string | null | undefined): string {
  const s = String(status ?? "UNASSIGNED").toUpperCase();
  if (s === "ASSIGNED" || s === "CONFIRMED") return "#378ADD";
  if (s === "DONE" || s === "COMPLETED") return "#4ade80";
  return "#888888";
}

function pillBadgeStyle(taskType: string): CSSProperties {
  if (taskType === "HL") return { background: "#FFFA00", color: "#000", border: "none" };
  if (taskType === "GOL_COLLECTION")
    return { background: "#1a3a1a", color: "#4ade80", border: "0.5px solid #4ade80" };
  return { background: "#2a2a2a", color: "#888", border: "none" };
}

function unassignedBadgeStyle(taskType: string): CSSProperties {
  if (taskType === "HL") return { background: "#FFFA00", color: "#000" };
  if (taskType === "GOL_COLLECTION")
    return { background: "#1a3a1a", color: "#4ade80", border: "0.5px solid #4ade80" };
  return { background: "#2a2a2a", color: "#888" };
}

function displayTaskTypeShort(taskType: string): string {
  if (taskType === "TAGLIO_INTERVISTE") return "INTERVISTE";
  return taskType;
}

function mapUiTypeToApi(t: TaskModalUiType): TaskType {
  if (t === "INTERVISTE") return "TAGLIO_INTERVISTE";
  return t;
}

function primaryRoleLabel(staff: StaffItem): string {
  const roles = (staff.roles ?? []).filter((r) => r.active);
  const r0 = roles[0];
  if (!r0) return "—";
  return `${r0.roleCode} (${r0.location})`;
}

function cloneShifts(list: EditingShift[]): EditingShift[] {
  return list.map((s) => ({
    ...s,
    editing_tasks: [...(s.editing_tasks ?? [])],
  }));
}

function UnassignedTaskCard({ task }: { task: EditingTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unassigned-task-${task.id}`,
    data: { type: "unassigned-task", taskId: task.id, task },
  });
  const badge = unassignedBadgeStyle(task.task_type);
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.35 : 1,
        background: "#1a1a1a",
        border: "0.5px solid #2a2a2a",
        borderRadius: 6,
        padding: 8,
        marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span
          {...attributes}
          {...listeners}
          style={{ color: "#444", cursor: "grab", fontSize: 14, lineHeight: 1.2, flexShrink: 0 }}
        >
          ⠿
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, color: "#e5e5e5", flex: 1, minWidth: 0 }}>{taskLabel(task)}</span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
                flexShrink: 0,
                ...badge,
              }}
            >
              {displayTaskTypeShort(task.task_type)}
            </span>
          </div>
          {eventSubtitle(task) ? (
            <div style={{ fontSize: 10, color: "#888", marginTop: 4 }}>{eventSubtitle(task)}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ShiftCardInner({
  shift,
  canEdit,
  onAssign,
  onDeleteShift,
  onOpenTaskModal,
  onUnassignTask,
}: {
  shift: EditingShift;
  canEdit: boolean;
  onAssign: (shift: EditingShift) => void;
  onDeleteShift: (shiftId: number) => void;
  onOpenTaskModal: (shiftId: number) => void;
  onUnassignTask: (task: EditingTask) => void;
}) {
  const tasks = shift.editing_tasks ?? [];
  const { setNodeRef, isOver } = useDroppable({
    id: `shift-drop-${shift.id}`,
    data: { shiftId: shift.id },
  });

  const assignedName = shift.staff
    ? `${shift.staff.surname} ${shift.staff.name}`
    : shift.provider
      ? shift.provider.company ?? `${shift.provider.surname} ${shift.provider.name}`
      : null;

  const dotColor = shiftStatusDotColor(shift.status);

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "0.5px solid #2a2a2a",
        borderRadius: 6,
        padding: 8,
        marginBottom: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: dotColor, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: "#FFFA00", fontWeight: 600 }}>
          {shift.time_from.slice(0, 5)} – {shift.time_to.slice(0, 5)}
        </span>
      </div>
      <div style={{ fontSize: 10, color: assignedName ? "#e5e5e5" : "#f87171", marginBottom: 8 }}>
        {assignedName ?? "Unassigned"}
      </div>

      <div
        ref={setNodeRef}
        style={{
          border: tasks.length === 0 ? "1px dashed #2a2a2a" : "none",
          borderRadius: 6,
          padding: tasks.length === 0 ? "10px 8px" : 0,
          minHeight: tasks.length === 0 ? 40 : undefined,
          background: isOver ? "rgba(255,250,0,0.06)" : undefined,
          transition: "background 0.15s",
        }}
      >
        {tasks.length === 0 ? (
          <div style={{ fontSize: 11, color: "#444", textAlign: "center" }}>Drop tasks here</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {tasks.map((task) => (
              <div
                key={task.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#222",
                  borderRadius: 4,
                  padding: "4px 6px",
                  fontSize: 9,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: "#e5e5e5",
                  }}
                >
                  {taskLabel(task)}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    padding: "1px 5px",
                    borderRadius: 3,
                    flexShrink: 0,
                    fontSize: 8,
                    ...pillBadgeStyle(task.task_type),
                  }}
                >
                  {displayTaskTypeShort(task.task_type)}
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => onUnassignTask(task)}
                    style={{
                      fontSize: 12,
                      color: "#f87171",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "0 2px",
                      flexShrink: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      {canEdit ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          <button
            type="button"
            onClick={() => onAssign(shift)}
            style={{
              fontSize: 11,
              color: "#FFFA00",
              background: "none",
              border: "0.5px solid #FFFA00",
              borderRadius: 4,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            Assign
          </button>
          <button
            type="button"
            onClick={() => onOpenTaskModal(shift.id)}
            style={{
              fontSize: 11,
              color: "#e5e5e5",
              background: "none",
              border: "0.5px solid #3F4547",
              borderRadius: 4,
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            + Task
          </button>
          <button
            type="button"
            onClick={() => onDeleteShift(shift.id)}
            style={{
              fontSize: 14,
              color: "#f87171",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "2px 8px",
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function MediaSchedulerPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const [startDate, setStartDate] = useState(() => toIsoDate(new Date()));
  const [daysCount] = useState(7);

  const [shifts, setShifts] = useState<EditingShift[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<EditingTask[]>([]);
  const [activeDragTask, setActiveDragTask] = useState<EditingTask | null>(null);

  const [shiftModalOpenForDate, setShiftModalOpenForDate] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState({ time_from: "08:00", time_to: "16:00", notes: "" });
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalShiftId, setTaskModalShiftId] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState<{ task_type: TaskModalUiType; label: string; event_id: string }>({
    task_type: "HL",
    label: "",
    event_id: "",
  });

  const [assignShiftModal, setAssignShiftModal] = useState<EditingShift | null>(null);
  const [staffQuery, setStaffQuery] = useState("");
  const [staffResults, setStaffResults] = useState<StaffItem[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const days = useMemo(() => Array.from({ length: daysCount }, (_, i) => addDays(startDate, i)), [startDate, daysCount]);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, shiftsData, unassigned] = await Promise.all([
        fetchAuthMe(),
        fetchShifts({ from: startDate, to: addDays(startDate, daysCount - 1) }),
        fetchUnassigned(),
      ]);
      const level = (me.user_level ?? "").toUpperCase();
      setCanEdit(level === "MASTER" || level === "MANAGER");
      setShifts(shiftsData);
      setUnassignedTasks((unassigned.tasks ?? []).filter((t) => t.shift_id == null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento scheduler");
    } finally {
      setLoading(false);
    }
  }, [startDate, daysCount]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!assignShiftModal) return;
    let cancelled = false;
    const h = setTimeout(async () => {
      setStaffLoading(true);
      try {
        const data = await fetchStaff({ q: staffQuery.trim(), limit: 20, includeRoles: true });
        if (!cancelled) setStaffResults(data.items ?? []);
      } catch {
        if (!cancelled) setStaffResults([]);
      } finally {
        if (!cancelled) setStaffLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(h);
    };
  }, [assignShiftModal, staffQuery]);

  const shiftsByDay = useMemo(() => {
    const m = new Map<string, EditingShift[]>();
    for (const day of days) m.set(day, []);
    for (const s of shifts) {
      const cur = m.get(s.date) ?? [];
      cur.push(s);
      m.set(s.date, cur);
    }
    for (const [k, v] of m.entries()) {
      v.sort((a, b) => a.time_from.localeCompare(b.time_from));
      m.set(k, v);
    }
    return m;
  }, [days, shifts]);

  const openShiftModal = (day: string) => {
    setShiftForm({ time_from: "08:00", time_to: "16:00", notes: "" });
    setShiftModalOpenForDate(day);
  };

  const handleCreateShift = async () => {
    if (!shiftModalOpenForDate) return;
    setSaving(true);
    setError(null);
    try {
      await createShift({
        date: shiftModalOpenForDate,
        time_from: `${shiftForm.time_from}:00`,
        time_to: `${shiftForm.time_to}:00`,
        notes: shiftForm.notes.trim() || null,
      });
      setShiftModalOpenForDate(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore creazione turno";
      setError(msg);
      showToast(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async () => {
    setSaving(true);
    setError(null);
    try {
      const apiType = mapUiTypeToApi(taskForm.task_type);
      await createTask({
        shift_id: taskModalShiftId,
        task_type: apiType,
        label: taskForm.label.trim() || null,
        event_id: taskForm.event_id.trim() || null,
      });
      setTaskModalOpen(false);
      setTaskModalShiftId(null);
      setTaskForm({ task_type: "HL", label: "", event_id: "" });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore creazione task";
      setError(msg);
      showToast(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
    if (!window.confirm("Eliminare questo turno?")) return;
    setSaving(true);
    try {
      await deleteShift(shiftId);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore eliminazione turno";
      setError(msg);
      showToast(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleUnassignTask = async (task: EditingTask) => {
    const shiftId = task.shift_id;
    if (shiftId == null) return;
    const prevU = [...unassignedTasks];
    const prevS = cloneShifts(shifts);
    const moved: EditingTask = { ...task, shift_id: null };
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? { ...s, editing_tasks: (s.editing_tasks ?? []).filter((t) => t.id !== task.id) }
          : s
      )
    );
    setUnassignedTasks((prev) => [...prev, moved]);
    try {
      await updateTask(task.id, { shift_id: null });
      await load();
    } catch (e) {
      setUnassignedTasks(prevU);
      setShifts(prevS);
      const msg = e instanceof Error ? e.message : "Errore rimozione task dal turno";
      showToast(msg);
    }
  };

  const handleAssignStaff = async (staffId: number | null) => {
    if (!assignShiftModal) return;
    setSaving(true);
    try {
      await updateShift(assignShiftModal.id, {
        staff_id: staffId,
        status: staffId ? "ASSIGNED" : "UNASSIGNED",
      });
      setAssignShiftModal(null);
      setStaffQuery("");
      setStaffResults([]);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore assegnazione staff";
      setError(msg);
      showToast(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = event.active.data.current?.task as EditingTask | undefined;
    if (task) setActiveDragTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const taskId = event.active.data.current?.taskId as number | undefined;
    const shiftId = event.over?.data.current?.shiftId as number | undefined;
    setActiveDragTask(null);
    if (!taskId || !shiftId) return;

    const movedTask = unassignedTasks.find((t) => t.id === taskId);
    if (!movedTask) return;

    const prevU = [...unassignedTasks];
    const prevS = cloneShifts(shifts);

    setUnassignedTasks((prev) => prev.filter((t) => t.id !== taskId));
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? {
              ...s,
              editing_tasks: [...(s.editing_tasks ?? []), { ...movedTask, shift_id: shiftId }],
            }
          : s
      )
    );

    try {
      await updateTask(taskId, { shift_id: shiftId });
    } catch (e) {
      setUnassignedTasks(prevU);
      setShifts(prevS);
      const msg = e instanceof Error ? e.message : "Errore spostamento task";
      showToast(msg);
    }
  };

  if (loading) return <PageLoading />;

  const endIso = addDays(startDate, daysCount - 1);
  const rangeLabel = formatWeekRangeLabel(startDate, endIso);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 56px)",
          minHeight: 400,
          overflow: "hidden",
          padding: "16px 24px",
        }}
      >
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 12,
          }}
        >
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: 0,
            }}
          >
            Media Content Scheduler
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setStartDate((d) => addDays(d, -7))}
              style={{
                background: "none",
                border: "0.5px solid #3F4547",
                borderRadius: 4,
                color: "#aaa",
                width: 28,
                height: 28,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ‹
            </button>
            <span style={{ fontSize: 14, color: "#fff", fontWeight: 500 }}>{rangeLabel}</span>
            <button
              type="button"
              onClick={() => setStartDate((d) => addDays(d, 7))}
              style={{
                background: "none",
                border: "0.5px solid #3F4547",
                borderRadius: 4,
                color: "#aaa",
                width: 28,
                height: 28,
                cursor: "pointer",
                fontSize: 16,
              }}
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setStartDate(toIsoDate(new Date()))}
              style={{
                background: "#FFFA00",
                border: "none",
                borderRadius: 4,
                color: "#000",
                padding: "6px 14px",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Today
            </button>
          </div>
        </div>

        {error ? (
          <div style={{ flexShrink: 0, fontSize: 12, color: "#f87171", marginBottom: 8 }}>{error}</div>
        ) : null}

        <div style={{ flex: 1, minHeight: 0, overflowX: "auto", overflowY: "hidden" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "stretch", height: "100%", paddingBottom: 4 }}>
            {/* UNASSIGNED */}
            <div style={{ ...columnCard, flex: "0 0 220px", maxHeight: "100%" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#888", letterSpacing: "0.06em" }}>
                  UNASSIGNED
                </span>
                {canEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskModalShiftId(null);
                      setTaskModalOpen(true);
                      setTaskForm({ task_type: "HL", label: "", event_id: "" });
                    }}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#000",
                      background: "#FFFA00",
                      border: "none",
                      borderRadius: 4,
                      padding: "4px 10px",
                      cursor: "pointer",
                    }}
                  >
                    + Task
                  </button>
                ) : null}
              </div>
              <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                {unassignedTasks.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#555", fontStyle: "italic" }}>Nessun task</div>
                ) : (
                  unassignedTasks.map((task) => <UnassignedTaskCard key={task.id} task={task} />)
                )}
              </div>
            </div>

            {/* Days */}
            {days.map((day) => {
              const dayShifts = shiftsByDay.get(day) ?? [];
              const totalTasks = dayShifts.reduce((acc, s) => acc + (s.editing_tasks?.length ?? 0), 0);
              return (
                <div key={day} style={{ ...columnCard, flex: "0 0 200px", maxHeight: "100%" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#fff", fontWeight: 500 }}>{formatDayTitle(day)}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                        {dayShifts.length} shifts · {totalTasks} tasks
                      </div>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => openShiftModal(day)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#FFFA00",
                          background: "none",
                          border: "0.5px solid #FFFA00",
                          borderRadius: 4,
                          padding: "4px 8px",
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        + Shift
                      </button>
                    ) : null}
                  </div>
                  <div style={{ flex: 1, overflowY: "auto", minHeight: 0, marginBottom: 8 }}>
                    {dayShifts.map((shift) => (
                      <ShiftCardInner
                        key={shift.id}
                        shift={shift}
                        canEdit={canEdit}
                        onAssign={(s) => {
                          setAssignShiftModal(s);
                          setStaffQuery("");
                          setStaffResults([]);
                        }}
                        onDeleteShift={(id) => void handleDeleteShift(id)}
                        onOpenTaskModal={(shiftId) => {
                          setTaskModalShiftId(shiftId);
                          setTaskModalOpen(true);
                          setTaskForm({ task_type: "HL", label: "", event_id: "" });
                        }}
                        onUnassignTask={(t) => void handleUnassignTask(t)}
                      />
                    ))}
                  </div>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => openShiftModal(day)}
                      style={{
                        flexShrink: 0,
                        width: "100%",
                        padding: "8px",
                        fontSize: 11,
                        color: "#555",
                        background: "transparent",
                        border: "1px dashed #3F4547",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      + Shift
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeDragTask ? (
          <div
            style={{
              background: "#1a1a1a",
              border: "0.5px solid #FFFA00",
              borderRadius: 6,
              padding: 8,
              maxWidth: 200,
              boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: 11, color: "#e5e5e5" }}>{taskLabel(activeDragTask)}</div>
          </div>
        ) : null}
      </DragOverlay>

      {toast ? (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            background: "#1a1a1a",
            border: "0.5px solid #f87171",
            color: "#fca5a5",
            padding: "10px 16px",
            borderRadius: 8,
            fontSize: 13,
            maxWidth: 420,
            boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {shiftModalOpenForDate ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
          }}
          onClick={() => setShiftModalOpenForDate(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: 8,
              border: "0.5px solid #2a2a2a",
              background: "#0d0d0d",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Nuovo turno</h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Data</div>
              <div style={{ fontSize: 14, color: "#e5e5e5" }}>{formatDayTitle(shiftModalOpenForDate)}</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Dalle</div>
                <select
                  className={inputCls}
                  style={{ width: "100%" }}
                  value={shiftForm.time_from}
                  onChange={(e) => setShiftForm((v) => ({ ...v, time_from: e.target.value }))}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Alle</div>
                <select
                  className={inputCls}
                  style={{ width: "100%" }}
                  value={shiftForm.time_to}
                  onChange={(e) => setShiftForm((v) => ({ ...v, time_to: e.target.value }))}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Note</div>
              <textarea
                className={inputCls}
                style={{ width: "100%", minHeight: 72 }}
                value={shiftForm.notes}
                onChange={(e) => setShiftForm((v) => ({ ...v, notes: e.target.value }))}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className={btnSecondary} onClick={() => setShiftModalOpenForDate(null)} disabled={saving}>
                Annulla
              </button>
              <button type="button" className={btnPrimary} onClick={() => void handleCreateShift()} disabled={saving}>
                {saving ? "…" : "Crea turno"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {taskModalOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
          }}
          onClick={() => setTaskModalOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: 8,
              border: "0.5px solid #2a2a2a",
              background: "#0d0d0d",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 16 }}>
              {taskModalShiftId !== null ? "Aggiungi task al turno" : "Nuovo task"}
            </h3>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Tipo</div>
              <select
                className={inputCls}
                style={{ width: "100%" }}
                value={taskForm.task_type}
                onChange={(e) => setTaskForm((v) => ({ ...v, task_type: e.target.value as TaskModalUiType }))}
              >
                <option value="HL">HL</option>
                <option value="GOL_COLLECTION">GOL_COLLECTION</option>
                <option value="INTERVISTE">INTERVISTE</option>
                <option value="ALTRO">ALTRO</option>
              </select>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Label</div>
              <input
                className={inputCls}
                style={{ width: "100%" }}
                value={taskForm.label}
                onChange={(e) => setTaskForm((v) => ({ ...v, label: e.target.value }))}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>Event ID (opzionale)</div>
              <input
                className={inputCls}
                style={{ width: "100%" }}
                value={taskForm.event_id}
                onChange={(e) => setTaskForm((v) => ({ ...v, event_id: e.target.value }))}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                className={btnSecondary}
                onClick={() => {
                  setTaskModalOpen(false);
                  setTaskModalShiftId(null);
                  setTaskForm({ task_type: "HL", label: "", event_id: "" });
                }}
                disabled={saving}
              >
                Annulla
              </button>
              <button type="button" className={btnPrimary} onClick={() => void handleCreateTask()} disabled={saving}>
                {saving ? "…" : "Crea"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assignShiftModal ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.7)",
          }}
          onClick={() => setAssignShiftModal(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{
              width: "100%",
              maxWidth: 480,
              borderRadius: 8,
              border: "0.5px solid #2a2a2a",
              background: "#0d0d0d",
              padding: 24,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#fff", marginBottom: 16 }}>Assegna persona</h3>
            <input
              className={inputCls}
              style={{ width: "100%", marginBottom: 12 }}
              placeholder="Cerca staff…"
              value={staffQuery}
              onChange={(e) => setStaffQuery(e.target.value)}
            />
            <div style={{ maxHeight: 280, overflowY: "auto", border: "0.5px solid #2a2a2a", borderRadius: 6 }}>
              {staffLoading ? (
                <div style={{ padding: 12, fontSize: 12, color: "#888" }}>Caricamento…</div>
              ) : staffResults.length === 0 ? (
                <div style={{ padding: 12, fontSize: 12, color: "#888" }}>Nessun risultato</div>
              ) : (
                staffResults.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => void handleAssignStaff(staff.id)}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "10px 12px",
                      border: "none",
                      borderBottom: "0.5px solid #1a1a1a",
                      background: "transparent",
                      cursor: "pointer",
                      color: "#fff",
                    }}
                  >
                    <div style={{ fontSize: 14 }}>
                      {staff.surname} {staff.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>
                      {primaryRoleLabel(staff)} · {staff.company ?? "—"}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
              <div>
                {assignShiftModal.staff_id ? (
                  <button
                    type="button"
                    onClick={() => void handleAssignStaff(null)}
                    style={{ fontSize: 12, color: "#f87171", background: "none", border: "none", cursor: "pointer" }}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <button type="button" className={btnSecondary} onClick={() => setAssignShiftModal(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DndContext>
  );
}
