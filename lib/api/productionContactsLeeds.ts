import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "./apiFetch";

const BASE = "/api/production-contacts-leeds";

function pickStr(
  raw: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const k of keys) {
    const v = raw[k];
    if (v == null) continue;
    const s = String(v).trim();
    if (s !== "") return s;
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

export type ProductionContactLeeds = {
  id: number;
  competition: string;
  matchday: number | null;
  date: string | null;
  day: string | null;
  koItaly: string | null;
  koGmt: string | null;
  mcrLineupGmt: string | null;
  podLineupGmt: string | null;
  preMinutes: number | null;
  home: string | null;
  away: string | null;
  standardCologno: string | null;
  facilities: string | null;
  liveProdCoordinator: string | null;
  coordinatorContact: string | null;
  partyLine: string | null;
  mcrLeedsPhone: string | null;
  podLeeds: string | null;
  podOperator: string | null;
  podContact: string | null;
};

export type ProductionContactLeedsPayload = Omit<
  ProductionContactLeeds,
  "id"
>;

async function getBearerHeaders(): Promise<Headers> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const token = data.session?.access_token;
  if (!token) {
    throw new Error(
      "Sessione non disponibile. Effettua di nuovo l'accesso per ottenere il token."
    );
  }
  const h = new Headers();
  h.set("Authorization", `Bearer ${token}`);
  return h;
}

async function productionContactsFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const authHeaders = await getBearerHeaders();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", authHeaders.get("Authorization")!);
  if (init?.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
    headers,
  });
}

export function normalizeProductionContactLeeds(
  raw: Record<string, unknown>
): ProductionContactLeeds {
  const id = Number(raw.id);
  return {
    id: Number.isFinite(id) ? id : 0,
    competition: pickStr(raw, "competition", "competition_name") ?? "",
    matchday: pickNum(raw, "matchday", "match_day", "md", "MD"),
    date: pickStr(raw, "date", "event_date", "match_date"),
    day: pickStr(raw, "day", "weekday", "day_label"),
    koItaly: pickStr(raw, "ko_italy", "koItaly", "ko_italy_time"),
    koGmt: pickStr(raw, "ko_gmt", "koGmt"),
    mcrLineupGmt: pickStr(
      raw,
      "mcr_lineup_gmt",
      "mcrLineupGmt",
      "mcr_lineup_GMT"
    ),
    podLineupGmt: pickStr(
      raw,
      "pod_lineup_gmt",
      "podLineupGmt",
      "pod_lineup_GMT"
    ),
    preMinutes: pickNum(raw, "pre_minutes", "preMinutes", "pre_duration_minutes"),
    home: pickStr(raw, "home", "home_team", "home_team_name_short"),
    away: pickStr(raw, "away", "away_team", "away_team_name_short"),
    standardCologno: pickStr(raw, "standard_cologno", "standardCologno"),
    facilities: pickStr(raw, "facilities"),
    liveProdCoordinator: pickStr(
      raw,
      "live_prod_coordinator",
      "liveProdCoordinator"
    ),
    coordinatorContact: pickStr(
      raw,
      "coordinator_contact",
      "coordinatorContact"
    ),
    partyLine: pickStr(raw, "party_line", "partyLine"),
    mcrLeedsPhone: pickStr(raw, "mcr_leeds_phone", "mcrLeedsPhone"),
    podLeeds: pickStr(raw, "pod_leeds", "podLeeds"),
    podOperator: pickStr(raw, "pod_operator", "podOperator"),
    podContact: pickStr(raw, "pod_contact", "podContact"),
  };
}

function toApiJsonBody(
  row: ProductionContactLeedsPayload
): Record<string, unknown> {
  return {
    competition: row.competition,
    matchday: row.matchday,
    date: row.date,
    day: row.day,
    ko_italy: row.koItaly,
    ko_gmt: row.koGmt,
    mcr_lineup_gmt: row.mcrLineupGmt,
    pod_lineup_gmt: row.podLineupGmt,
    pre_minutes: row.preMinutes,
    home: row.home,
    away: row.away,
    standard_cologno: row.standardCologno,
    facilities: row.facilities,
    live_prod_coordinator: row.liveProdCoordinator,
    coordinator_contact: row.coordinatorContact,
    party_line: row.partyLine,
    mcr_leeds_phone: row.mcrLeedsPhone,
    pod_leeds: row.podLeeds,
    pod_operator: row.podOperator,
    pod_contact: row.podContact,
  };
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const j = JSON.parse(text) as {
        error?: string;
        message?: string;
      };
      return j.message || j.error || fallback;
    } catch {
      return text.slice(0, 200) || fallback;
    }
  } catch {
    return fallback;
  }
}

export async function fetchProductionContactsLeeds(): Promise<
  ProductionContactLeeds[]
> {
  const res = await productionContactsFetch(BASE, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      await readErrorMessage(res, `Errore caricamento Leeds TX: ${res.status}`)
    );
  }
  const data = (await res.json()) as unknown;
  if (Array.isArray(data)) {
    return (data as Record<string, unknown>[]).map(normalizeProductionContactLeeds);
  }
  if (data && typeof data === "object" && "items" in data) {
    const items = (data as { items: unknown }).items;
    if (Array.isArray(items)) {
      return (items as Record<string, unknown>[]).map(
        normalizeProductionContactLeeds
      );
    }
  }
  return [];
}

export async function createProductionContactLeeds(
  payload: ProductionContactLeedsPayload
): Promise<ProductionContactLeeds> {
  const res = await productionContactsFetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toApiJsonBody(payload)),
  });
  if (!res.ok) {
    throw new Error(
      await readErrorMessage(res, `Creazione fallita: ${res.status}`)
    );
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeProductionContactLeeds(raw);
}

export async function updateProductionContactLeeds(
  id: number,
  payload: ProductionContactLeedsPayload
): Promise<ProductionContactLeeds> {
  const res = await productionContactsFetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toApiJsonBody(payload)),
  });
  if (!res.ok) {
    throw new Error(
      await readErrorMessage(res, `Aggiornamento fallito: ${res.status}`)
    );
  }
  const raw = (await res.json()) as Record<string, unknown>;
  return normalizeProductionContactLeeds(raw);
}

export async function deleteProductionContactLeeds(id: number): Promise<void> {
  const res = await productionContactsFetch(`${BASE}/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(
      await readErrorMessage(res, `Eliminazione fallita: ${res.status}`)
    );
  }
}
