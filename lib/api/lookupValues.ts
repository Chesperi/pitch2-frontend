import { apiFetch } from "./apiFetch";
import type {
  CreateLookupValuePayload,
  LookupValue,
  UpdateLookupValuePayload,
} from "@/lib/types";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function mapLookupValue(raw: Record<string, unknown>): LookupValue {
  return {
    id: Number(raw.id ?? 0),
    category: String(raw.category ?? ""),
    value: String(raw.value ?? ""),
    sort_order: Number(raw.sort_order ?? 0),
    created_at: String(raw.created_at ?? ""),
  };
}

export async function fetchLookupValues(
  category?: string
): Promise<LookupValue[]> {
  const q = category?.trim()
    ? `?category=${encodeURIComponent(category.trim())}`
    : "";
  const res = await apiFetch(`/api/lookup-values${q}`, { cache: "no-store" });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data.map((row) => mapLookupValue(row as Record<string, unknown>));
}

export async function createLookupValue(
  payload: CreateLookupValuePayload
): Promise<LookupValue> {
  const res = await apiFetch("/api/lookup-values", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      category: payload.category,
      value: payload.value,
      sort_order: payload.sort_order,
    }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const row = (await res.json()) as Record<string, unknown>;
  return mapLookupValue(row);
}

export async function updateLookupValue(
  id: number,
  payload: UpdateLookupValuePayload
): Promise<LookupValue> {
  const res = await apiFetch(`/api/lookup-values/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const row = (await res.json()) as Record<string, unknown>;
  return mapLookupValue(row);
}

export async function deleteLookupValue(id: number): Promise<void> {
  const res = await apiFetch(`/api/lookup-values/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
}
