import { supabase } from "@/lib/supabaseClient";
import { apiUrl } from "./apiFetch";

const BASE = "/api/production-contacts-leeds";

/** Chiavi JSON attese dal backend (allineate ai campi `production_contacts_leeds`). */
const API_KEYS = {
  competitionname: "competitionname",
  matchday: "matchday",
  date: "date",
  day: "day",
  predurationminutes: "predurationminutes",
  koitalytime: "koitalytime",
  kogmttime: "kogmttime",
  mcrlineupgmttime: "mcrlineupgmttime",
  podlineupgmttime: "podlineupgmttime",
  hometeamnameshort: "hometeamnameshort",
  awayteamnameshort: "awayteamnameshort",
  standardcologno: "standardcologno",
  facilities: "facilities",
  liveproductioncoordinator: "liveproductioncoordinator",
  liveproductioncoordinatorcontact: "liveproductioncoordinatorcontact",
  partyline: "partyline",
  mcrleedsphonenumber: "mcrleedsphonenumber",
  podleeds: "podleeds",
  podoperator: "podoperator",
  podleedscontact: "podleedscontact",
} as const;

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
  competitionName: string;
  matchday: number | null;
  date: string | null;
  day: string | null;
  preDurationMinutes: number | null;
  koItalyTime: string | null;
  koGmtTime: string | null;
  mcrLineupGmtTime: string | null;
  podLineupGmtTime: string | null;
  homeTeamNameShort: string | null;
  awayTeamNameShort: string | null;
  standardCologno: string | null;
  facilities: string | null;
  liveProductionCoordinator: string | null;
  liveProductionCoordinatorContact: string | null;
  partyLine: string | null;
  mcrLeedsPhoneNumber: string | null;
  podLeeds: string | null;
  podOperator: string | null;
  podLeedsContact: string | null;
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
    competitionName:
      pickStr(
        raw,
        API_KEYS.competitionname,
        "competition_name",
        "competitionName",
        "competition"
      ) ?? "",
    matchday: pickNum(raw, API_KEYS.matchday, "match_day", "md"),
    date: pickStr(raw, API_KEYS.date, "event_date", "match_date"),
    day: pickStr(raw, API_KEYS.day, "weekday", "day_label"),
    preDurationMinutes: pickNum(
      raw,
      API_KEYS.predurationminutes,
      "pre_duration_minutes",
      "preMinutes",
      "pre_minutes"
    ),
    koItalyTime: pickStr(
      raw,
      API_KEYS.koitalytime,
      "ko_italy",
      "koItaly",
      "ko_italy_time"
    ),
    koGmtTime: pickStr(raw, API_KEYS.kogmttime, "ko_gmt", "koGmt"),
    mcrLineupGmtTime: pickStr(
      raw,
      API_KEYS.mcrlineupgmttime,
      "mcr_lineup_gmt",
      "mcrLineupGmt"
    ),
    podLineupGmtTime: pickStr(
      raw,
      API_KEYS.podlineupgmttime,
      "pod_lineup_gmt",
      "podLineupGmt"
    ),
    homeTeamNameShort: pickStr(
      raw,
      API_KEYS.hometeamnameshort,
      "home_team_name_short",
      "home"
    ),
    awayTeamNameShort: pickStr(
      raw,
      API_KEYS.awayteamnameshort,
      "away_team_name_short",
      "away"
    ),
    standardCologno: pickStr(
      raw,
      API_KEYS.standardcologno,
      "standard_cologno",
      "standardCologno"
    ),
    facilities: pickStr(raw, API_KEYS.facilities),
    liveProductionCoordinator: pickStr(
      raw,
      API_KEYS.liveproductioncoordinator,
      "live_prod_coordinator",
      "liveProdCoordinator"
    ),
    liveProductionCoordinatorContact: pickStr(
      raw,
      API_KEYS.liveproductioncoordinatorcontact,
      "coordinator_contact",
      "coordinatorContact"
    ),
    partyLine: pickStr(raw, API_KEYS.partyline, "party_line", "partyLine"),
    mcrLeedsPhoneNumber: pickStr(
      raw,
      API_KEYS.mcrleedsphonenumber,
      "mcr_leeds_phone",
      "mcrLeedsPhone"
    ),
    podLeeds: pickStr(raw, API_KEYS.podleeds, "pod_leeds", "podLeeds"),
    podOperator: pickStr(raw, API_KEYS.podoperator, "pod_operator", "podOperator"),
    podLeedsContact: pickStr(
      raw,
      API_KEYS.podleedscontact,
      "pod_contact",
      "podContact"
    ),
  };
}

function toApiJsonBody(
  row: ProductionContactLeedsPayload
): Record<string, unknown> {
  return {
    [API_KEYS.competitionname]: row.competitionName,
    [API_KEYS.matchday]: row.matchday,
    [API_KEYS.date]: row.date,
    [API_KEYS.day]: row.day,
    [API_KEYS.predurationminutes]: row.preDurationMinutes,
    [API_KEYS.koitalytime]: row.koItalyTime,
    [API_KEYS.kogmttime]: row.koGmtTime,
    [API_KEYS.mcrlineupgmttime]: row.mcrLineupGmtTime,
    [API_KEYS.podlineupgmttime]: row.podLineupGmtTime,
    [API_KEYS.hometeamnameshort]: row.homeTeamNameShort,
    [API_KEYS.awayteamnameshort]: row.awayTeamNameShort,
    [API_KEYS.standardcologno]: row.standardCologno,
    [API_KEYS.facilities]: row.facilities,
    [API_KEYS.liveproductioncoordinator]: row.liveProductionCoordinator,
    [API_KEYS.liveproductioncoordinatorcontact]:
      row.liveProductionCoordinatorContact,
    [API_KEYS.partyline]: row.partyLine,
    [API_KEYS.mcrleedsphonenumber]: row.mcrLeedsPhoneNumber,
    [API_KEYS.podleeds]: row.podLeeds,
    [API_KEYS.podoperator]: row.podOperator,
    [API_KEYS.podleedscontact]: row.podLeedsContact,
  };
}

async function readErrorMessage(
  res: Response,
  fallback: string
): Promise<string> {
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
    return (data as Record<string, unknown>[]).map(
      normalizeProductionContactLeeds
    );
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
