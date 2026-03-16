export function getApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
  // Normalizza URL malformati tipo "http://4000" o "4000" -> "http://localhost:4000"
  const trimmed = String(raw).trim().replace(/\/$/, "");
  if (/^https?:\/\/\d+$/.test(trimmed)) {
    const port = trimmed.replace(/^https?:\/\//, "");
    const protocol = trimmed.startsWith("https") ? "https" : "http";
    return `${protocol}://localhost:${port}`;
  }
  if (/^\d+$/.test(trimmed)) {
    return `http://localhost:${trimmed}`;
  }
  return trimmed || "http://localhost:4000";
}
