import { apiFetch } from "./apiFetch";

export type EventAssignmentsStatus = "DRAFT" | "READY_TO_SEND" | "SENT";

export interface EventItem {
  id: string;
  date?: string | null;
  externalMatchId: string | null;
  category: string;
  competitionName: string;
  competitionCode: string | null;
  matchDay: string;
  homeTeamNameShort: string;
  awayTeamNameShort: string;
  venueName: string | null;
  venueCity: string | null;
  venueAddress: string | null;
  koItaly: string;
  preDurationMinutes: number;
  standardOnsite: string | null;
  standardCologno: string | null;
  areaProduzione: string | null;
  showName: string | null;
  status: string;
  standardComboId?: number | null;
  assignmentsStatus: EventAssignmentsStatus;
  rightsHolder?: string | null;
  facilities?: string | null;
  studio?: string | null;
  notes?: string | null;
  isTopMatch?: boolean;
}

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

/** Normalizza una risposta API (snake_case o camelCase) in EventItem. */
export function normalizeEventItem(raw: Record<string, unknown>): EventItem {
  const ext = raw.external_match_id ?? raw.externalMatchId;
  return {
    id: String(raw.id ?? ""),
    date:
      raw.date != null && String(raw.date).trim() !== ""
        ? String(raw.date).slice(0, 10)
        : null,
    externalMatchId:
      ext != null && ext !== "" ? String(ext) : null,
    category: String(raw.category ?? ""),
    competitionName: String(
      raw.competition_name ?? raw.competitionName ?? ""
    ),
    competitionCode:
      pickStr(raw, "competition_code", "competitionCode") ?? null,
    matchDay: String(raw.matchday ?? raw.matchDay ?? ""),
    homeTeamNameShort: String(
      raw.home_team_name_short ?? raw.homeTeamNameShort ?? ""
    ),
    awayTeamNameShort: String(
      raw.away_team_name_short ?? raw.awayTeamNameShort ?? ""
    ),
    venueName: pickStr(raw, "venue_name", "venueName"),
    venueCity: pickStr(raw, "venue_city", "venueCity"),
    venueAddress: pickStr(raw, "venue_address", "venueAddress"),
    koItaly: String(raw.ko_italy ?? raw.koItaly ?? ""),
    preDurationMinutes: Number(
      raw.pre_duration_minutes ?? raw.preDurationMinutes ?? 0
    ),
    standardOnsite: pickStr(raw, "standard_onsite", "standardOnsite"),
    standardCologno: pickStr(raw, "standard_cologno", "standardCologno"),
    areaProduzione: pickStr(
      raw,
      "location",
      "area_produzione",
      "areaProduzione"
    ),
    showName: pickStr(raw, "show_name", "showName"),
    status: String(raw.status ?? ""),
    standardComboId:
      raw.standard_combo_id != null
        ? Number(raw.standard_combo_id)
        : raw.standardComboId != null
          ? Number(raw.standardComboId)
          : null,
    assignmentsStatus: (String(
      raw.assignments_status ?? raw.assignmentsStatus ?? "DRAFT"
    ).toUpperCase() as EventAssignmentsStatus) || "DRAFT",
    rightsHolder: pickStr(raw, "rights_holder", "rightsHolder"),
    facilities: pickStr(raw, "facilities"),
    studio: pickStr(raw, "studio", "studio"),
    notes:
      raw.notes === undefined || raw.notes === null
        ? null
        : String(raw.notes),
    isTopMatch: Boolean(raw.is_top_match ?? raw.isTopMatch),
  };
}

/** Converte payload camelCase → snake_case per body JSON verso /api/events. */
export function eventPayloadToSnakeCase(
  payload: Partial<CreateEventPayload>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (payload.category !== undefined) out.category = payload.category;
  if (payload.competitionName !== undefined)
    out.competition_name = payload.competitionName;
  if (payload.competitionCode !== undefined)
    out.competition_code = payload.competitionCode || null;
  if (payload.matchDay !== undefined) out.matchday = payload.matchDay;
  if (payload.homeTeamNameShort !== undefined)
    out.home_team_name_short = payload.homeTeamNameShort;
  if (payload.awayTeamNameShort !== undefined)
    out.away_team_name_short = payload.awayTeamNameShort;
  if (payload.venueName !== undefined)
    out.venue_name = payload.venueName || null;
  if (payload.venueCity !== undefined)
    out.venue_city = payload.venueCity || null;
  if (payload.venueAddress !== undefined)
    out.venue_address = payload.venueAddress || null;
  if (payload.koItaly !== undefined) out.ko_italy = payload.koItaly;
  if (payload.preDurationMinutes !== undefined)
    out.pre_duration_minutes = payload.preDurationMinutes;
  if (payload.standardOnsite !== undefined)
    out.standard_onsite = payload.standardOnsite || null;
  if (payload.standardCologno !== undefined)
    out.standard_cologno = payload.standardCologno || null;
  if (payload.showName !== undefined)
    out.show_name = payload.showName || null;
  if (payload.status !== undefined) out.status = payload.status;
  if (payload.notes !== undefined)
    out.notes = payload.notes === null ? null : payload.notes || null;
  if (payload.rightsHolder !== undefined)
    out.rights_holder =
      payload.rightsHolder === null ? null : payload.rightsHolder || null;
  if (payload.facilities !== undefined)
    out.facilities =
      payload.facilities === null ? null : payload.facilities || null;
  if (payload.studio !== undefined)
    out.studio = payload.studio === null ? null : payload.studio || null;
  if (payload.isTopMatch !== undefined) out.is_top_match = payload.isTopMatch;

  return out;
}

/** Filtri lista eventi (query verso /api/events). */
export type EventFilters = {
  status?: "TBD" | "OK" | "CONFIRMED" | "CANCELED";
  category?: "MATCH" | "STUDIO SHOW" | "MEDIA_CONTENT";
  assignmentsStatus?: EventAssignmentsStatus;
};

export interface FetchEventsParams {
  onlyDesignable?: boolean;
  q?: string;
  /** Filtro categoria legacy (stringa libera); se presente `filters.category`, ha precedenza. */
  category?: string;
  status?: string;
  assignments_status?: EventAssignmentsStatus;
  limit?: number;
  offset?: number;
  /** Paginazione alternativa: `offset = page * pageSize`, `limit = pageSize`. */
  page?: number;
  pageSize?: number;
  filters?: EventFilters;
}

export type FetchEventsResult = {
  items: EventItem[];
  total: number;
};

/** Valore colonna `category` nel DB per l'opzione filtro MEDIA_CONTENT. */
function filterCategoryToQueryParam(
  c: NonNullable<EventFilters["category"]>
): string {
  return c === "MEDIA_CONTENT" ? "MEDIA CONTENT" : c;
}

function parseEventsListResponse(data: unknown): FetchEventsResult {
  const rawList: unknown[] = Array.isArray(data)
    ? data
    : data != null &&
        typeof data === "object" &&
        Array.isArray((data as { items?: unknown[] }).items)
      ? (data as { items: unknown[] }).items
      : [];
  const total =
    typeof data === "object" &&
    data !== null &&
    !Array.isArray(data) &&
    typeof (data as { total?: unknown }).total === "number"
      ? (data as { total: number }).total
      : rawList.length;
  return {
    items: rawList.map((row) =>
      normalizeEventItem(row as Record<string, unknown>)
    ),
    total,
  };
}

export async function fetchEvents(
  params: FetchEventsParams = {}
): Promise<FetchEventsResult> {
  const q = new URLSearchParams();
  if (params.onlyDesignable) {
    q.set("onlyDesignable", "true");
  }
  if (params.q) q.set("q", params.q);

  let limit: number;
  let offset: number;
  if (params.page != null && params.pageSize != null) {
    limit = params.pageSize;
    offset = Math.max(0, params.page) * params.pageSize;
  } else {
    limit = params.limit ?? 50;
    offset = params.offset ?? 0;
  }
  q.set("limit", String(limit));
  q.set("offset", String(offset));

  const statusFilter = params.filters?.status ?? params.status;
  if (statusFilter) q.set("status", statusFilter);

  const categoryFilter =
    params.filters?.category != null
      ? filterCategoryToQueryParam(params.filters.category)
      : params.category;
  if (categoryFilter) q.set("category", categoryFilter);

  const assignmentsStatusFilter =
    params.filters?.assignmentsStatus ?? params.assignments_status;
  if (assignmentsStatusFilter) {
    q.set("assignments_status", assignmentsStatusFilter);
  }

  const path = `/api/events?${q.toString()}`;
  const res = await apiFetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  const data = await res.json();
  return parseEventsListResponse(data);
}

/** Parametri per `GET /api/events/designable` (eventi con standard, OK/CONFIRMED, assignments in bozza). */
export type FetchDesignableEventsParams = {
  q?: string;
  assignments_status?: EventAssignmentsStatus;
  limit?: number;
  offset?: number;
  page?: number;
  pageSize?: number;
};

export async function fetchDesignableEvents(
  params: FetchDesignableEventsParams = {}
): Promise<FetchEventsResult> {
  const q = new URLSearchParams();

  let limit: number;
  let offset: number;
  if (params.page != null && params.pageSize != null) {
    limit = params.pageSize;
    offset = Math.max(0, params.page) * params.pageSize;
  } else {
    limit = params.limit ?? 100;
    offset = params.offset ?? 0;
  }
  q.set("limit", String(limit));
  q.set("offset", String(offset));
  if (params.q) q.set("q", params.q);
  if (params.assignments_status)
    q.set("assignments_status", params.assignments_status);

  const path = `/api/events/designable?${q.toString()}`;
  const res = await apiFetch(path, { cache: "no-store" });
  if (!res.ok)
    throw new Error(`Failed to fetch designable events: ${res.status}`);
  const data = await res.json();
  return parseEventsListResponse(data);
}

export async function fetchEventById(id: string): Promise<EventItem | null> {
  const enc = encodeURIComponent(String(id));
  const res = await apiFetch(`/api/events/${enc}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch event: ${res.status}`);
  }
  const data = (await res.json()) as Record<string, unknown>;
  return normalizeEventItem(data);
}

export interface CreateEventPayload {
  category: string;
  competitionName: string;
  competitionCode?: string;
  matchDay: string;
  homeTeamNameShort: string;
  awayTeamNameShort: string;
  venueName?: string;
  venueCity?: string;
  venueAddress?: string;
  koItaly: string;
  preDurationMinutes: number;
  standardOnsite?: string;
  standardCologno?: string;
  areaProduzione?: string;
  showName?: string;
  status: string;
  /** null = invia null al backend (es. PATCH per azzerare). */
  notes?: string | null;
  rightsHolder?: string | null;
  facilities?: string | null;
  studio?: string | null;
  isTopMatch?: boolean;
}

export type UpdateEventPayload = Partial<CreateEventPayload>;

export async function createEvent(
  payload: CreateEventPayload
): Promise<EventItem> {
  const body = eventPayloadToSnakeCase(payload);
  const res = await apiFetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to create event: ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  return normalizeEventItem(data);
}

export async function updateEvent(
  id: string,
  payload: UpdateEventPayload
): Promise<EventItem> {
  const body = eventPayloadToSnakeCase(payload);
  const enc = encodeURIComponent(String(id));
  const res = await apiFetch(`/api/events/${enc}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Failed to update event: ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  return normalizeEventItem(data);
}

export async function updateEventAssignmentsStatus(
  eventId: string,
  assignmentsStatus: EventAssignmentsStatus
): Promise<EventItem> {
  const enc = encodeURIComponent(String(eventId));
  const res = await apiFetch(`/api/events/${enc}/assignments-status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assignmentsStatus }),
  });
  if (!res.ok)
    throw new Error(`Failed to update event assignments status: ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  return normalizeEventItem(data);
}

export async function bulkUpdateEventsStatus(params: {
  eventIds: string[];
  status: "TBC" | "TBD" | "OK" | "CONFIRMED" | "CANCELLED" | "CANCELED";
}): Promise<{ updated: number; status: string }> {
  const res = await apiFetch("/api/events/bulk-status", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to bulk update event status: ${res.status}`);
  }
  return res.json();
}

export async function bulkDeleteEvents(params: {
  eventIds: string[];
}): Promise<{ requested: number; updated: number }> {
  const res = await apiFetch("/api/events/bulk-delete", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    throw new Error(`Failed to bulk delete events: ${res.status}`);
  }
  return res.json();
}
