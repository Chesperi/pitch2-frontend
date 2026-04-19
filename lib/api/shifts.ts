import { apiFetch } from "./apiFetch";

export type ShiftType =
  | "PD"
  | "PS"
  | "S"
  | "O"
  | "RE"
  | "F"
  | "R"
  | "M"
  | "RT"
  | "T";

export type Shift = {
  id: number;
  staffId: number;
  date: string;
  shiftType: ShiftType;
  team?: string;
  createdBy?: number;
};

export type StaffMember = {
  id: number;
  name: string;
  surname: string;
};

export async function fetchShiftsByRange(
  from: string,
  to: string,
  team?: string
): Promise<Shift[]> {
  const q = new URLSearchParams({ from, to });
  if (team?.trim()) q.set("team", team.trim());
  const res = await apiFetch(`/api/shifts?${q.toString()}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`shifts ${res.status}`);
  const data = (await res.json()) as { items?: Shift[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchMyShifts(from: string, to: string): Promise<Shift[]> {
  const q = new URLSearchParams({ from, to });
  const res = await apiFetch(`/api/shifts/my?${q.toString()}`, {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`shifts/my ${res.status}`);
  const data = (await res.json()) as { items?: Shift[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchTeamMembers(team: string): Promise<StaffMember[]> {
  const res = await apiFetch(
    `/api/shifts/team-members?team=${encodeURIComponent(team.trim())}`,
    { cache: "no-store", credentials: "include" }
  );
  if (!res.ok) throw new Error(`team-members ${res.status}`);
  const data = (await res.json()) as { items?: StaffMember[] };
  return Array.isArray(data.items) ? data.items : [];
}

export async function fetchDistinctTeamNames(): Promise<string[]> {
  const res = await apiFetch("/api/shifts/team-names", {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`team-names ${res.status}`);
  const data = (await res.json()) as { teams?: string[] };
  return Array.isArray(data.teams) ? data.teams : [];
}

export async function fetchManagedTeams(): Promise<string[]> {
  const res = await apiFetch("/api/shifts/managed-teams", {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`managed-teams ${res.status}`);
  const data = (await res.json()) as { teams?: string[] };
  return Array.isArray(data.teams) ? data.teams : [];
}

export async function upsertShift(
  staffId: number,
  date: string,
  shiftType: ShiftType
): Promise<void> {
  const res = await apiFetch("/api/shifts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ staffId, date, shiftType }),
  });
  if (!res.ok) throw new Error(`upsert shift ${res.status}`);
}

export async function upsertShiftsBulk(
  entries: Array<{ staffId: number; date: string; shiftType: ShiftType }>
): Promise<void> {
  const res = await apiFetch("/api/shifts", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ entries }),
  });
  if (!res.ok) throw new Error(`bulk ${res.status}`);
}

export async function deleteShiftApi(
  staffId: number,
  date: string
): Promise<void> {
  const res = await apiFetch("/api/shifts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ staffId, date }),
  });
  if (!res.ok) throw new Error(`delete shift ${res.status}`);
}
