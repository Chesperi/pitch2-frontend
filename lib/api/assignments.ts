import { getApiBaseUrl } from "./config";

// --- Designator API (assignments by event) ---

export type AssignmentStatus = "DRAFT" | "READY" | "SENT" | "CONFIRMED" | "REJECTED";

export type AssignmentWithJoins = {
  id: number;
  event_id: number;
  role_id: number;
  staff_id: number | null;
  status: AssignmentStatus;
  notes: string | null;
  event_external_match_id: string;
  event_category: string;
  event_competition_name: string;
  event_competition_code: string;
  event_match_day: string;
  event_home_team_name_short: string;
  event_away_team_name_short: string;
  event_venue_name: string;
  event_venue_city: string;
  event_ko_italy: string;
  event_status: string;
  staff_surname: string | null;
  staff_name: string | null;
  staff_email: string | null;
  staff_phone: string | null;
  staff_company: string | null;
  staff_fee: number | null;
  staff_plates: string | null;
  role_code: string;
  role_name: string;
  role_location: string;
  /** Alias camelCase (normalizzati da normalizeAssignment) */
  roleCode?: string;
  roleName?: string;
  roleLocation?: string;
  staffId?: number | null;
  staffSurname?: string | null;
  staffName?: string | null;
  staffFee?: number | null;
};

function normalizeAssignment(item: Record<string, unknown>): AssignmentWithJoins {
  const base = { ...item } as AssignmentWithJoins;
  const roleCode = String(item.role_code ?? item.roleCode ?? "");
  const roleName = String(item.role_name ?? item.roleName ?? "");
  const staffId = (item.staff_id ?? item.staffId ?? null) as number | null;
  const staffSurname = (item.staff_surname ?? item.staffSurname ?? null) as string | null;
  const staffName = (item.staff_name ?? item.staffName ?? null) as string | null;

  const roleLocation = String(item.role_location ?? item.roleLocation ?? item.role_area ?? "");
  base.role_code = roleCode;
  base.role_name = roleName;
  base.role_location = roleLocation;
  base.roleLocation = roleLocation;
  const staffFee = (item.staff_fee ?? item.staffFee ?? null) as number | null;
  base.staff_id = staffId;
  base.staff_surname = staffSurname;
  base.staff_name = staffName;
  base.staff_fee = staffFee;

  base.roleCode = roleCode;
  base.roleName = roleName;
  base.staffId = staffId;
  base.staffSurname = staffSurname;
  base.staffName = staffName;
  base.staffFee = staffFee;
  return base;
}

/** Preserva roleCode/roleName da previous se updated non li contiene (es. PATCH staffId:null) */
export function preserveRoleFrom(
  updated: AssignmentWithJoins,
  previous: AssignmentWithJoins
): AssignmentWithJoins {
  const hasRole = (u: AssignmentWithJoins) =>
    (u.roleCode ?? u.role_code) && (u.roleCode ?? u.role_code) !== "";
  if (hasRole(updated)) return updated;
  const prevCode = previous.roleCode ?? previous.role_code;
  const prevName = previous.roleName ?? previous.role_name;
  if (!prevCode) return updated;
  return {
    ...updated,
    roleCode: prevCode,
    roleName: prevName ?? "",
    role_code: prevCode,
    role_name: prevName ?? "",
  };
}

export async function fetchAssignmentsByEvent(
  eventId: number
): Promise<AssignmentWithJoins[]> {
  const url = `${getApiBaseUrl()}/api/assignments?eventId=${eventId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch assignments: ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map((item: Record<string, unknown>) => normalizeAssignment(item));
}

export async function fetchAssignmentsByStaff(
  staffId: number
): Promise<AssignmentWithJoins[]> {
  const url = `${getApiBaseUrl()}/api/assignments?staffId=${staffId}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch assignments by staff");
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map((item: Record<string, unknown>) => normalizeAssignment(item));
}

export async function fetchAssignmentsByPeriod(
  from: string,
  to: string
): Promise<AssignmentWithJoins[]> {
  const url = `${getApiBaseUrl()}/api/assignments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch assignments by period");
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map((item: Record<string, unknown>) => normalizeAssignment(item));
}

export async function sendDesignazioniForPerson(
  staffId: number,
  assignmentIds: number[]
): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/designazioni/send-person`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staffId, assignmentIds }),
  });
  if (!res.ok) throw new Error("Failed to send person email");
}

export async function sendDesignazioniForPeriod(
  from: string,
  to: string
): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/designazioni/send-period`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) throw new Error("Failed to send period emails");
}

export async function createEmptyAssignmentSlot(
  eventId: number,
  roleId: number
): Promise<AssignmentWithJoins> {
  const url = `${getApiBaseUrl()}/api/assignments`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventId, roleId }),
  });
  if (!res.ok) throw new Error(`Failed to create assignment: ${res.status}`);
  const data = await res.json();
  return normalizeAssignment(data);
}

export type UpdateAssignmentPayload = {
  staffId?: number | null;
  status?: AssignmentStatus;
  notes?: string | null;
};

export async function deleteDesignatorAssignment(id: number): Promise<void> {
  const url = `${getApiBaseUrl()}/api/assignments/${id}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) {
    throw new Error("Failed to delete assignment");
  }
}

export async function markAssignmentsReady(params: {
  eventId: number;
  assignmentIds: number[];
}): Promise<void> {
  const { eventId, assignmentIds } = params;
  const url = `${getApiBaseUrl()}/api/events/${eventId}/assignments-ready`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignmentIds }),
  });
  if (!res.ok) {
    throw new Error("Failed to mark assignments ready");
  }
}

export async function updateDesignatorAssignment(
  id: number,
  payload: UpdateAssignmentPayload
): Promise<AssignmentWithJoins> {
  const url = `${getApiBaseUrl()}/api/assignments/${id}`;
  const body: Record<string, unknown> = {};
  if (payload.staffId !== undefined) body.staffId = payload.staffId;
  if (payload.status !== undefined) body.status = payload.status;
  if (payload.notes !== undefined) body.notes = payload.notes;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to update assignment: ${res.status}`);
  const data = await res.json();
  return normalizeAssignment(data);
}

// --- Staff assignments (Le mie assegnazioni) ---

export type AssignmentDTO = {
  id: number;
  event_id: number;
  staff_id: number;
  role_code: string;
  fee: number | null;
  location: string | null;
  status: string;
  plate_selected: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignmentEventSummary = {
  id: number;
  category: string;
  competition_name: string;
  competition_code: string | null;
  matchday: number | null;
  home_team_name_short: string | null;
  away_team_name_short: string | null;
  venue_name: string | null;
  ko_italy: string | null;
  pre_duration_minutes: number;
  standard_onsite: string | null;
  standard_cologno: string | null;
  location: string | null;
  show_name: string | null;
  status: string;
};

export type AssignmentWithEvent = {
  assignment: AssignmentDTO;
  event: AssignmentEventSummary;
};

export type StaffAssignmentsResponse = {
  items: AssignmentWithEvent[];
  total: number;
};

export async function fetchStaffAssignments(params: {
  staffId: number;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}): Promise<StaffAssignmentsResponse> {
  const { staffId, ...rest } = params;
  const searchParams = new URLSearchParams();
  if (rest.status) searchParams.set("status", rest.status);
  if (rest.from) searchParams.set("from", rest.from);
  if (rest.to) searchParams.set("to", rest.to);
  if (rest.limit != null) searchParams.set("limit", String(rest.limit));
  if (rest.offset != null) searchParams.set("offset", String(rest.offset));

  const url = `${getApiBaseUrl()}/api/staff/${staffId}/assignments${searchParams.toString() ? `?${searchParams}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch assignments: ${res.status}`);
  return res.json();
}

export async function updateAssignment(
  id: number,
  payload: {
    status?: string;
    plate_selected?: string | null;
    notes?: string | null;
  }
): Promise<AssignmentWithEvent> {
  const url = `${getApiBaseUrl()}/api/assignments/${id}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update assignment: ${res.status}`);
  return res.json();
}
