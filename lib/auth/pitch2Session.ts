import { apiFetch, apiFetchServer } from "@/lib/api/apiFetch";

export type Pitch2MeResponse = {
  user_level?: string;
  userLevel?: string;
};

export function assignmentsHomeForUserLevel(levelRaw: string | undefined): string {
  const u = (levelRaw ?? "").toUpperCase();
  if (u === "FREELANCE") return "/freelance/le-mie-assegnazioni";
  return "/le-mie-assegnazioni";
}

/**
 * POST /api/auth/supabase/session con body { access_token } e cookie session
 * impostati dal backend (SameSite / dominio da allineare in produzione).
 */
export async function postSupabaseSessionToBackend(
  accessToken: string
): Promise<Response> {
  return apiFetch("/api/auth/supabase/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ access_token: accessToken }),
  });
}

/** GET /api/auth/me dal browser (cookie pitch2_session). */
export async function fetchPitch2MeFromBrowser(): Promise<{
  ok: boolean;
  status: number;
  data: Pitch2MeResponse | null;
}> {
  const res = await apiFetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok) {
    return { ok: false, status: res.status, data: null };
  }
  const data = (await res.json().catch(() => null)) as Pitch2MeResponse | null;
  return { ok: true, status: res.status, data };
}

/** GET /api/auth/me dal server Next (inoltro header Cookie). */
export async function fetchPitch2MeFromServer(cookieHeader: string): Promise<{
  ok: boolean;
  status: number;
  data: Pitch2MeResponse | null;
}> {
  const res = await apiFetchServer("/api/auth/me", cookieHeader, {
    method: "GET",
  });
  if (!res.ok) {
    return { ok: false, status: res.status, data: null };
  }
  const data = (await res.json().catch(() => null)) as Pitch2MeResponse | null;
  return { ok: true, status: res.status, data };
}

export function pickUserLevel(data: Pitch2MeResponse | null): string | undefined {
  if (!data) return undefined;
  return data.user_level ?? data.userLevel;
}
