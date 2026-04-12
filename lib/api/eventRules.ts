import { apiFetch } from "./apiFetch";
import type {
  CreateEventRulePayload,
  EventRule,
  UpdateEventRulePayload,
} from "@/lib/types";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function trimTimeForInput(v: string | null): string | null {
  if (v == null || String(v).trim() === "") return null;
  const s = String(v).trim();
  return s.length >= 5 ? s.slice(0, 5) : s;
}

function mapEventRule(raw: Record<string, unknown>): EventRule {
  return {
    id: Number(raw.id ?? 0),
    competition_name:
      raw.competition_name != null ? String(raw.competition_name) : null,
    day_of_week:
      raw.day_of_week != null && raw.day_of_week !== ""
        ? Number(raw.day_of_week)
        : null,
    ko_time_from:
      raw.ko_time_from != null
        ? trimTimeForInput(String(raw.ko_time_from))
        : null,
    ko_time_to:
      raw.ko_time_to != null
        ? trimTimeForInput(String(raw.ko_time_to))
        : null,
    standard_onsite:
      raw.standard_onsite != null ? String(raw.standard_onsite) : null,
    standard_cologno:
      raw.standard_cologno != null ? String(raw.standard_cologno) : null,
    facilities: raw.facilities != null ? String(raw.facilities) : null,
    studio: raw.studio != null ? String(raw.studio) : null,
    show_name: raw.show_name != null ? String(raw.show_name) : null,
    pre_duration_minutes:
      raw.pre_duration_minutes != null && raw.pre_duration_minutes !== ""
        ? Number(raw.pre_duration_minutes)
        : null,
    priority: Number(raw.priority ?? 0),
    notes: raw.notes != null ? String(raw.notes) : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export async function fetchEventRules(): Promise<EventRule[]> {
  const res = await apiFetch("/api/event-rules", { cache: "no-store" });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapEventRule(row as Record<string, unknown>));
}

export async function createEventRule(
  payload: CreateEventRulePayload
): Promise<EventRule> {
  const res = await apiFetch("/api/event-rules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = (await res.json()) as Record<string, unknown>;
  return mapEventRule(data);
}

export async function updateEventRule(
  id: number,
  payload: UpdateEventRulePayload
): Promise<EventRule> {
  const res = await apiFetch(`/api/event-rules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = (await res.json()) as Record<string, unknown>;
  return mapEventRule(data);
}

export async function deleteEventRule(id: number): Promise<void> {
  const res = await apiFetch(`/api/event-rules/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}
