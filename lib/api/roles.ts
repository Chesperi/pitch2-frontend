import { getApiBaseUrl } from "./config";

export type Role = {
  id: number;
  code: string;
  name: string;
  location: string;
  description: string | null;
  active: boolean;
};

export async function fetchRoles(): Promise<Role[]> {
  const url = `${getApiBaseUrl()}/api/roles`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch roles: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.items ?? [];
}
