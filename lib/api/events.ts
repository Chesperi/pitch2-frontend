import { getApiBaseUrl } from "./config";

export type EventItem = {
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

export type EventListResponse = {
  items: EventItem[];
  total: number;
};

export async function fetchEvents(params?: {
  q?: string;
  category?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<EventListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.limit != null) searchParams.set("limit", String(params.limit));
  if (params?.offset != null) searchParams.set("offset", String(params.offset));

  const url = `${getApiBaseUrl()}/api/events${searchParams.toString() ? `?${searchParams}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch events: ${res.status}`);
  return res.json();
}
