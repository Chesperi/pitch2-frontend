import { getApiBaseUrl } from "./config";

/** Struttura allineata alla tabella staff (ex AssignmentDTO + AssignmentEventSummary). */
export type MyAssignmentStaffAssignment = {
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

export type MyAssignmentStaffEvent = {
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

export type MyAssignmentStaffItem = {
  assignment: MyAssignmentStaffAssignment;
  event: MyAssignmentStaffEvent;
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

function pickNum(
  raw: Record<string, unknown>,
  ...keys: string[]
): number | null {
  for (const k of keys) {
    const v = raw[k];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Costruisce una stringa datetime interpretabile da `new Date()` (come ko_italy legacy).
 */
function buildKoItaly(
  dateStr: string | null | undefined,
  koTime: string | null | undefined
): string | null {
  if (!dateStr?.trim()) return null;
  const t = koTime?.trim();
  if (t) {
    const normalized = t.length === 5 ? `${t}:00` : t;
    return `${dateStr.trim()}T${normalized}`;
  }
  return `${dateStr.trim()}T12:00:00`;
}

export function mapApiRowToMyAssignmentStaffItem(
  raw: Record<string, unknown>
): MyAssignmentStaffItem {
  const id = Number(raw.id ?? raw.assignmentId);
  const eventId = Number(raw.eventId ?? raw.event_id ?? 0);
  const date = pickStr(raw, "date", "ko_date", "event_date");
  const koTime = pickStr(raw, "ko_time", "koTime");
  const ko_italy = buildKoItaly(date, koTime);
  const roleCode =
    pickStr(raw, "role_code", "roleCode") ??
    pickStr(raw, "role_name", "roleName") ??
    "";

  const feeRaw = raw.fee ?? raw.staff_fee ?? raw.staffFee;
  let fee: number | null = null;
  if (feeRaw != null && feeRaw !== "") {
    const n = Number(feeRaw);
    fee = Number.isFinite(n) ? n : null;
  }

  const staffId = pickNum(raw, "staff_id", "staffId") ?? 0;

  return {
    assignment: {
      id: Number.isFinite(id) ? id : 0,
      event_id: Number.isFinite(eventId) ? eventId : 0,
      staff_id: staffId,
      role_code: roleCode,
      fee,
      location: pickStr(raw, "assignment_location", "location", "role_location"),
      status: String(raw.status ?? "SENT").toUpperCase(),
      plate_selected: pickStr(raw, "plate_selected", "plateSelected"),
      notes:
        raw.notes === undefined || raw.notes === null
          ? null
          : String(raw.notes),
      created_at: pickStr(raw, "created_at", "createdAt") ?? "",
      updated_at: pickStr(raw, "updated_at", "updatedAt") ?? "",
    },
    event: {
      id: Number.isFinite(eventId) ? eventId : 0,
      category: pickStr(raw, "category", "event_category") ?? "",
      competition_name:
        pickStr(raw, "competition_name", "competitionName") ?? "",
      competition_code:
        pickStr(raw, "competition_code", "competitionCode") ?? null,
      matchday: pickNum(raw, "matchday", "matchDay"),
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
      venue_name: pickStr(raw, "venue_name", "venueName"),
      ko_italy,
      pre_duration_minutes:
        pickNum(raw, "pre_duration_minutes", "preDurationMinutes") ?? 0,
      standard_onsite: pickStr(raw, "standard_onsite", "standardOnsite"),
      standard_cologno: pickStr(raw, "standard_cologno", "standardCologno"),
      location: pickStr(raw, "event_location", "venue_location"),
      show_name: pickStr(raw, "show_name", "showName"),
      status: pickStr(raw, "event_status", "eventStatus") ?? "",
    },
  };
}

export type FetchMyAssignmentsStaffError = Error & {
  status?: number;
  retryAfterSeconds?: number;
};

export async function fetchMyAssignmentsStaff(): Promise<{
  items: MyAssignmentStaffItem[];
  staffPlates: string;
}> {
  const res = await fetch(`${getApiBaseUrl()}/api/my-assignments`, {
    credentials: "include",
  });

  if (res.status === 401) {
    const err = new Error("Unauthorized") as FetchMyAssignmentsStaffError;
    err.status = 401;
    throw err;
  }

  if (res.status === 429) {
    const json = (await res.json().catch(() => ({}))) as {
      retryAfterSeconds?: number;
    };
    const err = new Error("Too many requests") as FetchMyAssignmentsStaffError;
    err.status = 429;
    err.retryAfterSeconds = json.retryAfterSeconds ?? 600;
    throw err;
  }

  if (!res.ok) {
    const err = new Error(
      `my-assignments failed: ${res.status}`
    ) as FetchMyAssignmentsStaffError;
    err.status = res.status;
    throw err;
  }

  const data = (await res.json()) as Record<string, unknown>;
  const rawItems: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray(data.items)
      ? data.items
      : [];

  const staffPlates =
    typeof data.staffPlates === "string"
      ? data.staffPlates
      : typeof data.staff_plates === "string"
        ? data.staff_plates
        : "";

  const items = rawItems.map((row) =>
    mapApiRowToMyAssignmentStaffItem(row as Record<string, unknown>)
  );

  return { items, staffPlates };
}

export async function confirmMyAssignmentStaff(
  assignmentId: number
): Promise<void> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/my-assignments/${assignmentId}/confirm`,
    {
      method: "POST",
      credentials: "include",
    }
  );
  if (!res.ok) {
    throw new Error(`Conferma fallita (${res.status})`);
  }
}

export async function confirmAllMyAssignmentsStaff(): Promise<number> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/my-assignments/confirm-all`,
    {
      method: "POST",
      credentials: "include",
    }
  );
  if (!res.ok) {
    throw new Error(`Conferma tutti fallita (${res.status})`);
  }
  const data = (await res.json().catch(() => ({}))) as {
    updatedCount?: number;
    updated?: number;
  };
  if (typeof data.updatedCount === "number") return data.updatedCount;
  if (typeof data.updated === "number") return data.updated;
  return 0;
}

/** Rifiuto: PATCH con status (allineato al vecchio PATCH /api/assignments). */
export async function rejectMyAssignmentStaff(
  assignmentId: number
): Promise<void> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/my-assignments/${assignmentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: "REJECTED" }),
    }
  );
  if (!res.ok) {
    throw new Error(`Rifiuto fallito (${res.status})`);
  }
}

export async function patchMyAssignmentNotesStaff(
  assignmentId: number,
  notes: string
): Promise<void> {
  const res = await fetch(
    `${getApiBaseUrl()}/api/my-assignments/${assignmentId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ notes }),
    }
  );
  if (!res.ok) {
    throw new Error(`Salvataggio note fallito (${res.status})`);
  }
}
