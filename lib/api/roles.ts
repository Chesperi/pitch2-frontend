import { apiFetch, apiFetchServer } from "./apiFetch";

export type Role = {
  id: number;
  code: string;
  name: string;
  location: string;
  description: string | null;
};

export type CreateRolePayload = {
  roleCode: string;
  name?: string;
  location: string;
  description?: string | null;
};

export type UpdateRolePayload = Partial<CreateRolePayload>;

export type RolesFetchOptions = {
  cookieHeader?: string;
};

async function readRoleErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { message?: string; error?: string };
    return data.message || data.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchRoles(
  options?: RolesFetchOptions
): Promise<Role[]> {
  const res = options?.cookieHeader
    ? await apiFetchServer("/api/roles", options.cookieHeader, {
        cache: "no-store",
      })
    : await apiFetch("/api/roles", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch roles: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : data.items ?? [];
}

export async function createRole(payload: CreateRolePayload): Promise<Role> {
  const res = await apiFetch("/api/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      await readRoleErrorMessage(res, `Failed to create role: ${res.status}`)
    );
  }
  return (await res.json()) as Role;
}

export async function updateRole(
  id: number,
  payload: UpdateRolePayload
): Promise<Role> {
  const res = await apiFetch(`/api/roles/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(
      await readRoleErrorMessage(res, `Failed to update role: ${res.status}`)
    );
  }
  return (await res.json()) as Role;
}
