import { getApiBaseUrl } from "./config";

export function apiUrl(path: string): string {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Fetch verso il backend da browser (o contesti con cookie Same-Origin).
 * Imposta sempre `credentials: "include"` per inviare `pitch2_session`.
 */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), {
    ...init,
    credentials: "include",
  });
}

/**
 * Server Components: inoltra l’header `Cookie` (es. da `next/headers` cookies()).
 */
export function apiFetchServer(
  path: string,
  cookieHeader: string,
  init?: RequestInit
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (cookieHeader) headers.set("Cookie", cookieHeader);
  return fetch(apiUrl(path), {
    ...init,
    headers,
    cache: init?.cache ?? "no-store",
  });
}
