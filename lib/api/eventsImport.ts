import { apiFetch } from "./apiFetch";
import type { ImportPreviewItem } from "@/lib/types";

async function readErrorMessage(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

export async function fetchImportPreview(params: {
  competitionCode: string;
  dateFrom: string;
  dateTo: string;
}): Promise<ImportPreviewItem[]> {
  const res = await apiFetch("/api/events/import/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      competition_code: params.competitionCode,
      date_from: params.dateFrom,
      date_to: params.dateTo,
    }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  return data as ImportPreviewItem[];
}

export async function confirmImport(
  items: ImportPreviewItem[]
): Promise<{ imported: number; skipped: number }> {
  const res = await apiFetch("/api/events/import/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(await readErrorMessage(res));
  const data = (await res.json()) as {
    imported?: number;
    skipped?: number;
  };
  return {
    imported: Number(data.imported ?? 0),
    skipped: Number(data.skipped ?? 0),
  };
}
