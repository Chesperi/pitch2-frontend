import { getApiBaseUrl } from "./config";

export type EventAssignmentsStatus = "DRAFT" | "READY_TO_SEND" | "SENT";

export interface EventItem {
  id: number;
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
  assignmentsStatus: EventAssignmentsStatus;
}

export interface FetchEventsParams {
  onlyDesignable?: boolean;
  q?: string;
  category?: string;
  status?: string;
  assignments_status?: EventAssignmentsStatus;
  limit?: number;
  offset?: number;
}

export async function fetchEvents(
  params: FetchEventsParams = {}
): Promise<EventItem[]> {
  const baseUrl = getApiBaseUrl();
  const url = new URL("/api/events", baseUrl);
  if (params.onlyDesignable) {
    url.searchParams.set("onlyDesignable", "true");
  }
  if (params.q) url.searchParams.set("q", params.q);
  if (params.category) url.searchParams.set("category", params.category);
  if (params.status) url.searchParams.set("status", params.status);
  if (params.assignments_status)
    url.searchParams.set("assignments_status", params.assignments_status);
  if (params.limit != null) url.searchParams.set("limit", String(params.limit));
  if (params.offset != null)
    url.searchParams.set("offset", String(params.offset));

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  const data = await res.json();
  return data.items ?? data;
}

export async function fetchEventById(id: number): Promise<EventItem | null> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/events/${id}`, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Failed to fetch event: ${res.status}`);
  }
  return res.json();
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
  notes?: string;
}

export type UpdateEventPayload = Partial<CreateEventPayload>;

export async function createEvent(
  payload: CreateEventPayload
): Promise<EventItem> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create event: ${res.status}`);
  return res.json();
}

export async function updateEvent(
  id: number,
  payload: UpdateEventPayload
): Promise<EventItem> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(`${baseUrl}/api/events/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to update event: ${res.status}`);
  return res.json();
}

export async function updateEventAssignmentsStatus(
  eventId: number,
  assignmentsStatus: EventAssignmentsStatus
): Promise<EventItem> {
  const baseUrl = getApiBaseUrl();
  const res = await fetch(
    `${baseUrl}/api/events/${eventId}/assignments-status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignmentsStatus }),
    }
  );
  if (!res.ok)
    throw new Error(`Failed to update event assignments status: ${res.status}`);
  return res.json();
}
