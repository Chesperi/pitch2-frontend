"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  type EditingSlotUnassigned,
  type TaskType,
} from "@/lib/api/editingScheduler";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";
import { fetchStaff, type StaffItem } from "@/lib/api/staff";

const TASK_TYPES: TaskType[] = ["HL", "GOL_COLLECTION", "TAGLIO_INTERVISTE", "PUNTATA", "ALTRO"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);
const inputCls =
  "rounded border border-[#222] bg-[#141414] px-3 py-2 text-sm text-white focus:border-[#FFFA00] focus:outline-none";
const btnPrimary =
  "rounded bg-[#FFFA00] px-4 py-2 text-sm font-medium text-black hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-50";
const btnSecondary =
  "rounded border border-[#333] px-4 py-2 text-sm text-[#aaa] hover:bg-[#1a1a1a] disabled:cursor-not-allowed disabled:opacity-50";

function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

function formatRangeDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function formatDayTitle(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  const weekday = d.toLocaleDateString("it-IT", { weekday: "short" });
  const day = d.toLocaleDateString("it-IT", { day: "2-digit" });
  const month = d.toLocaleDateString("it-IT", { month: "short" });
  return `${weekday} ${day} ${month}`;
}

function taskTypeColors(taskType: string): { bg: string; text: string } {
  if (taskType === "HL") return { bg: "#FFFA00", text: "#000" };
  if (taskType === "GOL_COLLECTION") return { bg: "#4ade80", text: "#042C53" };
  return { bg: "#3f4547", text: "#fff" };
}

function shiftStatusBadge(status: string | null | undefined): { label: string; bg: string; text: string } {
  const s = String(status ?? "UNASSIGNED").toUpperCase();
  if (s === "ASSIGNED") return { label: "ASSIGNED", bg: "#1a1a2e", text: "#60a5fa" };
  if (s === "DONE" || s === "COMPLETED") return { label: "DONE", bg: "#1a2e1a", text: "#4ade80" };
  return { label: "UNASSIGNED", bg: "#1e1e1e", text: "#888" };
}

function taskLabel(task: EditingTask): string {
  if (task.label && task.label.trim()) return task.label;
  if (task.event) return `${task.event.home_team_name_short ?? "?"} vs ${task.event.away_team_name_short ?? "?"}`;
  return task.task_type;
}

function primaryRoleLabel(staff: StaffItem): string {
  const roles = (staff.roles ?? []).filter((r) => r.active);
  const primary = roles.find((r) => r.isPrimary) ?? roles[0];
  if (!primary) return "—";
  return `${primary.roleCode} (${primary.location})`;
}

function UnassignedTaskCard({
  task,
}: {
  task: EditingTask;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unassigned-task-${task.id}`,
    data: { type: "unassigned-task", taskId: task.id },
  });
  const colors = taskTypeColors(task.task_type);
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.6 : 1,
        border: "1px solid #2a2a2a",
        borderRadius: 6,
        padding: "6px 8px",
        background: "#141414",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span {...attributes} {...listeners} style={{ color: "#888", cursor: "grab", fontSize: 12, lineHeight: 1 }}>
          ⠿
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            padding: "2px 6px",
            borderRadius: 4,
            background: colors.bg,
            color: colors.text,
          }}
        >
          {task.task_type}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--color-text-primary)", marginTop: 6 }}>{taskLabel(task)}</div>
      {task.event_id ? (
        <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 3 }}>
          {task.event?.competition_name ?? "Event"} {task.event?.matchday ? `· MD${task.event.matchday}` : ""}
        </div>
      ) : null}
    </div>
  );
}

function ShiftDropZone({
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
  const { setNodeRef, isOver } = useDroppable({
    id: `shift-drop-${shift.id}`,
    data: { shiftId: shift.id },
  });
  const statusBadge = shiftStatusBadge(shift.status);
  const assignedName = shift.staff
    ? `${shift.staff.surname} ${shift.staff.name}`
    : shift.provider
      ? (shift.provider.company ?? `${shift.provider.surname} ${shift.provider.name}`)
      : null;
  const tasks = shift.editing_tasks ?? [];

  return (
    <div
      style={{
        border: `1px solid ${isOver ? "#FFFA00" : "var(--color-border-tertiary)"}`,
        borderRadius: 8,
        padding: "10px 12px",
        background: isOver ? "rgba(255,250,0,0.04)" : "var(--color-background-primary)",
        transition: "border-color 0.15s",
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
          {shift.time_from.slice(0, 5)} – {shift.time_to.slice(0, 5)}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: "1px 6px",
            borderRadius: 3,
            background: statusBadge.bg,
            color: statusBadge.text,
            border: "0.5px solid #2a2a2a",
          }}
        >
          {statusBadge.label}
        </span>
        {assignedName ? (
          <span style={{ fontSize: 12, color: "#4ade80" }}>{assignedName}</span>
        ) : (
          <span style={{ fontSize: 11, color: "#f87171", fontStyle: "italic" }}>Unassigned</span>
        )}
        {canEdit ? (
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button type="button" onClick={() => onAssign(shift)} style={{ ...smallOutlineBtn, color: "#FFFA00", borderColor: "#FFFA00" }}>
              Assign
            </button>
            <button type="button" onClick={() => onOpenTaskModal(shift.id)} style={smallOutlineBtn}>
              + Task
            </button>
            <button type="button" onClick={() => onDeleteShift(shift.id)} style={{ ...smallTextBtn, color: "#f87171" }}>
              ×
            </button>
          </div>
        ) : null}
      </div>

      <div
        ref={setNodeRef}
        style={{
          border: `1px dashed ${isOver ? "#FFFA00" : "#2a2a2a"}`,
          borderRadius: 6,
          padding: "8px",
          minHeight: 42,
        }}
      >
        {tasks.length === 0 ? (
          <div style={{ fontSize: 11, color: "var(--color-text-secondary)", fontStyle: "italic" }}>Drop tasks here</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {tasks.map((task) => {
              const colors = taskTypeColors(task.task_type);
              return (
                <div
                  key={task.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    border: "1px solid #2a2a2a",
                    borderRadius: 5,
                    padding: "4px 6px",
                    background: "#141414",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: colors.bg,
                      color: colors.text,
                    }}
                  >
                    {task.task_type}
                  </span>
                  <span style={{ fontSize: 12, color: "var(--color-text-primary)", flex: 1 }}>{taskLabel(task)}</span>
                  {canEdit ? (
                    <button type="button" onClick={() => onUnassignTask(task)} style={{ ...smallTextBtn, color: "#f87171" }}>
                      ×
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const smallOutlineBtn: React.CSSProperties = {
  fontSize: 11,
  color: "var(--color-text-secondary)",
  background: "none",
  border: "0.5px solid var(--color-border-tertiary)",
  borderRadius: 4,
  padding: "2px 8px",
  cursor: "pointer",
};
const smallTextBtn: React.CSSProperties = {
  fontSize: 12,
  background: "none",
  border: "none",
  padding: "0 4px",
  cursor: "pointer",
};

export default function MediaSchedulerPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const [startDate, setStartDate] = useState(() => toIsoDate(new Date()));
  const [daysCount] = useState(7);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set([toIsoDate(new Date())]));

  const [shifts, setShifts] = useState<EditingShift[]>([]);
  const [unassignedTasks, setUnassignedTasks] = useState<EditingTask[]>([]);
  const [unassignedSlots, setUnassignedSlots] = useState<EditingSlotUnassigned[]>([]);
  const [activeDragTask, setActiveDragTask] = useState<EditingTask | null>(null);

  const [shiftModalOpenForDate, setShiftModalOpenForDate] = useState<string | null>(null);
  const [shiftForm, setShiftForm] = useState({ date: "", time_from: "08:00", time_to: "16:00", notes: "" });
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalShiftId, setTaskModalShiftId] = useState<number | null>(null);
  const [taskForm, setTaskForm] = useState<{ task_type: TaskType; label: string; event_id: string }>({
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
      setUnassignedTasks(unassigned.tasks ?? []);
      setUnassignedSlots(unassigned.slots ?? []);
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
    }, 220);
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

  const groupedUnassigned = useMemo(() => {
    const groups = new Map<string, EditingTask[]>();
    for (const t of unassignedTasks) {
      const key = t.task_type || "ALTRO";
      const list = groups.get(key) ?? [];
      list.push(t);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [unassignedTasks]);

  const openShiftModal = (day: string) => {
    setShiftForm({ date: day, time_from: "08:00", time_to: "16:00", notes: "" });
    setShiftModalOpenForDate(day);
  };

  const handleCreateShift = async () => {
    if (!shiftForm.date) return;
    setSaving(true);
    setError(null);
    try {
      await createShift({
        date: shiftForm.date,
        time_from: `${shiftForm.time_from}:00`,
        time_to: `${shiftForm.time_to}:00`,
        notes: shiftForm.notes.trim() || null,
      });
      setShiftModalOpenForDate(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore creazione turno");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async () => {
    setSaving(true);
    setError(null);
    try {
      await createTask({
        shift_id: taskModalShiftId,
        task_type: taskForm.task_type,
        label: taskForm.label.trim() || null,
        event_id: taskForm.event_id.trim() || null,
      });
      setTaskModalOpen(false);
      setTaskModalShiftId(null);
      setTaskForm({ task_type: "HL", label: "", event_id: "" });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore creazione task");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShift = async (shiftId: number) => {
    if (!window.confirm("Eliminare questo shift?")) return;
    setSaving(true);
    try {
      await deleteShift(shiftId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore eliminazione shift");
    } finally {
      setSaving(false);
    }
  };

  const handleUnassignTask = async (task: EditingTask) => {
    setSaving(true);
    try {
      await updateTask(task.id, { shift_id: null });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore rimozione task dallo shift");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignStaff = async (staffId: number | null) => {
    if (!assignShiftModal) return;
    setSaving(true);
    try {
      await updateShift(assignShiftModal.id, { staff_id: staffId });
      setAssignShiftModal(null);
      setStaffQuery("");
      setStaffResults([]);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore assegnazione staff");
    } finally {
      setSaving(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const taskId = event.active.data.current?.taskId as number | undefined;
    if (!taskId) return;
    const task = unassignedTasks.find((t) => t.id === taskId) ?? null;
    setActiveDragTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const taskId = event.active.data.current?.taskId as number | undefined;
    const shiftId = event.over?.data.current?.shiftId as number | undefined;
    setActiveDragTask(null);
    if (!taskId || !shiftId) return;

    const movedTask = unassignedTasks.find((t) => t.id === taskId);
    if (!movedTask) return;

    setUnassignedTasks((prev) => prev.filter((t) => t.id !== taskId));
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? { ...s, editing_tasks: [...(s.editing_tasks ?? []), { ...movedTask, shift_id: shiftId }] }
          : s
      )
    );

    try {
      await updateTask(taskId, { shift_id: shiftId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore spostamento task");
      await load();
    }
  };

  if (loading) return <PageLoading />;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ padding: 16 }}>
        <div style={{ marginBottom: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--color-text-primary)" }}>Media Content Scheduler</h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button type="button" onClick={() => setStartDate((d) => addDays(d, -7))} style={smallOutlineBtn}>
            ‹
          </button>
          <span style={{ fontSize: 14, color: "var(--color-text-primary)", fontWeight: 600 }}>
            {formatRangeDate(startDate)} – {formatRangeDate(addDays(startDate, daysCount - 1))}
          </span>
          <button type="button" onClick={() => setStartDate((d) => addDays(d, 7))} style={smallOutlineBtn}>
            ›
          </button>
          <button type="button" onClick={() => setStartDate(toIsoDate(new Date()))} style={{ ...smallOutlineBtn, color: "#000", background: "#FFFA00", borderColor: "#FFFA00" }}>
            Today
          </button>
          {error ? <span style={{ marginLeft: 8, fontSize: 12, color: "#f87171" }}>{error}</span> : null}
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <aside
            style={{
              width: 280,
              flexShrink: 0,
              position: "sticky",
              top: 8,
              maxHeight: "calc(100vh - 110px)",
              overflowY: "auto",
              border: "1px solid var(--color-border-tertiary)",
              borderRadius: 8,
              padding: 10,
              background: "#111",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--color-text-primary)", letterSpacing: "0.04em" }}>
                UNASSIGNED
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => {
                    setTaskModalShiftId(null);
                    setTaskModalOpen(true);
                    setTaskForm({ task_type: "HL", label: "", event_id: "" });
                  }}
                  style={{ ...smallOutlineBtn, color: "#FFFA00", borderColor: "#FFFA00" }}
                >
                  + Task
                </button>
              ) : null}
            </div>

            {groupedUnassigned.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                Nessun task unassigned
              </div>
            ) : (
              groupedUnassigned.map(([taskType, tasks]) => (
                <div key={taskType} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>{taskType}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {tasks.map((task) => (
                      <UnassignedTaskCard key={task.id} task={task} />
                    ))}
                  </div>
                </div>
              ))
            )}

            {unassignedSlots.length > 0 ? (
              <div style={{ marginTop: 12, borderTop: "1px solid #2a2a2a", paddingTop: 10 }}>
                <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>UNASSIGNED SLOTS</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {unassignedSlots.map((slot) => (
                    <div key={slot.id} style={{ border: "1px solid #2a2a2a", borderRadius: 5, padding: "6px 8px" }}>
                      <div style={{ fontSize: 11, color: "var(--color-text-primary)" }}>{slot.work_block?.role_code ?? slot.role_code}</div>
                      <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>{slot.location}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </aside>

          <section style={{ flex: 1, minWidth: 0 }}>
            {days.map((day) => {
              const dayShifts = shiftsByDay.get(day) ?? [];
              const totalTasks = dayShifts.reduce((acc, s) => acc + (s.editing_tasks?.length ?? 0), 0);
              const open = expandedDays.has(day);
              return (
                <div key={day} style={{ border: "1px solid var(--color-border-tertiary)", borderRadius: 8, marginBottom: 10, overflow: "hidden" }}>
                  <div style={{ padding: "8px 10px", background: "#141414", display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDays((prev) => {
                          const n = new Set(prev);
                          if (n.has(day)) n.delete(day);
                          else n.add(day);
                          return n;
                        })
                      }
                      style={{ ...smallTextBtn, color: "#888" }}
                    >
                      {open ? "▾" : "▸"}
                    </button>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", minWidth: 130 }}>
                      {formatDayTitle(day)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                      {dayShifts.length} shifts · {totalTasks} tasks
                    </div>
                    {canEdit ? (
                      <button type="button" onClick={() => openShiftModal(day)} style={{ ...smallOutlineBtn, marginLeft: "auto", color: "#FFFA00", borderColor: "#FFFA00" }}>
                        + Shift
                      </button>
                    ) : null}
                  </div>
                  {open ? (
                    <div style={{ padding: 10 }}>
                      {dayShifts.length === 0 ? (
                        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", fontStyle: "italic" }}>Nessuno shift</div>
                      ) : (
                        dayShifts.map((shift) => (
                          <ShiftDropZone
                            key={shift.id}
                            shift={shift}
                            canEdit={canEdit}
                            onAssign={(s) => {
                              setAssignShiftModal(s);
                              setStaffQuery("");
                              setStaffResults([]);
                            }}
                            onDeleteShift={handleDeleteShift}
                            onOpenTaskModal={(shiftId) => {
                              setTaskModalShiftId(shiftId);
                              setTaskModalOpen(true);
                              setTaskForm({ task_type: "HL", label: "", event_id: "" });
                            }}
                            onUnassignTask={(task) => void handleUnassignTask(task)}
                          />
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        </div>
      </div>

      <DragOverlay>{activeDragTask ? <UnassignedTaskCard task={activeDragTask} /> : null}</DragOverlay>

      {shiftModalOpenForDate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShiftModalOpenForDate(null)} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-base font-semibold text-white">New shift</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#888]">Date</label>
                <input className={inputCls} type="date" value={shiftForm.date} onChange={(e) => setShiftForm((v) => ({ ...v, date: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[#888]">From</label>
                  <select className={inputCls} value={shiftForm.time_from} onChange={(e) => setShiftForm((v) => ({ ...v, time_from: e.target.value }))}>
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#888]">To</label>
                  <select className={inputCls} value={shiftForm.time_to} onChange={(e) => setShiftForm((v) => ({ ...v, time_to: e.target.value }))}>
                    {HOURS.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#888]">Notes</label>
                <textarea className={inputCls} rows={3} value={shiftForm.notes} onChange={(e) => setShiftForm((v) => ({ ...v, notes: e.target.value }))} />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btnSecondary} onClick={() => setShiftModalOpenForDate(null)} disabled={saving}>
                Cancel
              </button>
              <button type="button" className={btnPrimary} onClick={() => void handleCreateShift()} disabled={saving}>
                {saving ? "..." : "Create shift"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {taskModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setTaskModalOpen(false)} role="presentation">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-md rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 text-base font-semibold text-white">
                {taskModalShiftId !== null ? "Add task to shift" : "New unassigned task"}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-[#888]">Task type</label>
                  <select className={inputCls} value={taskForm.task_type} onChange={(e) => setTaskForm((v) => ({ ...v, task_type: e.target.value as TaskType }))}>
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#888]">Label</label>
                  <input className={inputCls} value={taskForm.label} onChange={(e) => setTaskForm((v) => ({ ...v, label: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-[#888]">Event ID (optional)</label>
                  <input className={inputCls} value={taskForm.event_id} onChange={(e) => setTaskForm((v) => ({ ...v, event_id: e.target.value }))} />
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
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
                  Cancel
                </button>
                <button type="button" className={btnPrimary} onClick={() => void handleCreateTask()} disabled={saving}>
                  {saving ? "..." : "Create task"}
                </button>
              </div>
            </div>
          </div>
      ) : null}

      {assignShiftModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setAssignShiftModal(null)} role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-xl rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-base font-semibold text-white">Assign shift</h3>
            <input
              className={inputCls}
              placeholder="Search staff..."
              value={staffQuery}
              onChange={(e) => setStaffQuery(e.target.value)}
            />
            <div className="mt-3 max-h-[300px] overflow-y-auto rounded border border-[#2a2a2a]">
              {staffLoading ? (
                <div className="p-3 text-xs text-[#888]">Loading…</div>
              ) : staffResults.length === 0 ? (
                <div className="p-3 text-xs text-[#888]">No staff found</div>
              ) : (
                staffResults.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => void handleAssignStaff(staff.id)}
                    className="flex w-full items-center justify-between border-b border-[#1e1e1e] px-3 py-2 text-left hover:bg-[#141414]"
                  >
                    <div>
                      <div className="text-sm text-white">
                        {staff.surname} {staff.name}
                      </div>
                      <div className="text-xs text-[#888]">
                        {primaryRoleLabel(staff)} · {staff.company ?? "No company"}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex justify-between">
              <div>
                {assignShiftModal.staff_id ? (
                  <button type="button" className="text-xs text-red-400 hover:underline" onClick={() => void handleAssignStaff(null)}>
                    Remove assignment
                  </button>
                ) : null}
              </div>
              <button type="button" className={btnSecondary} onClick={() => setAssignShiftModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DndContext>
  );
}
