import { apiFetch } from "./apiFetch";

export interface LeedsTxRow {
  id: number | null;
  event_id: string;
  // campi evento (verdi — readonly)
  competition_name: string | null;
  matchday: number | null;
  date: string | null;
  ko_italy_time: string | null;
  ko_gmt_time: string | null;
  mcr_lineup_gmt: string | null;
  pod_lineup_gmt: string | null;
  home_team: string | null;
  away_team: string | null;
  show_name: string | null;
  category: string | null;
  standard_cologno: string | null;
  facilities: string | null;
  party_line: string | null;
  live_prod_coordinator: string | null;
  live_prod_coordinator_contact: string | null;
  // colonne blu (Leeds)
  pod_tx: string | null;
  pod_phone_number: string | null;
  ld_initials: string | null;
  ld_name: string | null;
  has_override: boolean;
}

export interface LeedsTxBluePayload {
  pod_tx?: string | null;
  pod_phone_number?: string | null;
  ld_initials?: string | null;
  ld_name?: string | null;
}

export interface LeedsTxGreenOverridePayload {
  override_live_prod_coordinator?: string | null;
  override_live_prod_contact?: string | null;
  override_party_line?: string | null;
  override_facilities?: string | null;
}

function normalizeLeedsTxRow(raw: Record<string, unknown>): LeedsTxRow {
  return {
    id: raw.id == null ? null : Number(raw.id),
    event_id: String(raw.event_id ?? ""),
    competition_name: raw.competition_name == null ? null : String(raw.competition_name),
    matchday:
      raw.matchday == null || raw.matchday === "" ? null : Number(raw.matchday),
    date: raw.date == null ? null : String(raw.date),
    ko_italy_time: raw.ko_italy_time == null ? null : String(raw.ko_italy_time),
    ko_gmt_time: raw.ko_gmt_time == null ? null : String(raw.ko_gmt_time),
    mcr_lineup_gmt: raw.mcr_lineup_gmt == null ? null : String(raw.mcr_lineup_gmt),
    pod_lineup_gmt: raw.pod_lineup_gmt == null ? null : String(raw.pod_lineup_gmt),
    home_team: raw.home_team == null ? null : String(raw.home_team),
    away_team: raw.away_team == null ? null : String(raw.away_team),
    show_name: raw.show_name == null ? null : String(raw.show_name),
    category: raw.category == null ? null : String(raw.category),
    standard_cologno:
      raw.standard_cologno == null ? null : String(raw.standard_cologno),
    facilities: raw.facilities == null ? null : String(raw.facilities),
    party_line: raw.party_line == null ? null : String(raw.party_line),
    live_prod_coordinator:
      raw.live_prod_coordinator == null ? null : String(raw.live_prod_coordinator),
    live_prod_coordinator_contact:
      raw.live_prod_coordinator_contact == null
        ? null
        : String(raw.live_prod_coordinator_contact),
    pod_tx: raw.pod_tx == null ? null : String(raw.pod_tx),
    pod_phone_number:
      raw.pod_phone_number == null ? null : String(raw.pod_phone_number),
    ld_initials: raw.ld_initials == null ? null : String(raw.ld_initials),
    ld_name: raw.ld_name == null ? null : String(raw.ld_name),
    has_override: Boolean(raw.has_override),
  };
}

export async function fetchLeedsTx(): Promise<LeedsTxRow[]> {
  const res = await apiFetch("/api/leeds-tx", { cache: "no-store" });
  if (!res.ok) throw new Error(`Leeds TX fetch error: ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data)
    ? data.map((row) => normalizeLeedsTxRow(row as Record<string, unknown>))
    : [];
}

export async function patchLeedsTx(
  eventId: string,
  payload: LeedsTxBluePayload | LeedsTxGreenOverridePayload
): Promise<void> {
  const res = await apiFetch(`/api/leeds-tx/${eventId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Leeds TX patch error: ${res.status}`);
}
