"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import PageLoading from "@/components/ui/PageLoading";
import {
  fetchShifts,
  fetchUnassigned,
  createShift,
  deleteShift,
  createTask,
  deleteTask,
  updateTask,
  type EditingShift,
  type EditingTask,
  type EditingSlotUnassigned,
  type TaskType,
  TASK_TYPE_LABELS,
  TASK_TYPE_COLORS,
} from "@/lib/api/editingScheduler";
import { fetchAuthMe } from "@/lib/api/freelanceAssignments";

const TASK_TYPES: TaskType[] = ["HL", "GOL_COLLECTION", "TAGLIO_INTERVISTE", "PUNTATA", "ALTRO"];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, "0")}:00`);

function toIsoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function addDays(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

// ─── TaskCard (draggable) ──────────────────────────────────
function TaskCard({
  task,
  onDelete,
  compact = false,
}: {
  task: EditingTask;
  onDelete?: () => void;
  compact?: boolean;
}) {
  const colors = TASK_TYPE_COLORS[task.task_type] ?? { bg: "#888", text: "#fff" };
  const label =
    task.label ??
    (task.event ? `${task.event.home_team_name_short ?? ""} vs ${task.event.away_team_name_short ?? ""}` : null) ??
    (task.project ? task.project.name : null) ??
    TASK_TYPE_LABELS[task.task_type];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: compact ? "3px 6px" : "5px 8px",
        borderRadius: 5,
        background: colors.bg + "22",
        border: `1px solid ${colors.bg}44`,
        cursor: "grab",
      }}
    >
      <span
        style={{
          fontSize: 9,
          padding: "1px 5px",
          borderRadius: 3,
          background: colors.bg,
          color: colors.text,
          fontWeight: 600,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {TASK_TYPE_LABELS[task.task_type]}
      </span>
      <span
        style={{
          fontSize: 11,
          color: "var(--color-text-primary)",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          style={{
            fontSize: 12,
            color: "#f87171",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

// ─── DraggableTask ─────────────────────────────────────────
function DraggableTask({ task, onDelete }: { task: EditingTask; onDelete?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `task-${task.id}`,
    data: { type: "task", task },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} onDelete={onDelete} />
    </div>
  );
}

// ─── ShiftCard ─────────────────────────────────────────────
function ShiftCard({
  shift,
  onAssign,
  onDelete,
  onTaskDelete,
  onAddTask,
  canEdit,
}: {
  shift: EditingShift;
  onAssign: (shift: EditingShift) => void;
  onDelete: (id: number) => void;
  onTaskDelete: (taskId: number, shiftId: number) => void;
  onAddTask: (shiftId: number) => void;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useSortable({
    id: `shift-${shift.id}`,
    data: { type: "shift", shiftId: shift.id },
  });

  const tasks = shift.editing_tasks ?? [];

  const assigneeName = shift.staff
    ? `${shift.staff.surname} ${shift.staff.name}`
    : shift.provider
      ? (shift.provider.company ?? `${shift.provider.surname} ${shift.provider.name}`)
      : null;

  return (
    <div
      ref={setNodeRef}
      style={{
        border: `1px solid ${isOver ? "#FFFA00" : "var(--color-border-tertiary)"}`,
        borderRadius: 8,
        padding: "10px 12px",
        background: isOver ? "rgba(255,250,0,0.04)" : "var(--color-background-primary)",
        transition: "border-color 0.15s, background 0.15s",
        marginBottom: 8,
      }}
    >
      {/* Header turno */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)" }}>
          {shift.time_from.slice(0, 5)} – {shift.time_to.slice(0, 5)}
        </span>
        {assigneeName ? (
          <span style={{ fontSize: 12, color: "#4ade80" }}>{assigneeName}</span>
        ) : (
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)", fontStyle: "italic" }}>Unassigned</span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => onAssign(shift)}
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
                {assigneeName ? "Reassign" : "Assign"}
              </button>
              <button
                type="button"
                onClick={() => onAddTask(shift.id)}
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
                + Task
              </button>
              <button
                type="button"
                onClick={() => onDelete(shift.id)}
                style={{
                  fontSize: 11,
                  color: "#f87171",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "2px 4px",
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>
      {/* Tasks */}
      <SortableContext items={tasks.map((t) => `task-${t.id}`)} strategy={verticalListSortingStrategy}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {tasks.length === 0 && (
            <div style={{ fontSize: 11, color: "var(--color-text-secondary)", fontStyle: "italic", padding: "4px 0" }}>
              Drop tasks here
            </div>
          )}
          {tasks.map((task) => (
            <DraggableTask
              key={task.id}
              task={task}
              onDelete={canEdit ? () => onTaskDelete(task.id, shift.id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────
export default function MediaSchedulerPage() {
  const [shifts, setShifts] = useState<EditingShift[]>([]);
  const [unassigned, setUnassigned] = useState<{ tasks: EditingTask[]; slots: EditingSlotUnassigned[] }>({
    tasks: [],
    slots: [],
  });
  const [loading, setLoading] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [startDate, setStartDate] = useState(() => toIsoDate(new Date()));
  const [daysCount] = useState(7);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(() => new Set([toIsoDate(new Date())]));
  const [activeItem, setActiveItem] = useState<{ type: "task"; task: EditingTask } | null>(null);
  const [addShiftDay, setAddShiftDay] = useState<string | null>(null);
  const [addTaskShiftId, setAddTaskShiftId] = useState<number | null>(null);
  const [newShift, setNewShift] = useState({ time_from: "08:00", time_to: "16:00" });
  const [newTask, setNewTask] = useState<{ task_type: TaskType; label: string }>({ task_type: "HL", label: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const days = useMemo(() => {
    return Array.from({ length: daysCount }, (_, i) => addDays(startDate, i));
  }, [startDate, daysCount]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [me, shiftsData, unassignedData] = await Promise.all([
        fetchAuthMe(),
        fetchShifts({ from: startDate, to: addDays(startDate, daysCount - 1) }),
        fetchUnassigned(),
      ]);
      const lvl = (me.user_level ?? "").toUpperCase();
      setCanEdit(["MASTER", "MANAGER"].includes(lvl));
      setShifts(shiftsData);
      setUnassigned(unassignedData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  }, [startDate, daysCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const shiftsPerDay = useMemo(() => {
    const map = new Map<string, EditingShift[]>();
    for (const s of shifts) {
      const existing = map.get(s.date) ?? [];
      map.set(s.date, [...existing, s]);
    }
    return map;
  }, [shifts]);

  const handleDragStart = (e: DragStartEvent) => {
    const data = e.active.data.current;
    if (data?.type === "task") setActiveItem({ type: "task", task: data.task as EditingTask });
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveItem(null);
    const { active, over } = e;
    if (!over) return;
    const activeData = active.data.current;
    const overData = over.data.current;
    if (!activeData) return;

    const targetShiftId =
      (overData as { shiftId?: number } | undefined)?.shiftId ??
      (overData as { task?: EditingTask } | undefined)?.task?.shift_id ??
      null;
    if (activeData.type === "task" && targetShiftId) {
      const task = activeData.task as EditingTask;
      if (task.shift_id === targetShiftId) return;
      setSaving(true);
      try {
        await updateTask(task.id, { shift_id: targetShiftId });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Errore spostamento task");
      } finally {
        setSaving(false);
      }
    }
  };

  const handleDeleteShift = async (id: number) => {
    if (!window.confirm("Eliminare questo turno?")) return;
    try {
      await deleteShift(id);
      await load();
    } catch {
      setError("Errore eliminazione turno");
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    try {
      await deleteTask(taskId);
      await load();
    } catch {
      setError("Errore eliminazione task");
    }
  };

  const handleCreateShift = async () => {
    if (!addShiftDay) return;
    setSaving(true);
    try {
      await createShift({
        date: addShiftDay,
        time_from: newShift.time_from + ":00",
        time_to: newShift.time_to + ":00",
      });
      setAddShiftDay(null);
      await load();
    } catch {
      setError("Errore creazione turno");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTask = async () => {
    if (!addTaskShiftId) return;
    setSaving(true);
    try {
      await createTask({ shift_id: addTaskShiftId, task_type: newTask.task_type, label: newTask.label || null });
      setAddTaskShiftId(null);
      setNewTask({ task_type: "HL", label: "" });
      await load();
    } catch {
      setError("Errore creazione task");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "rounded border border-[#222] bg-[#141414] px-3 py-2 text-sm text-white focus:border-[#FFFA00] focus:outline-none";
  const btnPrimary = "rounded bg-[#FFFA00] px-4 py-2 text-sm font-medium text-black hover:bg-yellow-200 disabled:opacity-50";
  const btnSecondary = "rounded border border-[#333] px-4 py-2 text-sm text-[#aaa] hover:bg-[#1a1a1a]";

  if (loading) return <PageLoading />;

  const unassignedTaskIds = unassigned.tasks.map((t) => `task-${t.id}`);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: "flex", height: "calc(100vh - 56px)", overflow: "hidden" }}>
        {/* ── Colonna sinistra — Unassigned ── */}
        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderRight: "1px solid var(--color-border-tertiary)",
            overflowY: "auto",
            padding: "16px 12px",
          }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--color-text-primary)",
              marginBottom: 12,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Unassigned
          </h2>

          {unassigned.tasks.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--color-text-secondary)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Tasks
              </p>
              <SortableContext items={unassignedTaskIds} strategy={verticalListSortingStrategy}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {unassigned.tasks.map((task) => (
                    <DraggableTask key={task.id} task={task} />
                  ))}
                </div>
              </SortableContext>
            </div>
          )}

          {unassigned.slots.length > 0 && (
            <div>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--color-text-secondary)",
                  marginBottom: 6,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Work blocks
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {unassigned.slots.map((slot) => (
                  <div
                    key={slot.id}
                    style={{
                      padding: "6px 8px",
                      borderRadius: 5,
                      border: "0.5px solid var(--color-border-tertiary)",
                      background: "var(--color-background-secondary)",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500, color: "var(--color-text-primary)" }}>
                      {slot.work_block?.role_code ?? slot.role_code}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-text-secondary)", marginTop: 2 }}>
                      {slot.work_block?.phase?.project?.name} · {slot.location}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--color-text-secondary)" }}>
                      {slot.work_block?.hours_per_session}h
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {unassigned.tasks.length === 0 && unassigned.slots.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--color-text-secondary)", fontStyle: "italic" }}>
              Nessun elemento non assegnato
            </p>
          )}
        </div>

        {/* ── Colonna destra — Calendario ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button
              type="button"
              onClick={() => setStartDate((prev) => addDays(prev, -7))}
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
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-primary)" }}>
              {formatDate(startDate)} – {formatDate(addDays(startDate, daysCount - 1))}
            </span>
            <button
              type="button"
              onClick={() => setStartDate((prev) => addDays(prev, 7))}
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
              onClick={() => setStartDate(toIsoDate(new Date()))}
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
            {error && <span style={{ fontSize: 12, color: "#f87171" }}>{error}</span>}
          </div>

          {days.map((day) => {
            const dayShifts = shiftsPerDay.get(day) ?? [];
            const isExpanded = expandedDays.has(day);
            const isToday = day === toIsoDate(new Date());
            const dayDate = new Date(day + "T12:00:00");
            const dayLabel = dayDate.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });

            return (
              <div
                key={day}
                style={{
                  marginBottom: 8,
                  border: `1px solid ${isToday ? "#FFFA00" : "var(--color-border-tertiary)"}`,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault();
                      setExpandedDays((prev) => {
                        const next = new Set(prev);
                        if (next.has(day)) next.delete(day);
                        else next.add(day);
                        return next;
                      });
                    }
                  }}
                  onClick={() =>
                    setExpandedDays((prev) => {
                      const next = new Set(prev);
                      if (next.has(day)) next.delete(day);
                      else next.add(day);
                      return next;
                    })
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    background: isToday ? "rgba(255,250,0,0.06)" : "var(--color-background-secondary)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: isToday ? "#FFFA00" : "var(--color-text-primary)",
                      minWidth: 100,
                    }}
                  >
                    {dayLabel}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    {dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}
                    {dayShifts.length > 0 &&
                      ` · ${dayShifts.reduce((a, s) => a + (s.editing_tasks?.length ?? 0), 0)} tasks`}
                  </span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAddShiftDay(day);
                        setNewShift({ time_from: "08:00", time_to: "16:00" });
                      }}
                      style={{
                        marginLeft: "auto",
                        fontSize: 11,
                        color: "#FFFA00",
                        background: "none",
                        border: "0.5px solid #FFFA00",
                        borderRadius: 4,
                        padding: "2px 8px",
                        cursor: "pointer",
                      }}
                    >
                      + Shift
                    </button>
                  )}
                  <span style={{ fontSize: 12, color: "var(--color-text-secondary)", marginLeft: canEdit ? 4 : "auto" }}>
                    {isExpanded ? "▾" : "▸"}
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ padding: "10px 12px" }}>
                    <SortableContext
                      items={dayShifts.map((s) => `shift-${s.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {dayShifts.length === 0 ? (
                        <p style={{ fontSize: 12, color: "var(--color-text-secondary)", fontStyle: "italic" }}>
                          Nessun turno. {canEdit ? 'Clicca "+ Shift" per aggiungerne uno.' : ""}
                        </p>
                      ) : (
                        dayShifts.map((shift) => (
                          <ShiftCard
                            key={shift.id}
                            shift={shift}
                            canEdit={canEdit}
                            onAssign={() => undefined}
                            onDelete={handleDeleteShift}
                            onTaskDelete={(taskId) => void handleDeleteTask(taskId)}
                            onAddTask={(id) => {
                              setAddTaskShiftId(id);
                              setNewTask({ task_type: "HL", label: "" });
                            }}
                          />
                        ))
                      )}
                    </SortableContext>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <DragOverlay>{activeItem?.type === "task" && <TaskCard task={activeItem.task} />}</DragOverlay>

      {addShiftDay && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setAddShiftDay(null)}
          role="presentation"
        >
          <div
            style={{
              background: "#0d0d0d",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 8,
              padding: 24,
              width: 340,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>
              New shift — {formatDate(addShiftDay)}
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>
                  From
                </label>
                <select
                  className={inputCls}
                  value={newShift.time_from}
                  onChange={(e) => setNewShift((s) => ({ ...s, time_from: e.target.value }))}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>
                  To
                </label>
                <select
                  className={inputCls}
                  value={newShift.time_to}
                  onChange={(e) => setNewShift((s) => ({ ...s, time_to: e.target.value }))}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setAddShiftDay(null)} className={btnSecondary}>
                Cancel
              </button>
              <button type="button" onClick={() => void handleCreateShift()} disabled={saving} className={btnPrimary}>
                {saving ? "..." : "Create shift"}
              </button>
            </div>
          </div>
        </div>
      )}

      {addTaskShiftId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setAddTaskShiftId(null)}
          role="presentation"
        >
          <div
            style={{
              background: "#0d0d0d",
              border: "0.5px solid var(--color-border-tertiary)",
              borderRadius: 8,
              padding: 24,
              width: 380,
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 16 }}>
              Add task
            </h3>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>
                Type
              </label>
              <select
                className={inputCls + " w-full"}
                value={newTask.task_type}
                onChange={(e) => setNewTask((t) => ({ ...t, task_type: e.target.value as TaskType }))}
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {TASK_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: "var(--color-text-secondary)", display: "block", marginBottom: 4 }}>
                Label (optional)
              </label>
              <input
                className={inputCls + " w-full"}
                value={newTask.label}
                onChange={(e) => setNewTask((t) => ({ ...t, label: e.target.value }))}
                placeholder="es. Milan vs Inter MD35"
              />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" onClick={() => setAddTaskShiftId(null)} className={btnSecondary}>
                Cancel
              </button>
              <button type="button" onClick={() => void handleCreateTask()} disabled={saving} className={btnPrimary}>
                {saving ? "..." : "Add task"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DndContext>
  );
}
