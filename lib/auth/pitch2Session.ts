import { apiFetch, apiFetchServer } from "@/lib/api/apiFetch";
import { supabase } from "@/lib/supabaseClient";

export type Pitch2MeResponse = {
  user_level?: string;
  userLevel?: string;
};

export function assignmentsHomeForUserLevel(levelRaw: string | undefined): string {
  const u = (levelRaw ?? "").toUpperCase();
  if (u === "FREELANCE") return "/freelance/le-mie-assegnazioni";
  if (u === "PROVIDER") return "/provider/le-mie-assegnazioni";
  if (u === "STAFF" || u === "MANAGER" || u === "MASTER") {
    return "/le-mie-assegnazioni";
  }
  return "/le-mie-assegnazioni";
}

export async function loginAndSync(
  email: string,
  password: string,
  rememberMe: boolean
): Promise<{ ok: boolean; userLevel?: string; error?: string }> {
  const { data, error: signErr } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signErr) {
    return { ok: false, error: signErr.message };
  }

  const accessToken = data.session?.access_token;
  if (!accessToken) {
    return { ok: false, error: "Session not available after login." };
  }

  const sessionRes = await postSupabaseSessionToBackend(accessToken, {
    rememberMe,
  });
  if (!sessionRes.ok) {
    const text = await sessionRes.text().catch(() => "");
    return { ok: false, error: text || `Errore server (${sessionRes.status})` };
  }

  const me = await fetchPitch2MeFromBrowser();
  if (!me.ok || !me.data) {
    return { ok: false, error: "Unable to retrieve profile. Please try again." };
  }

  return { ok: true, userLevel: pickUserLevel(me.data) };
}

/**
 * POST /api/auth/supabase/session: imposta cookie pitch2_session lato backend.
 * rememberMe: true (default) = sessione lunga; false = sessione breve (~1 giorno).
 */
export async function postSupabaseSessionToBackend(
  accessToken: string,
  options?: { rememberMe?: boolean }
): Promise<Response> {
  const payload: Record<string, unknown> = { access_token: accessToken };
  if (options && typeof options.rememberMe === "boolean") {
    payload.rememberMe = options.rememberMe;
  }
  return apiFetch("/api/auth/supabase/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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

/**
 * Chiude la sessione backend (cookie `pitch2_session`) e la sessione Supabase locale.
 * Se `POST /api/auth/logout` non è disponibile, si procede comunque con `signOut` locale.
 */
export async function logoutPitch2(): Promise<void> {
  try {
    await apiFetch("/api/auth/logout", { method: "POST", cache: "no-store" });
  } catch {
    /* errore di rete: continua con signOut Supabase */
  }
  await supabase.auth.signOut().catch(() => undefined);
}
