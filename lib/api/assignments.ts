import { getApiBaseUrl } from "./config";

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
