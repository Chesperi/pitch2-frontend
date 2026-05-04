export type ShiftStatus = "UNASSIGNED" | "ASSIGNED" | "CONFIRMED" | "COMPLETED";
export type TaskType = "HL" | "GOL_COLLECTION" | "TAGLIO_INTERVISTE" | "PUNTATA" | "ALTRO";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface EditingTask {
  id: number;
  shift_id: number | null;
  work_block_id: number | null;
  task_type: TaskType;
  event_id: string | null;
  project_id: number | null;
  label: string | null;
  notes: string | null;
  sort_order: number;
  status: TaskStatus;
  event?: {
    id: string;
    home_team_name_short: string | null;
    away_team_name_short: string | null;
    date: string | null;
    matchday: number | null;
    competition_name: string | null;
  } | null;
  project?: { id: number; name: string; project_type: string } | null;
}

export interface EditingShift {
  id: number;
  date: string;
  time_from: string;
  time_to: string;
  staff_id: number | null;
  provider_id: number | null;
  status: ShiftStatus;
  notes: string | null;
  editing_tasks: EditingTask[];
  staff?: { id: number; name: string; surname: string; company?: string } | null;
  provider?: { id: number; name: string; surname: string; company?: string } | null;
}

export interface EditingSlotUnassigned {
  id: number;
  work_block_id: number | null;
  role_code: string;
  location: string;
  status: string;
  work_block?: {
    id: number;
    role_code: string;
    location: string;
    quantity: number;
    hours_per_session: number;
    phase?: {
      id: number;
      phase_name: string;
      project?: { id: number; name: string; project_type: string } | null;
    } | null;
  } | null;
}

export interface UnassignedData {
  tasks: EditingTask[];
  slots: EditingSlotUnassigned[];
}

export type EditingTaskTemplateTriggerType = "PER_MATCH" | "PER_MD";

export interface EditingTaskTemplate {
  id: number;
  task_type: string;
  trigger_type: EditingTaskTemplateTriggerType;
  competition: string | null;
  quantity: number | null;
  estimated_hours: number | null;
  role_code: string | null;
  notes: string | null;
  active: boolean;
  day_of_week: number | null;
  created_at: string | null;
}

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  HL: "Highlights",
  GOL_COLLECTION: "Gol Collection",
  TAGLIO_INTERVISTE: "Taglio Interviste",
  PUNTATA: "Puntata",
  ALTRO: "Altro",
};

export const TASK_TYPE_COLORS: Record<TaskType, { bg: string; text: string }> = {
  HL:                { bg: "#E24B4A", text: "#fff" },
  GOL_COLLECTION:    { bg: "#378ADD", text: "#fff" },
  TAGLIO_INTERVISTE: { bg: "#FAC775", text: "#412402" },
  PUNTATA:           { bg: "#9FE1CB", text: "#04342C" },
  ALTRO:             { bg: "#888780", text: "#fff" },
};

export const COVERAGE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  INTERNAL:  { bg: "#1a2e1a", text: "#4ade80", label: "Internal" },
  FREELANCE: { bg: "#1a1a2e", text: "#60a5fa", label: "Freelance" },
  PROVIDER:  { bg: "#2e1a2e", text: "#c084fc", label: "Provider" },
  MIXED:     { bg: "#2e2a10", text: "#FFFA00", label: "Mixed" },
};

export async function fetchShifts(params: { from?: string; to?: string; date?: string }): Promise<EditingShift[]> {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.date) qs.set("date", params.date);
  const res = await fetch(`/api/editing-scheduler/shifts?${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error(`fetchShifts error: ${res.status}`);
  return res.json();
}

export async function createShift(payload: {
  date: string; time_from: string; time_to: string;
  staff_id?: number | null; provider_id?: number | null; notes?: string | null;
}): Promise<EditingShift> {
  const res = await fetch("/api/editing-scheduler/shifts", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createShift error: ${res.status}`);
  return res.json();
}

export async function updateShift(id: number, payload: Partial<{
  date: string; time_from: string; time_to: string;
  staff_id: number | null; provider_id: number | null;
  status: ShiftStatus; notes: string | null;
}>): Promise<EditingShift> {
  const res = await fetch(`/api/editing-scheduler/shifts/${id}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateShift error: ${res.status}`);
  return res.json();
}

export async function deleteShift(id: number): Promise<void> {
  const res = await fetch(`/api/editing-scheduler/shifts/${id}`, {
    method: "DELETE", credentials: "include",
  });
  if (!res.ok) throw new Error(`deleteShift error: ${res.status}`);
}

export async function createTask(payload: {
  shift_id?: number | null; work_block_id?: number | null;
  task_type: TaskType; event_id?: string | null;
  project_id?: number | null; label?: string | null;
  notes?: string | null; sort_order?: number;
}): Promise<EditingTask> {
  const res = await fetch("/api/editing-scheduler/tasks", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createTask error: ${res.status}`);
  return res.json();
}

export async function updateTask(id: number, payload: Partial<{
  shift_id: number | null; task_type: TaskType;
  event_id: string | null; label: string | null;
  status: TaskStatus; sort_order: number;
}>): Promise<EditingTask> {
  const res = await fetch(`/api/editing-scheduler/tasks/${id}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateTask error: ${res.status}`);
  return res.json();
}

export async function deleteTask(id: number): Promise<void> {
  const res = await fetch(`/api/editing-scheduler/tasks/${id}`, {
    method: "DELETE", credentials: "include",
  });
  if (!res.ok) throw new Error(`deleteTask error: ${res.status}`);
}

export async function fetchUnassigned(): Promise<UnassignedData> {
  const res = await fetch("/api/editing-scheduler/unassigned", { credentials: "include" });
  if (!res.ok) throw new Error(`fetchUnassigned error: ${res.status}`);
  return res.json();
}

export async function fetchTaskTemplatesAll(): Promise<EditingTaskTemplate[]> {
  const res = await fetch("/api/editing-scheduler/templates/all", { credentials: "include" });
  if (!res.ok) throw new Error(`fetchTaskTemplatesAll error: ${res.status}`);
  return res.json();
}

export async function fetchTaskTemplates(): Promise<EditingTaskTemplate[]> {
  const res = await fetch("/api/editing-scheduler/templates", { credentials: "include" });
  if (!res.ok) throw new Error(`fetchTaskTemplates error: ${res.status}`);
  return res.json();
}

export async function createTaskTemplate(payload: {
  task_type: string;
  trigger_type: EditingTaskTemplateTriggerType;
  competition?: string | null;
  quantity?: number | null;
  estimated_hours?: number | null;
  role_code?: string | null;
  notes?: string | null;
  active?: boolean;
}): Promise<EditingTaskTemplate> {
  const res = await fetch("/api/editing-scheduler/templates", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`createTaskTemplate error: ${res.status}`);
  return res.json();
}

export async function updateTaskTemplate(
  id: number,
  payload: Partial<{
    task_type: string;
    trigger_type: EditingTaskTemplateTriggerType;
    competition: string | null;
    quantity: number | null;
    estimated_hours: number | null;
    role_code: string | null;
    notes: string | null;
    active: boolean;
  }>
): Promise<EditingTaskTemplate> {
  const res = await fetch(`/api/editing-scheduler/templates/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`updateTaskTemplate error: ${res.status}`);
  return res.json();
}

export async function deleteTaskTemplate(id: number): Promise<void> {
  const res = await fetch(`/api/editing-scheduler/templates/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`deleteTaskTemplate error: ${res.status}`);
}
