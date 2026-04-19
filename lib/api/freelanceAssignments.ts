import { apiFetch } from "./apiFetch";

export type UserProfile = {
  id: number;
  name: string;
  surname: string;
  user_level: string;
  finance_visibility: "HIDDEN" | "VISIBLE";
  email?: string | null;
  team_dazn?: string | null;
  shifts_management?: boolean;
  managed_teams?: string[];
};

export type MyAssignmentListItem = {
  id: number;
  event_id?: string;
  competition_name: string;
  show_name?: string | null;
  home_team_name_short?: string | null;
  away_team_name_short?: string | null;
  /** YYYY-MM-DD */
  date: string | null;
  weekday?: string | null;
  ko_time: string | null;
  role_name: string;
  venue_name?: string | null;
  venue_city?: string | null;
  location?: string | null;
  status: string;
  notes?: string | null;
};

export type MyAssignmentCrewMember = {
  staff_id: number | null;
  staff_name: string | null;
  role_name: string;
  location: string | null;
  status: string;
};

export type MyAssignmentDetail = {
  assignmentId: number;
  eventId: string;
  competition_name: string;
  show_name?: string | null;
  competition_code?: string | null;
  matchday?: number | null;
  date: string;
  weekday: string;
  ko_time: string;
  venue_name?: string | null;
  venue_city?: string | null;
  location?: string | null;
  role_name: string;
  status: string;
  notes?: string | null;
  crew: MyAssignmentCrewMember[];
  home_team_name_short?: string | null;
  away_team_name_short?: string | null;
};

function pickStr(
  raw: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const k of keys) {
    const v = raw[k];
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return null;
}

export function freelanceAssignmentStatusLabel(status: string): string {
  const u = status.toUpperCase();
  if (u === "SENT") return "DA CONFERMARE";
  if (u === "CONFIRMED") return "CONFERMATO";
  if (u === "CANCELED" || u === "CANCELLED") return "ANNULLATO";
  if (u === "REJECTED") return "RIFIUTATO";
  return u || "—";
}

export function formatFreelanceDetailDateLine(
  dateStr: string | null | undefined,
  weekdayFromApi: string | null | undefined
): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  const base = new Intl.DateTimeFormat("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  if (weekdayFromApi?.trim()) {
    return `${weekdayFromApi.trim()}, ${base}`;
  }
  return base;
}

export function formatCrewLocationLabel(location: string | null): string {
  if (!location?.trim()) return "—";
  const u = location.trim().toUpperCase();
  if (u === "STADIO") return "Stadio";
  if (u === "COLOGNO") return "Cologno";
  return location.trim();
}

function normalizeCrewMember(
  raw: Record<string, unknown>
): MyAssignmentCrewMember {
  const sid = raw.staff_id ?? raw.staffId;
  let staff_id: number | null = null;
  if (sid != null && sid !== "") {
    const n = Number(sid);
    staff_id = Number.isFinite(n) ? n : null;
  }
  return {
    staff_id,
    staff_name: pickStr(raw, "staff_name", "staffName"),
    role_name: pickStr(raw, "role_name", "roleName") ?? "",
    location: pickStr(raw, "location", "role_location"),
    status: String(raw.status ?? "").toUpperCase() || "SENT",
  };
}

export function normalizeMyAssignmentDetail(
  raw: Record<string, unknown>
): MyAssignmentDetail {
  const aid = Number(raw.assignmentId ?? raw.id);
  const eid = String(raw.eventId ?? raw.event_id ?? "");
  const crewRaw = raw.crew;
  const crew: MyAssignmentCrewMember[] = Array.isArray(crewRaw)
    ? (crewRaw as Record<string, unknown>[]).map((c) =>
        normalizeCrewMember(c)
      )
    : [];

  return {
    assignmentId: Number.isFinite(aid) ? aid : 0,
    eventId: eid,
    competition_name:
      pickStr(raw, "competition_name", "competitionName") ?? "",
    show_name: pickStr(raw, "show_name", "showName"),
    competition_code: pickStr(raw, "competition_code", "competitionCode"),
    matchday: (() => {
      const md = raw.matchday ?? raw.matchDay;
      if (md == null || md === "") return null;
      const n = Number(md);
      return Number.isFinite(n) ? n : null;
    })(),
    date: pickStr(raw, "date", "ko_date", "event_date") ?? "",
    weekday: pickStr(raw, "weekday", "weekday_label") ?? "",
    ko_time: pickStr(raw, "ko_time", "koTime") ?? "",
    venue_name: pickStr(raw, "venue_name", "venueName"),
    venue_city: pickStr(raw, "venue_city", "venueCity"),
    location: pickStr(raw, "location", "venue_location"),
    role_name: pickStr(raw, "role_name", "roleName") ?? "",
    status: String(raw.status ?? "").toUpperCase() || "SENT",
    notes:
      raw.notes === undefined || raw.notes === null
        ? null
        : String(raw.notes),
    crew,
    home_team_name_short: pickStr(
      raw,
      "home_team_name_short",
      "homeTeamNameShort"
    ),
    away_team_name_short: pickStr(
      raw,
      "away_team_name_short",
      "awayTeamNameShort"
    ),
  };
}

export function normalizeMyAssignment(
  raw: Record<string, unknown>
): MyAssignmentListItem {
  const id = Number(raw.id ?? raw.assignmentId);
  return {
    id: Number.isFinite(id) ? id : 0,
    event_id: pickStr(raw, "event_id", "eventId") ?? undefined,
    competition_name: pickStr(raw, "competition_name", "competitionName") ?? "",
    show_name: pickStr(raw, "show_name", "showName"),
    home_team_name_short: pickStr(
      raw,
      "home_team_name_short",
      "homeTeamNameShort"
    ),
    away_team_name_short: pickStr(
      raw,
      "away_team_name_short",
      "awayTeamNameShort"
    ),
    date: pickStr(raw, "date", "ko_date", "event_date", "assignment_date"),
    weekday: pickStr(raw, "weekday", "weekday_label", "weekdayLabel"),
    ko_time: pickStr(raw, "ko_time", "koTime"),
    role_name: pickStr(raw, "role_name", "roleName") ?? "",
    venue_name: pickStr(raw, "venue_name", "venueName"),
    venue_city: pickStr(raw, "venue_city", "venueCity"),
    location: pickStr(raw, "location", "venue_location"),
    status: String(raw.status ?? "").toUpperCase() || "SENT",
    notes:
      raw.notes === undefined || raw.notes === null
        ? null
        : String(raw.notes),
  };
}

export async function fetchAuthMe(): Promise<UserProfile> {
  const res = await apiFetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok) {
    const err = new Error(`auth/me failed: ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const data = (await res.json()) as Record<string, unknown>;
  const mt = data.managed_teams ?? data.managedTeams;
  const managedTeams = Array.isArray(mt)
    ? mt.map((x) => String(x).trim()).filter(Boolean)
    : [];
  return {
    id: Number(data.id),
    name: String(data.name ?? ""),
    surname: String(data.surname ?? ""),
    user_level: String(data.user_level ?? data.userLevel ?? ""),
    finance_visibility:
      data.finance_visibility === "VISIBLE" ? "VISIBLE" : "HIDDEN",
    email: data.email != null ? String(data.email) : null,
    team_dazn:
      data.team_dazn != null && String(data.team_dazn).trim() !== ""
        ? String(data.team_dazn)
        : data.teamDazn != null && String(data.teamDazn).trim() !== ""
          ? String(data.teamDazn)
          : null,
    shifts_management: Boolean(data.shifts_management ?? data.shiftsManagement),
    managed_teams: managedTeams,
  };
}

export async function fetchMyAssignmentDetail(
  assignmentId: number
): Promise<MyAssignmentDetail> {
  const res = await apiFetch(`/api/my-assignments/${assignmentId}`, {
    cache: "no-store",
  });

  if (res.status === 404) {
    let message = "Assegnazione non trovata.";
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    const err = new Error(message);
    (err as Error & { status?: number }).status = 404;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(`my-assignments/${assignmentId} failed: ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  const data = (await res.json()) as Record<string, unknown>;
  return normalizeMyAssignmentDetail(data);
}

export async function fetchMyAssignments(): Promise<MyAssignmentListItem[]> {
  const res = await apiFetch("/api/my-assignments", { cache: "no-store" });
  if (!res.ok) {
    const err = new Error(`my-assignments failed: ${res.status}`);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  const data = await res.json();
  const rawItems: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown[] }).items)
      ? (data as { items: unknown[] }).items
      : [];
  return rawItems.map((item) =>
    normalizeMyAssignment(item as Record<string, unknown>)
  );
}

export async function patchMyAssignmentNotes(
  assignmentId: number,
  notes: string
): Promise<void> {
  const res = await apiFetch(`/api/my-assignments/${assignmentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    throw new Error(`Salvataggio note fallito (${res.status})`);
  }
}

export async function confirmMyAssignment(assignmentId: number): Promise<void> {
  const res = await apiFetch(
    `/api/my-assignments/${assignmentId}/confirm`,
    { method: "POST" }
  );
  if (!res.ok) {
    throw new Error(`Conferma fallita (${res.status})`);
  }
}

export async function confirmAllMyAssignments(): Promise<void> {
  const res = await apiFetch("/api/my-assignments/confirm-all", {
    method: "POST",
  });
  if (!res.ok) {
    throw new Error(`Conferma tutti fallita (${res.status})`);
  }
}
