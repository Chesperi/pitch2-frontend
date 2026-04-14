import { apiFetch } from "./apiFetch";

export class StaffRoleNotCompatibleError extends Error {
  expectedRoleCode?: string;
  staffDefaultRoleCode?: string | null;

  constructor(
    message: string,
    expectedRoleCode?: string,
    staffDefaultRoleCode?: string | null
  ) {
    super(message);
    this.name = "StaffRoleNotCompatibleError";
    this.expectedRoleCode = expectedRoleCode;
    this.staffDefaultRoleCode = staffDefaultRoleCode;
  }
}

// --- Designator API (assignments by event) ---

export type AssignmentStatus = "DRAFT" | "READY" | "SENT" | "CONFIRMED" | "REJECTED";

export type AssignmentWithJoins = {
  id: number;
  event_id: string;
  role_id: number;
  staff_id: number | null;
  generated_from_combo_id?: number | null;
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
  generatedFromComboId?: number | null;
  staffSurname?: string | null;
  staffName?: string | null;
  staffFee?: number | null;
};

/** Alias esplicito per il tipo assignment designazioni. */
export type Assignment = AssignmentWithJoins;

function normalizeAssignment(item: Record<string, unknown>): AssignmentWithJoins {
  const base = { ...item } as AssignmentWithJoins;
  base.event_id = String(item.event_id ?? item.eventId ?? "");
  const roleCode = String(item.role_code ?? item.roleCode ?? "");
  const roleName = String(item.role_name ?? item.roleName ?? "");
  const staffId = (item.staff_id ?? item.staffId ?? null) as number | null;
  const generatedFromComboId = (item.generated_from_combo_id ??
    item.generatedFromComboId ??
    null) as number | null;
  const staffSurname = (item.staff_surname ?? item.staffSurname ?? null) as string | null;
  const staffName = (item.staff_name ?? item.staffName ?? null) as string | null;

  const roleLocation = String(item.role_location ?? item.roleLocation ?? item.role_area ?? "");
  base.role_code = roleCode;
  base.role_name = roleName;
  base.role_location = roleLocation;
  base.roleLocation = roleLocation;
  const staffFee = (item.staff_fee ?? item.staffFee ?? null) as number | null;
  base.staff_id = staffId;
  base.generated_from_combo_id = generatedFromComboId;
  base.staff_surname = staffSurname;
  base.staff_name = staffName;
  base.staff_fee = staffFee;

  base.roleCode = roleCode;
  base.roleName = roleName;
  base.staffId = staffId;
  base.generatedFromComboId = generatedFromComboId;
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
  const prevLoc = previous.roleLocation ?? previous.role_location ?? "";
  if (!prevCode) return updated;
  return {
    ...updated,
    roleCode: prevCode,
    roleName: prevName ?? "",
    role_code: prevCode,
    role_name: prevName ?? "",
    roleLocation: prevLoc,
    role_location: prevLoc,
  };
}

export async function fetchAssignmentsByEvent(
  eventId: string
): Promise<AssignmentWithJoins[]> {
  const q = new URLSearchParams({ eventId: String(eventId) });
  const res = await apiFetch(`/api/assignments?${q.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch assignments: ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map((item: Record<string, unknown>) => normalizeAssignment(item));
}

export async function fetchAssignmentsByStaff(
  staffId: number
): Promise<AssignmentWithJoins[]> {
  const q = new URLSearchParams({ staffId: String(staffId) });
  const res = await apiFetch(`/api/assignments?${q.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch assignments by staff");
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map((item: Record<string, unknown>) => normalizeAssignment(item));
}

export async function fetchAssignmentsByPeriod(
  from: string,
  to: string
): Promise<AssignmentWithJoins[]> {
  const q = new URLSearchParams({
    from,
    to,
  });
  const res = await apiFetch(`/api/assignments?${q.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch assignments by period");
  const data = await res.json();
  const items = Array.isArray(data) ? data : data.items ?? [];
  return items.map((item: Record<string, unknown>) => normalizeAssignment(item));
}

export type AssignmentConflictItem = {
  assignmentId: number;
  eventId: string;
  roleCode: string;
  roleLocation: string;
  assignmentStatus: string;
  date: string | null;
  koItalyTime: string | null;
  competitionName: string | null;
  homeTeamNameShort: string | null;
  awayTeamNameShort: string | null;
  showName: string | null;
};

export async function fetchAssignmentConflicts(params: {
  staffId: number;
  date: string; // YYYY-MM-DD
}): Promise<AssignmentConflictItem[]> {
  const q = new URLSearchParams({
    staffId: String(params.staffId),
    date: params.date,
  });
  const res = await apiFetch(`/api/assignments/conflicts?${q.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch assignment conflicts: ${res.status}`);
  }
  const data = (await res.json()) as { items?: AssignmentConflictItem[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function sendDesignazioniForPerson(
  staffId: number,
  assignmentIds: number[]
): Promise<void> {
  const res = await apiFetch("/api/designazioni/send-person", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ staffId, assignmentIds }),
  });

  const text = await res.text();
  console.log("SEND PERSON RESPONSE", res.status, text);

  if (!res.ok) {
    throw new Error(`Failed to send person email: ${res.status}`);
  }
}

export async function sendDesignazioniForPeriod(
  from: string,
  to: string
): Promise<void> {
  const res = await apiFetch("/api/designazioni/send-period", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) throw new Error("Failed to send period emails");
}

export type CreateAssignmentParams = {
  eventId: string;
  roleId: number;
  roleCode: string;
  roleLocation: string;
};

export async function createAssignment(
  params: CreateAssignmentParams
): Promise<AssignmentWithJoins> {
  const { eventId, roleId, roleCode, roleLocation } = params;
  const res = await apiFetch("/api/assignments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventId,
      roleId,
      roleCode,
      role_location: roleLocation,
    }),
  });
  if (!res.ok) throw new Error(`Failed to create assignment: ${res.status}`);
  const data = await res.json();
  return normalizeAssignment(data);
}

export async function createEmptyAssignmentSlot(
  eventId: string,
  roleId: number,
  roleCode: string,
  roleLocation: string
): Promise<AssignmentWithJoins> {
  return createAssignment({ eventId, roleId, roleCode, roleLocation });
}

export type UpdateAssignmentPayload = {
  staffId?: number | null;
  status?: AssignmentStatus;
  notes?: string | null;
  roleCode?: string;
  roleLocation?: string;
};

export async function deleteDesignatorAssignment(id: number): Promise<void> {
  const res = await apiFetch(`/api/assignments/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new Error("Failed to delete assignment");
  }
}

export async function markAssignmentsReady(params: {
  eventId: string;
  assignmentIds: number[];
}): Promise<void> {
  const { eventId, assignmentIds } = params;
  const enc = encodeURIComponent(String(eventId));
  const res = await apiFetch(`/api/events/${enc}/assignments-ready`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignmentIds }),
  });
  if (!res.ok) {
    throw new Error("Failed to mark assignments ready");
  }
}

export async function updateAssignment(
  id: number,
  payload: UpdateAssignmentPayload
): Promise<AssignmentWithJoins> {
  const body: Record<string, unknown> = {};
  if (payload.staffId !== undefined) body.staffId = payload.staffId;
  if (payload.status !== undefined) body.status = payload.status;
  if (payload.notes !== undefined) body.notes = payload.notes;
  if (payload.roleCode !== undefined) body.role_code = payload.roleCode;
  if (payload.roleLocation !== undefined)
    body.role_location = payload.roleLocation;
  const res = await apiFetch(`/api/assignments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const rawText = await res.text();
  let parsed: Record<string, unknown> | null = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  if (!res.ok) {
    if (
      res.status === 422 &&
      parsed?.error === "STAFF_ROLE_NOT_COMPATIBLE"
    ) {
      const details = (parsed.details ?? {}) as Record<string, unknown>;
      const msg =
        typeof parsed.message === "string"
          ? parsed.message
          : "The selected staff is not compatible with the slot role.";
      const expected =
        typeof details.expectedRoleCode === "string"
          ? details.expectedRoleCode
          : undefined;
      const staffDef =
        details.staffDefaultRoleCode != null
          ? String(details.staffDefaultRoleCode)
          : null;
      throw new StaffRoleNotCompatibleError(msg, expected, staffDef);
    }
    const fallback =
      typeof parsed?.message === "string"
        ? parsed.message
        : `Failed to update assignment: ${res.status}`;
    throw new Error(fallback);
  }

  if (!parsed) {
    throw new Error("Invalid response body");
  }
  return normalizeAssignment(parsed);
}

/** Alias storico per PATCH slot designazioni. */
export const updateDesignatorAssignment = updateAssignment;

// --- Staff assignments (Le mie assegnazioni) ---

export async function fetchDesignazioniMe(): Promise<{
  items: AssignmentWithEvent[];
}> {
  const res = await apiFetch("/api/designazioni/me", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch designazioni: ${res.status}`);
  return res.json();
}

export type AssignmentDTO = {
  id: number;
  event_id: string;
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
  id: string;
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

  const qs = searchParams.toString();
  const path = `/api/staff/${staffId}/assignments${qs ? `?${qs}` : ""}`;
  const res = await apiFetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch assignments: ${res.status}`);
  return res.json();
}

/** PATCH /api/assignments/:id per flusso staff (plate, notes, status). */
export async function updateStaffAssignment(
  id: number,
  payload: {
    status?: string;
    plate_selected?: string | null;
    notes?: string | null;
  }
): Promise<AssignmentWithEvent> {
  const res = await apiFetch(`/api/assignments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update assignment: ${res.status}`);
  return res.json();
}
