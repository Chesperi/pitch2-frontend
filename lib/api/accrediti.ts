import { apiFetch } from "./apiFetch";
import { normalizeEventItem, type EventItem } from "./events";

export type AccreditoEvent = EventItem;

export interface AccreditoItem {
  id: number;
  eventId: string;
  staffId: number;
  company: string | null;
  surname: string | null;
  name: string | null;
  roleCode: string | null;
  areas: string | null;
  plates: string | null;
  notes: string | null;
}

export interface CreateAccreditoPayload {
  eventId: string;
  staffId: number | string;
  roleCode?: string | null;
  areas?: string | null;
  plates?: string | null;
  notes?: string | null;
}

export interface AccreditationAreaMapping {
  roleCode: string;
  areas: string;
}

export interface AccreditationAreaLegend {
  areaCode: string;
  description: string;
}

function normalizeAccreditoItem(raw: Record<string, unknown>): AccreditoItem {
  return {
    id: Number(raw.id ?? 0),
    eventId: String(raw.eventId ?? raw.event_id ?? ""),
    staffId: Number(raw.staffId ?? raw.staff_id ?? 0),
    company:
      raw.company != null && String(raw.company).trim() !== ""
        ? String(raw.company)
        : null,
    surname:
      raw.surname != null && String(raw.surname).trim() !== ""
        ? String(raw.surname)
        : null,
    name:
      raw.name != null && String(raw.name).trim() !== ""
        ? String(raw.name)
        : null,
    roleCode:
      raw.roleCode != null && String(raw.roleCode).trim() !== ""
        ? String(raw.roleCode)
        : raw.role_code != null && String(raw.role_code).trim() !== ""
          ? String(raw.role_code)
          : null,
    areas:
      raw.areas != null && String(raw.areas).trim() !== ""
        ? String(raw.areas)
        : null,
    plates:
      raw.plates != null && String(raw.plates).trim() !== ""
        ? String(raw.plates)
        : null,
    notes:
      raw.notes != null && String(raw.notes).trim() !== ""
        ? String(raw.notes)
        : null,
  };
}

export async function fetchAccreditiEvents(): Promise<AccreditoEvent[]> {
  const res = await apiFetch("/api/accrediti/events-ready", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch accrediti events: ${res.status}`);
  const data = (await res.json()) as { items?: Record<string, unknown>[] };
  const rows = Array.isArray(data.items) ? data.items : [];
  return rows.map((row) => normalizeEventItem(row));
}

export async function fetchAccrediti(eventId: string): Promise<AccreditoItem[]> {
  const res = await apiFetch(`/api/accrediti/${encodeURIComponent(eventId)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch accrediti: ${res.status}`);
  const data = (await res.json()) as { items?: Record<string, unknown>[] };
  const rows = Array.isArray(data.items) ? data.items : [];
  return rows.map((row) => normalizeAccreditoItem(row));
}

export async function createAccredito(
  payload: CreateAccreditoPayload
): Promise<AccreditoItem> {
  const res = await apiFetch("/api/accrediti", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create accredito: ${res.status}`);
  const data = (await res.json()) as Record<string, unknown>;
  return normalizeAccreditoItem(data);
}

export async function deactivateAccredito(id: number): Promise<void> {
  const res = await apiFetch(`/api/accrediti/${id}/deactivate`, {
    method: "PATCH",
  });
  if (!res.ok && res.status !== 204) {
    throw new Error(`Failed to deactivate accredito: ${res.status}`);
  }
}

export async function exportAccreditiPdf(eventId: string): Promise<Blob> {
  const res = await apiFetch(`/api/accrediti/${encodeURIComponent(eventId)}/pdf`, {
    method: "GET",
  });
  if (!res.ok) throw new Error(`Failed to export PDF: ${res.status}`);
  return res.blob();
}

export async function exportAccreditiXlsx(eventId: string): Promise<Blob> {
  const res = await apiFetch(
    `/api/accrediti/${encodeURIComponent(eventId)}/export-xlsx`,
    { method: "GET" }
  );
  if (!res.ok) throw new Error(`Failed to export XLSX: ${res.status}`);
  return res.blob();
}

export async function fetchAccreditationAreas(ownerCode: string): Promise<{
  mappings: AccreditationAreaMapping[];
  legends: AccreditationAreaLegend[];
}> {
  const res = await apiFetch(
    `/api/accreditation-areas/${encodeURIComponent(ownerCode)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Failed to fetch accreditation areas: ${res.status}`);
  const data = (await res.json()) as {
    mappings?: AccreditationAreaMapping[];
    legends?: AccreditationAreaLegend[];
  };
  return {
    mappings: Array.isArray(data.mappings) ? data.mappings : [],
    legends: Array.isArray(data.legends) ? data.legends : [],
  };
}
